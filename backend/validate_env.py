"""Validação obrigatória de variáveis de ambiente no startup."""
import os
import sys

from logging_manager import app_logger


def validate_env() -> None:
    env = os.getenv("NODE_ENV", "development")
    jwt_secret = os.getenv("JWT_SECRET", "changeme")
    database_url = os.getenv("DATABASE_URL", "")
    use_mock = os.getenv("USE_MOCK", "false").lower() in ("1", "true", "yes")

    app_logger.info(
        "Validação de ambiente iniciada",
        extra={"env": env, "use_mock": use_mock, "database_url_set": bool(database_url)},
    )

    errors: list[str] = []

    if env == "production":
        if not jwt_secret or jwt_secret == "changeme":
            errors.append("JWT_SECRET não pode ser 'changeme' ou vazio em produção.")

        if not database_url:
            errors.append("DATABASE_URL é obrigatória em produção.")

        if use_mock:
            errors.append("USE_MOCK deve ser false em produção.")

    if errors:
        for err in errors:
            app_logger.error(f"[ENV] {err}")
        app_logger.error(
            "Ambiente inválido para produção. Corrija as variáveis acima e reinicie."
        )
        sys.exit(1)

    app_logger.info(
        "Validação de ambiente concluída com sucesso",
        extra={"env": env},
    )
