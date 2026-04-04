import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from db_adapter import DATABASE_URL, get_engine_kwargs, get_dialect

NODE_ENV = os.getenv("NODE_ENV", "development")

# Impedir conexão com banco de produção fora de NODE_ENV=prod
if "prod" in DATABASE_URL.lower() and NODE_ENV != "production":
    raise RuntimeError("Conexão com banco de produção bloqueada fora de NODE_ENV=production!")

engine = create_engine(DATABASE_URL, **get_engine_kwargs())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
