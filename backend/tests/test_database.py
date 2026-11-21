from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.database.connection import _ensure_database_file
from app.database.verify import verify_database
from app.models.task import Task


def test_database_startup_creates_parent_without_creating_or_overwriting_file(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "persistent" / "people_connect.sqlite3"

    with pytest.raises(FileNotFoundError, match="does not create or overwrite"):
        _ensure_database_file(database_path)

    assert database_path.parent.is_dir()
    assert not database_path.exists()

    database_path.write_bytes(b"existing database")
    _ensure_database_file(database_path)
    assert database_path.read_bytes() == b"existing database"


def test_temporary_database_is_mapped_without_writes(
    temporary_engine: Engine,
) -> None:
    verify_database(temporary_engine)


def test_temporary_database_crud_and_updated_at_trigger(
    temporary_engine: Engine,
) -> None:
    with Session(temporary_engine) as session:
        task = Task(
            name="Temporary verification task",
            employee_name="Test employee",
            priority="Medium",
            status="To Do",
            due_date="2026-12-31",
        )
        session.add(task)
        session.commit()
        session.refresh(task)

        assert task.id is not None
        assert task.created_at is not None
        assert task.updated_at is not None
        assert session.scalars(select(Task).where(Task.id == task.id)).one().name == (
            "Temporary verification task"
        )

        task.updated_at = "2000-01-01 00:00:00"
        session.commit()
        task.name = "Updated temporary task"
        session.commit()
        session.refresh(task)
        assert task.updated_at != "2000-01-01 00:00:00"

        task_id = task.id
        session.delete(task)
        session.commit()
        assert session.get(Task, task_id) is None


def test_health_endpoint_uses_database_dependency(
    client: TestClient,
) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
