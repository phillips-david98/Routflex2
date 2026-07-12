"""Database adapter: abstrai conexão com banco independente de dialeto.

Suporta SQLite (dev) e PostgreSQL (produção) via DATABASE_URL.
Toda lógica específica de dialeto fica centralizada aqui.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# HOTFIX P0: caminho ABSOLUTO e estável para o SQLite, derivado da localização
# deste arquivo (backend/). O banco é sempre backend/routflex.db,
# independentemente do diretório de execução (raiz do projeto ou backend/).
# A variável de ambiente DATABASE_URL (inclusive via .env) continua tendo
# prioridade; porém, se apontar para um SQLite RELATIVO (ex.: sqlite:///./routflex.db),
# o caminho é reancorado em backend/ para não depender do cwd. URLs absolutas
# (SQLite absoluto, PostgreSQL, etc.) são preservadas intactas.
_BASE_DIR = Path(__file__).resolve().parent
_DEFAULT_DB_PATH = _BASE_DIR / "routflex.db"
_DEFAULT_DATABASE_URL = f"sqlite:///{_DEFAULT_DB_PATH.as_posix()}"


def _stabilize_sqlite_url(url: str) -> str:
    """Reancora SQLite relativo em backend/. Não toca URLs absolutas/não-SQLite/:memory:."""
    prefix = "sqlite:///"
    if not url or not url.startswith(prefix):
        return url
    path_part = url[len(prefix):]
    if path_part.startswith(":") or path_part.startswith("file:"):
        return url  # :memory:, file: URIs — preservar
    p = Path(path_part)
    if p.is_absolute():
        return url
    abs_path = (_BASE_DIR / path_part).resolve()
    return f"sqlite:///{abs_path.as_posix()}"


DATABASE_URL: str = _stabilize_sqlite_url(os.getenv("DATABASE_URL", _DEFAULT_DATABASE_URL))


def get_dialect() -> str:
    """Retorna 'sqlite', 'postgresql' ou outro dialeto da URL."""
    return DATABASE_URL.split("://")[0].split("+")[0].lower()


def is_sqlite() -> bool:
    return get_dialect() == "sqlite"


def is_postgres() -> bool:
    return get_dialect() in ("postgresql", "postgres")


def get_engine_kwargs() -> dict:
    """Retorna kwargs otimizados para o dialeto ativo."""
    kwargs: dict = {"echo": False, "future": True}

    if is_sqlite():
        from sqlalchemy.pool import StaticPool
        kwargs.update({
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        })
    elif is_postgres():
        kwargs.update({
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
            "pool_pre_ping": True,
        })

    return kwargs
