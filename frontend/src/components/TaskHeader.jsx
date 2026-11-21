function TaskHeader({ taskCount, onAddTask, addButtonRef }) {
  return (
    <div className="head">
      <div>
        <h1>Tasks</h1>
        <p>Total tasks: {taskCount ?? "—"}</p>
      </div>
      <button
        ref={addButtonRef}
        className="btn"
        type="button"
        onClick={onAddTask}
      >
        + Add Task
      </button>
    </div>
  );
}

export default TaskHeader;
