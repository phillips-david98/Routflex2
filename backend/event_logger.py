from collections import deque
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import threading
from typing import Dict, List
from logging_manager import log_event, get_request_id


# Arquivo JSONL para compatibilidade com formato existente.
EVENT_LOG_FILE = Path(__file__).resolve().parent / "event_log.jsonl"

# 5 MB por arquivo, 7 backups → máximo ~35 MB de logs JSONL em disco.
_MAX_BYTES: int = 5 * 1024 * 1024
_BACKUP_COUNT: int = 7

# Lock de thread para serializar escrita + checagem de tamanho dentro do processo.
_write_lock = threading.Lock()


def _file_size() -> int:
    """Tamanho atual do arquivo ativo (bytes). Retorna 0 se não existir."""
    try:
        return EVENT_LOG_FILE.stat().st_size
    except FileNotFoundError:
        return 0


def _rotate() -> None:
    """
    Rotação de arquivos com lock exclusivo entre processos.

    Usa O_EXCL na criação do arquivo .lock, que é atômica no Windows e Unix,
    garantindo que apenas um processo (Gunicorn worker) execute a rotação
    por vez. Os demais ignoram silenciosamente e continuam no arquivo atual.

    Esquema de nomes (igual ao RotatingFileHandler do stdlib):
        event_log.jsonl        ← arquivo ativo
        event_log.jsonl.1      ← backup mais recente
        ...
        event_log.jsonl.7      ← backup mais antigo (removido na rotação)
    """
    lock_path = Path(str(EVENT_LOG_FILE) + ".lock")
    try:
        # O_EXCL: falha se o arquivo já existe → exclusão atômica entre processos.
        fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except (FileExistsError, OSError):
        # Outro processo está rotacionando; pular.
        return

    try:
        # Remove o backup mais antigo para abrir espaço.
        oldest = Path(f"{EVENT_LOG_FILE}.{_BACKUP_COUNT}")
        if oldest.exists():
            oldest.unlink(missing_ok=True)

        # Desloca backups: event_log.jsonl.N → event_log.jsonl.N+1
        for i in range(_BACKUP_COUNT - 1, 0, -1):
            src = Path(f"{EVENT_LOG_FILE}.{i}")
            dst = Path(f"{EVENT_LOG_FILE}.{i + 1}")
            if src.exists():
                src.rename(dst)

        # Arquivo ativo passa a ser o backup .1; novo arquivo será criado no próximo write.
        if EVENT_LOG_FILE.exists():
            EVENT_LOG_FILE.rename(Path(f"{EVENT_LOG_FILE}.1"))
    except OSError:
        pass
    finally:
        try:
            lock_path.unlink(missing_ok=True)
        except OSError:
            pass


def append_event(customer_id: str, action: str, user: str, metadata: Dict | None = None) -> Dict:
    """
    Registra evento com suporte a request_id e logging estruturado.
    Mantém compatibilidade com formato JSONL existente.

    Thread-safe via threading.Lock; multi-processo seguro via file lock exclusivo
    durante rotação. Rotaciona automaticamente ao atingir _MAX_BYTES.
    """
    record = {
        "customer_id": str(customer_id),
        "action": str(action),
        "user": str(user or "system"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }

    request_id = get_request_id()
    if request_id:
        record["request_id"] = request_id

    EVENT_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=True) + "\n"

    with _write_lock:
        # Verificar tamanho e rotar antes de escrever, se necessário.
        if _file_size() >= _MAX_BYTES:
            _rotate()
        try:
            with EVENT_LOG_FILE.open("a", encoding="utf-8") as fp:
                fp.write(line)
        except (OSError, IOError):
            # Falha no JSONL não impede o registro via logging_manager abaixo.
            pass

    # Duplo registro via logging_manager (RotatingFileHandler thread-safe).
    log_event(customer_id, action, user, metadata)

    return record


def read_events(limit: int = 200) -> List[Dict]:
    """
    Retorna os últimos `limit` eventos sem carregar o arquivo inteiro na memória.

    Complexidade:
        - Memória: O(limit)  — apenas os últimos `limit` registros ficam no deque.
        - Disco:   O(N) leituras — o arquivo é varrido linha a linha (streaming),
                   mas cada linha é descartada imediatamente pelo deque assim que
                   ultrapassa o limite, sem acumulação em memória.
    """
    if not EVENT_LOG_FILE.exists():
        return []

    safe_limit = max(1, min(limit, 2000))
    tail: deque[str] = deque(maxlen=safe_limit)

    try:
        with EVENT_LOG_FILE.open("r", encoding="utf-8") as fp:
            for raw in fp:
                raw = raw.strip()
                if raw:
                    tail.append(raw)
    except (OSError, IOError):
        return []

    events: List[Dict] = []
    for line in tail:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events
