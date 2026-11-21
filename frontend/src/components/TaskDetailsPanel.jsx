import { useEffect } from "react";

function formatDate(value) {
  if (!value) return "No date";
  const [year, month, day] = value.split(/[T ]/)[0].split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !months[month - 1] || !day) return value;
  return `${day} ${months[month - 1]} ${year}`;
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const [date, time] = value.split(/[T ]/);
  return `${formatDate(date)}${time ? `, ${time.slice(0, 5)}` : ""}`;
}

function localDateString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function TaskDetailsPanel({
  isOpen,
  task,
  loading,
  error,
  onClose,
  onEdit,
  onDelete,
  panelRef,
}) {
  useEffect(() => {
    if (isOpen) panelRef.current?.querySelector("button")?.focus();
  }, [isOpen, panelRef]);

  if (!isOpen) return null;
  const overdue =
    task?.status !== "Done" && task?.dueDate && task.dueDate < localDateString();
  const displayStatus = task?.status || "Not set";
  const displayPriority = task?.priority || "Not set";
  const statusClass = task?.status ? task.status.replace(/ /g, "-") : "Not-Set";
  const priorityClass = task?.priority || "Not-Set";

  return (
    <>
      <button className="pscrim" type="button" aria-label="Close task details" onClick={onClose} />
      <aside
        className="panel open"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="p-title"
        aria-busy={loading}
      >
        <header>
          <div>
            <span className="ptag">Task details</span>
            <h2 id="p-title">
              {task?.name ?? (loading ? "Loading task..." : error ? "Task unavailable" : "Task details")}
            </h2>
          </div>
          <button className="x" type="button" aria-label="Close details" onClick={onClose}>×</button>
        </header>
        <div className="pbody">
          {loading && <p className="panel-state" role="status">Loading task details…</p>}
          {error && <p className="panel-state panel-state-error" role="alert">{error}</p>}
          {task && (
            <>
              <div className="pills">
                <span className={`pill st-${statusClass}`}>{displayStatus}</span>
                <span className={`pill pri-${priorityClass}`}>{displayPriority} priority</span>
              </div>
              <section>
                <h3>Description</h3>
                <p className="pdesc">{task.description || "No description was added for this task."}</p>
              </section>
              <dl className="meta">
                {[
                  ["Employee", task.employee],
                  ["Status", displayStatus],
                  ["Start date", formatDate(task.startDate)],
                  ["Due date", `${formatDate(task.dueDate)}${overdue ? " (overdue)" : ""}`],
                  ["Created date", formatDateTime(task.createdAt)],
                  ["Updated date", formatDateTime(task.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
        <footer>
          <button
            className="btn ghost"
            type="button"
            disabled={!task}
            onClick={() => onEdit(task)}
          >
            Edit
          </button>
          <button
            className="btn danger"
            type="button"
            disabled={!task}
            onClick={() => onDelete(task)}
          >
            Delete
          </button>
        </footer>
      </aside>
    </>
  );
}

export default TaskDetailsPanel;
