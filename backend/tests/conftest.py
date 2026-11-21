import sqlite3
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import URL, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.main import app


@pytest.fixture
def temporary_engine(tmp_path: Path) -> Generator[Engine, None, None]:
    database_path = tmp_path / "people_connect_test.sqlite3"
    schema_path = Path(__file__).resolve().parents[1] / "schema.sql"
    sqlite_connection = sqlite3.connect(database_path)
    try:
        sqlite_connection.executescript(schema_path.read_text(encoding="utf-8"))
    finally:
        sqlite_connection.close()

    test_engine = create_engine(
        URL.create("sqlite", database=str(database_path)),
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(test_engine, "connect")
    def enable_foreign_keys(
        dbapi_connection: object,
        _connection_record: object,
    ) -> None:
        _ = _connection_record
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys = ON")
        finally:
            cursor.close()

    try:
        yield test_engine
    finally:
        test_engine.dispose()


@pytest.fixture
def client(temporary_engine: Engine) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        with Session(temporary_engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
