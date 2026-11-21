import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models.task import Task


def valid_task_payload() -> dict[str, str]:
    return {
        "name": "Prepare project report",
        "description": "Summarize this week's progress.",
        "employee_name": "Alex Morgan",
        "priority": "High",
        "status": "To Do",
        "start_date": "2026-11-15",
        "due_date": "2026-11-20",
    }


def insert_tasks(
    temporary_engine: Engine,
    statuses: list[str],
) -> list[int]:
    with Session(temporary_engine) as session:
        tasks = [
            Task(
                name=f"Task {index + 1}",
                description=f"Description {index + 1}",
                employee_name=f"Employee {index + 1}",
                priority="Medium",
                status=task_status,
                start_date="2026-01-01",
                due_date="2026-12-31",
            )
            for index, task_status in enumerate(statuses)
        ]
        session.add_all(tasks)
        session.commit()
        return [task.id for task in tasks]


def test_list_tasks_returns_empty_response(client: TestClient) -> None:
    response = client.get("/tasks/")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "pagination": {"page": 1, "page_size": 5, "total": 0, "total_pages": 0},
        "counts": {"all": 0, "to_do": 0, "in_progress": 0, "done": 0},
    }


def test_openapi_documents_task_request_shapes_and_error_responses(
    client: TestClient,
) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    spec = response.json()
    paths = spec["paths"]
    schemas = spec["components"]["schemas"]

    assert set(schemas["TaskCreate"]["required"]) == {
        "name",
        "employee_name",
        "priority",
        "status",
        "due_date",
    }
    assert set(schemas["TaskUpdate"]["required"]) == {
        "name",
        "description",
        "employee_name",
        "priority",
        "status",
        "start_date",
        "due_date",
    }
    for path, method in (
        ("/tasks/", "get"),
        ("/tasks/", "post"),
        ("/tasks/{task_id}", "get"),
        ("/tasks/{task_id}", "put"),
        ("/tasks/{task_id}", "delete"),
    ):
        assert "503" in paths[path][method]["responses"]

    for method in ("get", "put", "delete"):
        assert "404" in paths["/tasks/{task_id}"][method]["responses"]


def test_list_tasks_returns_task_fields_and_counts(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    insert_tasks(
        temporary_engine,
        [
            "To Do",
            "In Progress",
            "Done",
        ],
    )

    response = client.get("/tasks/")
    body = response.json()

    assert response.status_code == 200
    assert body["pagination"] == {
        "page": 1,
        "page_size": 5,
        "total": 3,
        "total_pages": 1,
    }
    assert body["counts"] == {"all": 3, "to_do": 1, "in_progress": 1, "done": 1}
    assert set(body["items"][0]) == {
        "id",
        "name",
        "description",
        "employee_name",
        "priority",
        "status",
        "start_date",
        "due_date",
        "created_at",
        "updated_at",
    }
    assert [task["name"] for task in body["items"]] == [
        "Task 3",
        "Task 2",
        "Task 1",
    ]


def test_create_task_returns_created_task_and_persists_it(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    payload = valid_task_payload()

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == payload["name"]
    assert body["description"] == payload["description"]
    assert body["employee_name"] == payload["employee_name"]
    assert body["priority"] == payload["priority"]
    assert body["status"] == payload["status"]
    assert body["start_date"] == payload["start_date"]
    assert body["due_date"] == payload["due_date"]
    assert body["created_at"] is not None
    assert body["updated_at"] is not None
    with Session(temporary_engine) as session:
        persisted = session.get(Task, body["id"])
        assert persisted is not None
        assert persisted.name == payload["name"]


def test_create_task_accepts_optional_fields_as_omitted(
    client: TestClient,
) -> None:
    payload = valid_task_payload()
    payload.pop("description")
    payload.pop("start_date")

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 201
    assert response.json()["description"] is None
    assert response.json()["start_date"] is None


@pytest.mark.parametrize(
    "missing_field",
    ["name", "employee_name", "due_date"],
)
def test_create_task_rejects_missing_required_fields(
    client: TestClient,
    missing_field: str,
) -> None:
    payload = valid_task_payload()
    payload.pop(missing_field)

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("priority", "Urgent"),
        ("status", "Blocked"),
        ("start_date", "2026-2-01"),
        ("start_date", "2026-02-30"),
        ("due_date", "2026/11/20"),
        ("due_date", "2026-02-30"),
    ],
)
def test_create_task_rejects_invalid_values(
    client: TestClient,
    field: str,
    value: str,
) -> None:
    payload = valid_task_payload()
    payload[field] = value

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 422


def test_create_task_rejects_start_date_after_due_date(
    client: TestClient,
) -> None:
    payload = valid_task_payload()
    payload["start_date"] = "2026-11-21"

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "N" * 81),
        ("employee_name", "E" * 61),
        ("description", "D" * 401),
    ],
)
def test_create_task_rejects_fields_exceeding_maximum_length(
    client: TestClient,
    field: str,
    value: str,
) -> None:
    payload = valid_task_payload()
    payload[field] = value

    response = client.post("/tasks/", json=payload)

    assert response.status_code == 422


def test_create_task_database_error_returns_generic_response(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import OperationalError

    def fail_commit(*args: object, **kwargs: object) -> None:
        raise OperationalError("INSERT ...", {}, RuntimeError("private database detail"))

    monkeypatch.setattr(Session, "commit", fail_commit)

    response = client.post("/tasks/", json=valid_task_payload())

    assert response.status_code == 503
    assert response.json() == {"detail": "Task could not be created at this time."}


def test_get_task_returns_all_task_fields(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_id = insert_tasks(temporary_engine, ["In Progress"])[0]

    response = client.get(f"/tasks/{task_id}")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "id",
        "name",
        "description",
        "employee_name",
        "priority",
        "status",
        "start_date",
        "due_date",
        "created_at",
        "updated_at",
    }
    assert body["id"] == task_id
    assert body["name"] == "Task 1"
    assert body["description"] == "Description 1"
    assert body["employee_name"] == "Employee 1"
    assert body["priority"] == "Medium"
    assert body["status"] == "In Progress"
    assert body["start_date"] == "2026-01-01"
    assert body["due_date"] == "2026-12-31"
    assert body["created_at"] is not None
    assert body["updated_at"] is not None


def test_get_task_returns_404_for_missing_task(client: TestClient) -> None:
    response = client.get("/tasks/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found."}


def test_get_task_database_error_returns_generic_response(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import OperationalError

    def fail_get(*args: object, **kwargs: object) -> None:
        raise OperationalError("SELECT ...", {}, RuntimeError("private database detail"))

    monkeypatch.setattr(Session, "get", fail_get)

    response = client.get("/tasks/1")

    assert response.status_code == 503
    assert response.json() == {"detail": "Task is temporarily unavailable."}


def test_update_task_changes_all_editable_fields_and_preserves_metadata(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_id = insert_tasks(temporary_engine, ["To Do"])[0]
    with Session(temporary_engine) as session:
        task = session.get(Task, task_id)
        assert task is not None
        task.created_at = "2000-01-01 00:00:00"
        task.updated_at = "2000-01-01 00:00:00"
        session.commit()

    payload = {
        "name": "Revised project report",
        "description": "Updated details",
        "employee_name": "Jordan Lee",
        "priority": "Low",
        "status": "In Progress",
        "start_date": "2026-02-01",
        "due_date": "2026-03-15",
    }

    response = client.put(f"/tasks/{task_id}", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert {field: body[field] for field in payload} == payload
    assert body["id"] == task_id
    assert body["created_at"] == "2000-01-01 00:00:00"
    assert body["updated_at"] != "2000-01-01 00:00:00"
    with Session(temporary_engine) as session:
        persisted = session.get(Task, task_id)
        assert persisted is not None
        assert persisted.name == payload["name"]
        assert persisted.status == payload["status"]


def test_update_task_changes_updated_at_when_database_timestamp_is_unchanged(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_id = insert_tasks(temporary_engine, ["To Do"])[0]
    fixed_timestamp = "2000-01-01 00:00:00"
    with temporary_engine.begin() as connection:
        connection.execute(
            text("UPDATE tasks SET updated_at = :timestamp WHERE id = :task_id"),
            {"timestamp": fixed_timestamp, "task_id": task_id},
        )
        connection.execute(text("DROP TRIGGER tasks_set_updated_at"))
        connection.execute(
            text(
                "CREATE TRIGGER tasks_set_updated_at AFTER UPDATE ON tasks "
                "FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at "
                f"BEGIN UPDATE tasks SET updated_at = '{fixed_timestamp}' "
                "WHERE id = NEW.id; END"
            )
        )

    response = client.put(f"/tasks/{task_id}", json=valid_task_payload())

    assert response.status_code == 200
    assert response.json()["updated_at"] != fixed_timestamp
    with Session(temporary_engine) as session:
        persisted = session.get(Task, task_id)
        assert persisted is not None
        assert persisted.updated_at == response.json()["updated_at"]


def test_update_task_can_clear_nullable_fields(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_id = insert_tasks(temporary_engine, ["To Do"])[0]
    payload = {
        "name": "Task without optional values",
        "description": None,
        "employee_name": "Employee 1",
        "priority": "Medium",
        "status": "To Do",
        "start_date": None,
        "due_date": "2026-12-31",
    }

    response = client.put(f"/tasks/{task_id}", json=payload)

    assert response.status_code == 200
    assert response.json()["description"] is None
    assert response.json()["start_date"] is None


def test_update_task_returns_404_for_missing_task(client: TestClient) -> None:
    response = client.put("/tasks/999", json=valid_task_payload())

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found."}


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("priority", "Urgent"),
        ("status", "Blocked"),
        ("start_date", "2026/11/15"),
        ("due_date", "2026-02-30"),
    ],
)
def test_update_task_rejects_invalid_values(
    client: TestClient,
    field: str,
    value: str,
) -> None:
    payload = valid_task_payload()
    payload[field] = value

    response = client.put("/tasks/1", json=payload)

    assert response.status_code == 422


def test_update_task_rejects_start_date_after_due_date(
    client: TestClient,
) -> None:
    payload = valid_task_payload()
    payload["start_date"] = "2026-11-21"

    response = client.put("/tasks/1", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "missing_field",
    [
        "name",
        "description",
        "employee_name",
        "priority",
        "status",
        "start_date",
        "due_date",
    ],
)
def test_update_task_requires_all_editable_fields(
    client: TestClient,
    missing_field: str,
) -> None:
    payload = valid_task_payload()
    payload.pop(missing_field)

    response = client.put("/tasks/1", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("protected_field", ["id", "created_at", "updated_at"])
def test_update_task_rejects_protected_fields(
    client: TestClient,
    protected_field: str,
) -> None:
    payload = valid_task_payload()
    payload[protected_field] = "not-client-editable"

    response = client.put("/tasks/1", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "N" * 81),
        ("description", "D" * 401),
        ("employee_name", "E" * 61),
    ],
)
def test_update_task_rejects_fields_exceeding_maximum_length(
    client: TestClient,
    field: str,
    value: str,
) -> None:
    payload = valid_task_payload()
    payload[field] = value

    response = client.put("/tasks/1", json=payload)

    assert response.status_code == 422


def test_update_task_database_error_returns_generic_response(
    client: TestClient,
    temporary_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import OperationalError

    insert_tasks(temporary_engine, ["To Do"])

    def fail_commit(*args: object, **kwargs: object) -> None:
        raise OperationalError("UPDATE ...", {}, RuntimeError("private database detail"))

    monkeypatch.setattr(Session, "commit", fail_commit)

    response = client.put("/tasks/1", json=valid_task_payload())

    assert response.status_code == 503
    assert response.json() == {"detail": "Task could not be updated at this time."}


def test_delete_task_removes_existing_task(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_id = insert_tasks(temporary_engine, ["To Do"])[0]

    response = client.delete(f"/tasks/{task_id}")

    assert response.status_code == 204
    assert response.content == b""
    with Session(temporary_engine) as session:
        assert session.get(Task, task_id) is None


def test_delete_task_returns_404_for_missing_task(client: TestClient) -> None:
    response = client.delete("/tasks/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found."}


def test_repeated_delete_returns_404(client: TestClient, temporary_engine: Engine) -> None:
    task_id = insert_tasks(temporary_engine, ["To Do"])[0]

    first_response = client.delete(f"/tasks/{task_id}")
    second_response = client.delete(f"/tasks/{task_id}")

    assert first_response.status_code == 204
    assert second_response.status_code == 404


def test_delete_task_database_error_returns_generic_response(
    client: TestClient,
    temporary_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import OperationalError

    insert_tasks(temporary_engine, ["To Do"])

    def fail_commit(*args: object, **kwargs: object) -> None:
        raise OperationalError("DELETE ...", {}, RuntimeError("private database detail"))

    monkeypatch.setattr(Session, "commit", fail_commit)

    response = client.delete("/tasks/1")

    assert response.status_code == 503
    assert response.json() == {"detail": "Task could not be deleted at this time."}


@pytest.mark.parametrize(
    ("task_status", "count_key", "expected_total"),
    [
        ("To Do", "to_do", 2),
        ("In Progress", "in_progress", 1),
        ("Done", "done", 1),
    ],
)
def test_status_filter_returns_only_matching_tasks(
    client: TestClient,
    temporary_engine: Engine,
    task_status: str,
    count_key: str,
    expected_total: int,
) -> None:
    insert_tasks(
        temporary_engine,
        [
            "To Do",
            "In Progress",
            "Done",
            "To Do",
        ],
    )

    response = client.get("/tasks/", params={"status": task_status})
    body = response.json()

    assert response.status_code == 200
    assert all(task["status"] == task_status for task in body["items"])
    assert body["pagination"]["total"] == expected_total
    assert body["counts"] == {"all": 4, "to_do": 2, "in_progress": 1, "done": 1}
    assert body["counts"][count_key] > 0


def test_all_status_filter_matches_unfiltered_results(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    insert_tasks(temporary_engine, ["To Do", "Done"])

    response = client.get("/tasks/", params={"status": "All"})

    assert response.status_code == 200
    assert response.json()["pagination"]["total"] == 2
    assert len(response.json()["items"]) == 2


def test_counts_ignore_selected_status_filter(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    insert_tasks(
        temporary_engine,
        ["To Do", "To Do", "Done"],
    )

    response = client.get("/tasks/", params={"status": "Done"})

    assert response.status_code == 200
    assert response.json()["pagination"]["total"] == 1
    assert response.json()["counts"] == {
        "all": 3,
        "to_do": 2,
        "in_progress": 0,
        "done": 1,
    }


def test_pagination_is_limited_and_newest_ids_come_first(
    client: TestClient,
    temporary_engine: Engine,
) -> None:
    task_ids = insert_tasks(
        temporary_engine,
        ["To Do"] * 7,
    )

    first_page = client.get("/tasks/", params={"page": 1, "page_size": 5}).json()
    second_page = client.get("/tasks/", params={"page": 2, "page_size": 5}).json()

    assert first_page["pagination"] == {
        "page": 1,
        "page_size": 5,
        "total": 7,
        "total_pages": 2,
    }
    assert [task["id"] for task in first_page["items"]] == list(reversed(task_ids[-5:]))
    assert [task["id"] for task in second_page["items"]] == list(
        reversed(task_ids[:2])
    )
    assert len(second_page["items"]) == 2


@pytest.mark.parametrize(
    "params",
    [
        {"status": "Blocked"},
        {"page": 0},
        {"page": -1},
        {"page_size": 0},
        {"page_size": 6},
    ],
)
def test_invalid_filters_and_pagination_return_422(
    client: TestClient,
    params: dict[str, str | int],
) -> None:
    response = client.get("/tasks/", params=params)

    assert response.status_code == 422


def test_database_errors_return_generic_service_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy.exc import OperationalError

    def fail_query(*args: object, **kwargs: object) -> None:
        raise OperationalError("SELECT ...", {}, RuntimeError("private database detail"))

    monkeypatch.setattr(Session, "scalars", fail_query)

    response = client.get("/tasks/")

    assert response.status_code == 503
    assert response.json() == {"detail": "Tasks are temporarily unavailable."}
