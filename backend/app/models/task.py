from typing import Optional

from sqlalchemy import CheckConstraint, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("length(name) <= 80"),
        CheckConstraint("description IS NULL OR length(description) <= 400"),
        CheckConstraint("length(employee_name) <= 60"),
        CheckConstraint("priority IN ('Low', 'Medium', 'High')"),
        CheckConstraint("status IN ('To Do', 'In Progress', 'Done')"),
        CheckConstraint(
            "start_date IS NULL OR ("
            "start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' "
            "AND date(start_date, '+0 days') = start_date)"
        ),
        CheckConstraint(
            "due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' "
            "AND date(due_date, '+0 days') = due_date"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    employee_name: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        server_default=text("CURRENT_TIMESTAMP"),
    )