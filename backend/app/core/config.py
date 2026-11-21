import os
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_path: Path
    cors_origins: tuple[str, ...]


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _parse_cors_origins(value: str, app_env: str) -> tuple[str, ...]:
    origins: list[str] = []
    allowed_schemes = {"https"} if app_env == "production" else {"http", "https"}
    for candidate in value.split(","):
        origin = candidate.strip()
        if not origin:
            continue
        if origin == "*":
            raise ValueError(
                "CORS_ORIGINS must list explicit HTTPS origins in production "
                "(HTTP or HTTPS in development)."
            )

        parsed = urlsplit(origin)
        if (
            parsed.scheme.lower() not in allowed_schemes
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                "CORS_ORIGINS must list explicit HTTPS origins in production "
                "(HTTP or HTTPS in development)."
            )
        try:
            parsed.port
        except ValueError as exc:
            raise ValueError("CORS_ORIGINS contains an invalid port.") from exc

        normalized_origin = f"{parsed.scheme.lower()}://{parsed.netloc}".rstrip("/")
        if normalized_origin not in origins:
            origins.append(normalized_origin)
    return tuple(origins)


def get_settings(environ: Mapping[str, str] | None = None) -> Settings:
    values = os.environ if environ is None else environ
    app_env = values.get("APP_ENV", "development").strip().lower()
    if app_env not in {"development", "production"}:
        raise ValueError("APP_ENV must be 'development' or 'production'.")

    configured_database_path = values.get("DATABASE_PATH", "").strip()
    if not configured_database_path:
        if app_env == "production":
            raise ValueError("DATABASE_PATH must be set in production.")
        database_path = BACKEND_ROOT / "people_connect.sqlite3"
    else:
        database_path = Path(configured_database_path).expanduser()
        if app_env == "production" and not database_path.is_absolute():
            raise ValueError("DATABASE_PATH must be an absolute path in production.")
        if not database_path.is_absolute():
            database_path = PROJECT_ROOT / database_path
        database_path = database_path.resolve()

    if app_env == "production":
        temporary_root = Path(tempfile.gettempdir()).resolve()
        if _is_within(database_path, temporary_root):
            raise ValueError("DATABASE_PATH must not be inside a temporary directory.")

    return Settings(
        app_env=app_env,
        database_path=database_path.resolve(),
        cors_origins=_parse_cors_origins(
            values.get("CORS_ORIGINS", ""),
            app_env,
        ),
    )


settings = get_settings()
