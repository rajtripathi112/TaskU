from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


TaskStatus = Literal["To Do", "In Progress", "Done"]
TaskPriority = Literal["Low", "Medium", "High"]
TaskStatusFilter = Literal["All", "To Do", "In Progress", "Done"]


class TaskFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=80)]
    description: Annotated[str, Field(max_length=400)] | None
    employee_name: Annotated[str, Field(min_length=1, max_length=60)]
    priority: TaskPriority
    status: TaskStatus
    start_date: str | None
    due_date: str

    @field_validator("start_date", "due_date")
    @classmethod
    def validate_date_format(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            parsed_date = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Date must be a valid YYYY-MM-DD date.") from exc
        if parsed_date.isoformat() != value:
            raise ValueError("Date must be in YYYY-MM-DD format.")
        return value

    @model_validator(mode="after")
    def validate_date_order(self) -> "TaskFields":
        if self.start_date is not None and self.start_date > self.due_date:
            raise ValueError("start_date cannot be later than due_date.")
        return self


class TaskCreate(TaskFields):
    description: Annotated[str, Field(max_length=400)] | None = None
    start_date: str | None = None


class TaskUpdate(TaskFields):
    pass


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    employee_name: str
    priority: TaskPriority | None
    status: TaskStatus | None
    start_date: str | None
    due_date: str
    created_at: str | None
    updated_at: str | None


class TaskPagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class TaskCounts(BaseModel):
    all: int
    to_do: int
    in_progress: int
    done: int


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    pagination: TaskPagination
    counts: TaskCounts
