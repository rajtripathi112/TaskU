import TaskRow from "./TaskRow.jsx";

function TaskList({
  tasks,
  filter,
  loading,
  error,
  onAddTask,
  onRetry,
  onView,
  onEdit,
  onDelete,
}) {
  if (loading) {
    return (
      <div className="empty" role="status" aria-live="polite">
        <p>Loading tasks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty error-state" role="alert">
        <p>{error}</p>
        <button className="btn" type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="empty" aria-live="polite">
        <p>
          {filter === "All"
            ? "No tasks yet. Add your first task to see it here."
            : `No tasks with status "${filter}".`}
        </p>
        {filter === "All" && (
          <button className="btn" type="button" onClick={onAddTask}>
            + Add Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="list" role="table" aria-label="Tasks" aria-live="polite">
      <div className="lh" role="row">
        {["Task", "Employee", "Priority", "Status", "Start", "Due", "Actions"].map(
          (heading) => (
            <span role="columnheader" key={heading}>
              {heading}
            </span>
          ),
        )}
      </div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default TaskList;
