import { useEffect, useRef } from "react";

function DeleteConfirmation({
  task,
  onCancel,
  onConfirm,
  isDeleting,
  error,
  dialogRef,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (task) cancelButtonRef.current?.focus();
  }, [task]);

  if (!task) return null;
  return (
    <div className="scrim" onMouseDown={(event) => {
      if (!isDeleting && event.target === event.currentTarget) onCancel();
    }}>
      <section
        className="modal confirm-modal"
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="c-title"
        aria-busy={isDeleting}
      >
        <header><h2 id="c-title">Delete this task?</h2></header>
        <div className="cbody">
          <p>
            Delete <b>{task.name}</b> (task #{task.id}, assigned to {task.employee})?
            This cannot be undone.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="crow">
            <button
              ref={cancelButtonRef}
              className="btn ghost"
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="btn del"
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmation;
