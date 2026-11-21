from collections.abc import Generator
from pathlib import Path

from sqlalchemy import URL, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


DATABASE_PATH = settings.database_path


def _ensure_database_file(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    if not database_path.is_file():
        raise FileNotFoundError(
            f"People Connect database not found: {database_path}. "
            "Initialize it explicitly from backend/schema.sql; application startup "
            "does not create or overwrite database files."
        )


_ensure_database_file(DATABASE_PATH)

DATABASE_URL = URL.create("sqlite", database=str(DATABASE_PATH))
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(
    dbapi_connection: object,
    _connection_record: object,
) -> None:
    _ = _connection_record
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys = ON")
    finally:
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()