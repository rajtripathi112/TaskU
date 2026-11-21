import Icon from "./Icon.jsx";

function formatDate(value) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[month - 1]} ${year}`;
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TaskRow({ task, onView, onEdit, onDelete }) {
  const overdue =
    task.status !== "Done" && task.dueDate && task.dueDate < localDateString();
  const displayStatus = task.status || "Not set";
  const displayPriority = task.priority || "Not set";
  const statusClass = task.status ? task.status.replace(/ /g, "-") : "Not-Set";
  const priorityClass = task.priority ? task.priority : "Not-Set";

  return (
    <div className="row" role="row">
      <div className="cell tname" role="cell" data-label="Task">
        <h3>{task.name}</h3>
        <p className="desc">{task.description || "No description."}</p>
      </div>
      <div className="cell" role="cell" data-label="Employee">
        <span className="pm">
          <span className="av">{initials(task.employee)}</span>
          <span>{task.employee}</span>
        </span>
      </div>
      <div className="cell" role="cell" data-label="Priority">
        <span className={`pill pri-${priorityClass}`}>{displayPriority}</span>
      </div>
      <div className="cell" role="cell" data-label="Status">
        <span className={`pill st-${statusClass}`}>{displayStatus}</span>
      </div>
      <div className="cell" role="cell" data-label="Start">
        {formatDate(task.startDate)}
      </div>
      <div
        className={`cell${overdue ? " over" : ""}`}
        role="cell"
        data-label="Due"
      >
        {formatDate(task.dueDate)}{overdue ? " · Overdue" : ""}
      </div>
      <div className="cell acts-cell" role="cell" data-label="Actions">
        <div className="acts">
          <button
            className="act"
            type="button"
            aria-label={`View task: ${task.name}`}
            title="View"
            onClick={() => onView(task.id)}
          >
            <Icon name="view" />
            <span>View</span>
          </button>
          <button
            className="act"
            type="button"
            aria-label={`Edit task: ${task.name}`}
            title="Edit"
            onClick={() => onEdit(task)}
          >
            <Icon name="edit" />
            <span>Edit</span>
          </button>
          <button
            className="act del"
            type="button"
            aria-label={`Delete task: ${task.name}`}
            title="Delete"
            onClick={() => onDelete(task)}
          >
            <Icon name="delete" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskRow;
