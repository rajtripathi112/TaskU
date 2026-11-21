const statuses = ["All", "To Do", "In Progress", "Done"];

function StatusFilters({ selected, counts, onSelect }) {
  return (
    <div className="chips" role="group" aria-label="Filter by status">
      {statuses.map((status) => (
        <button
          className="chip"
          key={status}
          type="button"
          aria-pressed={status === selected}
          onClick={() => onSelect(status)}
        >
          {status} <b>{counts?.[status] ?? "—"}</b>
        </button>
      ))}
    </div>
  );
}

export default StatusFilters;
