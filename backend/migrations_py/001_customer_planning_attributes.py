"""Migração aditiva e reversível: tabela customer_planning_attributes.

O backend cria a tabela automaticamente via Base.metadata.create_all no startup.
Este script existe para dar uma operação de migração EXPLÍCITA e REVERSÍVEL,
conforme a política do projeto (alterações de banco aditivas + rollback).

Uso:
    python migrations_py/001_customer_planning_attributes.py up
    python migrations_py/001_customer_planning_attributes.py down   # rollback

- up   : cria a tabela (idempotente; não altera nem remove nada existente).
- down : remove APENAS a tabela customer_planning_attributes (rollback).
         Nenhuma coluna/tabela pré-existente é tocada.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import engine  # noqa: E402
from models import CustomerPlanningAttribute  # noqa: E402


def up() -> None:
    CustomerPlanningAttribute.__table__.create(bind=engine, checkfirst=True)
    print("[migration] up: customer_planning_attributes criada (checkfirst=True).")


def down() -> None:
    CustomerPlanningAttribute.__table__.drop(bind=engine, checkfirst=True)
    print("[migration] down: customer_planning_attributes removida (rollback).")


if __name__ == "__main__":
    action = (sys.argv[1] if len(sys.argv) > 1 else "up").lower()
    if action == "up":
        up()
    elif action == "down":
        down()
    else:
        print("uso: python migrations_py/001_customer_planning_attributes.py [up|down]")
        sys.exit(1)
