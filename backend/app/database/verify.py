from sqlalchemy import CheckConstraint, inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.database.connection import engine
from app.models.task import Task


def verify_database(database_engine: Engine = engine) -> int:
    inspector = inspect(database_engine)
    table_names = inspector.get_table_names()
    if "tasks" not in table_names:
        raise RuntimeError("The existing SQLite database does not contain a tasks table.")

    actual_columns = inspector.get_columns("tasks")
    model_columns = list(Task.__table__.columns)
    actual_names = [column["name"] for column in actual_columns]
    model_names = [column.name for column in model_columns]
    if actual_names != model_names:
        raise RuntimeError(
            f"tasks columns do not match the Task model: "
            f"database={actual_names}, model={model_names}"
        )

    for actual, model in zip(actual_columns, model_columns):
        if not isinstance(actual["type"], type(model.type)):
            raise RuntimeError(
                f"Column {model.name!r} has type {actual['type']} in SQLite "
                f"but {model.type} in the Task model."
            )
        if model.name != "id" and actual["nullable"] != model.nullable:
            raise RuntimeError(
                f"Column {model.name!r} nullability does not match the Task model."
            )

    actual_checks = {
        "".join(constraint["sqltext"].split())
        for constraint in inspector.get_check_constraints("tasks")
    }
    model_checks = {
        "".join(str(constraint.sqltext).split())
        for constraint in Task.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    if actual_checks != model_checks:
        raise RuntimeError(
            f"tasks CHECK constraints do not match the Task model: "
            f"database={actual_checks}, model={model_checks}"
        )

    primary_key = inspector.get_pk_constraint("tasks").get("constrained_columns")
    if primary_key != ["id"]:
        raise RuntimeError(f"Unexpected tasks primary key: {primary_key}")
    if inspector.get_foreign_keys("tasks"):
        raise RuntimeError("The tasks table unexpectedly defines foreign keys.")

    with database_engine.connect() as connection:
        table_sql = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'table' AND name = 'tasks'"
            )
        ).scalar_one()
        if "AUTOINCREMENT" not in table_sql.upper():
            raise RuntimeError("The tasks.id column is missing AUTOINCREMENT.")

        trigger_sql = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'trigger' AND name = :name"
            ),
            {"name": "tasks_set_updated_at"},
        ).scalar_one_or_none()
        if not trigger_sql or "AFTER UPDATE ON tasks" not in trigger_sql:
            raise RuntimeError("The tasks_set_updated_at trigger is missing or invalid.")

    with Session(database_engine) as session:
        return len(session.scalars(select(Task)).all())


if __name__ == "__main__":
    existing_rows = verify_database()
    print("SQLAlchemy connection: OK")
    print("tasks table and Task model: match")
    print("tasks_set_updated_at trigger: present")
    print(f"Existing task records: {existing_rows}")
