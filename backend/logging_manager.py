"""
Gerenciador de logging estruturado com rotação automática.
Usa stdlib logging (RotatingFileHandler) sem dependências extras.
"""

import logging
import logging.handlers
import json
from pathlib import Path
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Dict, Any, Optional


# Context var para rastreabilidade por request (FastAPI middleware injeta)
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Retorna request_id do contexto da requisição atual."""
    return request_id_var.get()


def set_request_id(request_id: str) -> None:
    """Define request_id para a requisição atual."""
    request_id_var.set(request_id)


class JsonFormatter(logging.Formatter):
    """Formatter que escreve logs em JSON estruturado."""

    def format(self, record: logging.LogRecord) -> str:
        # Usa record.created (float POSIX já gerado pelo logging) evitando uma
        # chamada extra a datetime.now() em cada registro.
        ts = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
        log_obj: Dict[str, Any] = {
            "timestamp": ts,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Injeta request_id se disponível
        request_id = get_request_id()
        if request_id:
            log_obj["request_id"] = request_id

        # Adiciona dados extras se presentes (customer_id, action, etc.)
        if hasattr(record, "customer_id"):
            log_obj["customer_id"] = record.customer_id
        if hasattr(record, "action"):
            log_obj["action"] = record.action
        if hasattr(record, "user"):
            log_obj["user"] = record.user
        if hasattr(record, "metadata"):
            log_obj["metadata"] = record.metadata

        # Inclui exceção se houver
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, ensure_ascii=True)


def setup_logger(
    name: str,
    log_dir: Path = None,
    max_bytes: int = 10_485_760,
    backup_count: int = 5,
    console: bool = True,
) -> logging.Logger:
    """
    Configura logger com rotação automática e saída no console.

    Args:
        name: Nome do logger
        log_dir: Diretório para logs (padrão: ~/.routflex/logs)
        max_bytes: Tamanho máximo de arquivo antes da rotação (padrão: 10 MB)
        backup_count: Número de backups a manter (padrão: 5 × 10 MB = 50 MB)
        console: Se True, também emite para stdout (útil com uvicorn)

    Returns:
        Logger configurado com RotatingFileHandler (+ StreamHandler opcional)
    """
    if log_dir is None:
        log_dir = Path.home() / ".routflex" / "logs"

    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    # Não propaga para o root logger — evita duplicação com uvicorn
    logger.propagate = False

    # Evita adicionar handlers múltiplas vezes se chamado repetidas vezes
    if logger.handlers:
        return logger

    formatter = JsonFormatter()

    # RotatingFileHandler: thread-safe, com rotação automática por tamanho
    log_file = log_dir / f"{name}.jsonl"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # StreamHandler: emite JSON para stdout (capturado pelo uvicorn / systemd / Docker)
    if console:
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """Retorna um logger já configurado ou cria novo com setup_logger."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    return setup_logger(name)


# Loggers globais — inicializados uma única vez no import do módulo
event_logger = setup_logger("events")
app_logger = setup_logger("app")


def log_event(customer_id: str, action: str, user: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Registra evento estruturado com rastreabilidade de request.

    Args:
        customer_id: ID do cliente
        action: Ação realizada
        user: Usuário que realizou
        metadata: Dados adicionais (opcional)

    Returns:
        Dicionário do evento registrado (para compatibilidade com append_event)
    """
    record = {
        "customer_id": str(customer_id),
        "action": str(action),
        "user": str(user or "system"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }

    # Injeta request_id se disponível
    request_id = get_request_id()
    if request_id:
        record["request_id"] = request_id

    # Usa logger estruturado
    extra = {
        "customer_id": record["customer_id"],
        "action": record["action"],
        "user": record["user"],
        "metadata": record["metadata"],
    }
    event_logger.info(f"Event: {action}", extra=extra)

    return record
