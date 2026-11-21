import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.task import Task
from app.schemas.task import (
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskStatusFilter,
    TaskUpdate,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])
ERROR_RESPONSE = {
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
                "required": ["detail"],
            }
        }
    }
}
TASK_NOT_FOUND_RESPONSE = {
    **ERROR_RESPONSE,
    "description": "The requested task does not exist.",
}
DATABASE_ERROR_RESPONSE = {
    **ERROR_RESPONSE,
    "description": "The database operation could not be completed.",
}


def _next_updated_at(previous: str | None) -> str:
    current = datetime.now(timezone.utc)
    if previous:
        try:
            previous_datetime = datetime.fromisoformat(previous)
        except ValueError:
            previous_datetime = None

        if previous_datetime is not None:
            if previous_datetime.tzinfo is None:
                previous_datetime = previous_datetime.replace(tzinfo=timezone.utc)
            else:
                previous_datetime = previous_datetime.astimezone(timezone.utc)
            if current <= previous_datetime:
                current = previous_datetime + timedelta(microseconds=1)

    return current.strftime("%Y-%m-%d %H:%M:%S.%f")


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    responses={503: DATABASE_ERROR_RESPONSE},
)
def create_task(
    task_data: TaskCreate,
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = Task(**task_data.model_dump())
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while creating a task")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task could not be created at this time.",
        ) from exc
    return TaskResponse.model_validate(task)


@router.get("/", response_model=TaskListResponse, responses={503: DATABASE_ERROR_RESPONSE})
def list_tasks(
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[
        TaskStatusFilter | None,
        Query(alias="status"),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=5)] = 5,
) -> TaskListResponse:
    selected_status = status_filter if status_filter != "All" else None
    task_query = select(Task).order_by(Task.id.desc())
    total_query = select(func.count(Task.id))

    if selected_status is not None:
        task_query = task_query.where(Task.status == selected_status)
        total_query = total_query.where(Task.status == selected_status)

    task_query = task_query.offset((page - 1) * page_size).limit(page_size)
    counts_query = select(
        func.count(Task.id).label("all"),
        func.count(case((Task.status == "To Do", 1))).label("to_do"),
        func.count(case((Task.status == "In Progress", 1))).label("in_progress"),
        func.count(case((Task.status == "Done", 1))).label("done"),
    )

    try:
        items = db.scalars(task_query).all()
        total = db.scalar(total_query) or 0
        counts = db.execute(counts_query).one()
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing tasks")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tasks are temporarily unavailable.",
        ) from exc

    return TaskListResponse(
        items=items,
        pagination={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
        counts={
            "all": counts.all,
            "to_do": counts.to_do,
            "in_progress": counts.in_progress,
            "done": counts.done,
        },
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    responses={404: TASK_NOT_FOUND_RESPONSE, 503: DATABASE_ERROR_RESPONSE},
)
def get_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    try:
        task = db.get(Task, task_id)
    except SQLAlchemyError as exc:
        logger.exception("Database error while retrieving task %s", task_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task is temporarily unavailable.",
        ) from exc

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    return TaskResponse.model_validate(task)


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
    responses={404: TASK_NOT_FOUND_RESPONSE, 503: DATABASE_ERROR_RESPONSE},
)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    try:
        task = db.get(Task, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found.",
            )

        for field, value in task_data.model_dump().items():
            setattr(task, field, value)
        task.updated_at = _next_updated_at(task.updated_at)
        db.commit()
        db.refresh(task)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while updating task %s", task_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task could not be updated at this time.",
        ) from exc

    return TaskResponse.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses={404: TASK_NOT_FOUND_RESPONSE, 503: DATABASE_ERROR_RESPONSE},
)
def delete_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        task = db.get(Task, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found.",
            )

        db.delete(task)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while deleting task %s", task_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task could not be deleted at this time.",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)