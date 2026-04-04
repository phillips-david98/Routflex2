"""Database adapter: abstrai conexão com banco independente de dialeto.

Suporta SQLite (dev) e PostgreSQL (produção) via DATABASE_URL.
Toda lógica específica de dialeto fica centralizada aqui.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./routflex.db")


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
