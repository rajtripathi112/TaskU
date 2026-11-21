from pathlib import Path
import tempfile

import pytest

from app.core.config import BACKEND_ROOT, get_settings


def test_development_settings_preserve_existing_database_default() -> None:
    settings = get_settings({})

    assert settings.app_env == "development"
    assert settings.database_path == BACKEND_ROOT / "people_connect.sqlite3"
    assert settings.cors_origins == ()


def test_production_requires_an_absolute_database_path() -> None:
    with pytest.raises(ValueError, match="DATABASE_PATH must be set"):
        get_settings({"APP_ENV": "production"})

    with pytest.raises(ValueError, match="absolute path"):
        get_settings(
            {
                "APP_ENV": "production",
                "DATABASE_PATH": "data/people_connect.sqlite3",
            }
        )


def test_production_rejects_database_paths_inside_temporary_directory(
    tmp_path: Path,
) -> None:
    with pytest.raises(ValueError, match="temporary directory"):
        get_settings(
            {
                "APP_ENV": "production",
                "DATABASE_PATH": str(tmp_path / "people_connect.sqlite3"),
            }
        )


def test_production_accepts_persistent_path_and_normalizes_cors_origins() -> None:
    database_path = (
        Path(tempfile.gettempdir()).resolve().parent
        / "people-connect-production"
        / "people_connect.sqlite3"
    )
    settings = get_settings(
        {
            "APP_ENV": "production",
            "DATABASE_PATH": str(database_path),
            "CORS_ORIGINS": "https://app.example.test/, https://api.example.test",
        }
    )

    assert settings.app_env == "production"
    assert settings.database_path == database_path.resolve()
    assert settings.cors_origins == (
        "https://app.example.test",
        "https://api.example.test",
    )


def test_development_allows_local_http_cors_origin() -> None:
    settings = get_settings({"CORS_ORIGINS": "http://localhost:5173"})

    assert settings.cors_origins == ("http://localhost:5173",)


@pytest.mark.parametrize(
    "cors_origins",
    [
        "*",
        "https://app.example.test/path",
        "ftp://app.example.test",
        "https://app.example.test:invalid",
    ],
)
def test_cors_origins_must_be_explicit_http_origins(cors_origins: str) -> None:
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        get_settings({"CORS_ORIGINS": cors_origins})


def test_production_cors_origin_must_use_https() -> None:
    database_path = (
        Path(tempfile.gettempdir()).resolve().parent
        / "people-connect-production"
        / "people_connect.sqlite3"
    )
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        get_settings(
            {
                "APP_ENV": "production",
                "DATABASE_PATH": str(database_path),
                "CORS_ORIGINS": "http://app.example.test",
            }
        )
