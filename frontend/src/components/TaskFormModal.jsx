import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client.js";

const priorities = ["Low", "Medium", "High"];
const statuses = ["To Do", "In Progress", "Done"];

const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function initialValues(task) {
  return task
    ? {
        name: task.name,
        description: task.description || "",
        employee: task.employee,
        priority: task.priority || "",
        status: task.status || "",
        startDate: task.startDate || "",
        dueDate: task.dueDate || "",
      }
    : {
        name: "",
        description: "",
        employee: "",
        priority: "Medium",
        status: "To Do",
        startDate: today(),
        dueDate: "",
      };
}

function TaskFormModal({
  task,
  onClose,
  onSubmit,
  isSubmitting,
  dialogRef,
}) {
  const [values, setValues] = useState(() => initialValues(task));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const nameInputRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function update(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    const nextErrors = {};
    const name = values.name.trim();
    const employee = values.employee.trim();
    const description = values.description.trim();

    if (!name) nextErrors.name = "Task name is required.";
    else if (name.length > 80) nextErrors.name = "Task name must be 80 characters or fewer.";
    if (!employee) nextErrors.employee = "Employee name is required.";
    else if (employee.length > 60) {
      nextErrors.employee = "Employee name must be 60 characters or fewer.";
    }
    if (description.length > 400) {
      nextErrors.description = "Description must be 400 characters or fewer.";
    }
    if (!priorities.includes(values.priority)) {
      nextErrors.priority = "Select a supported priority.";
    }
    if (!statuses.includes(values.status)) {
      nextErrors.status = "Select a supported status.";
    }
    if (!values.dueDate) nextErrors.dueDate = "Due date is required.";
    else if (!isValidDate(values.dueDate)) {
      nextErrors.dueDate = "Enter a valid due date in YYYY-MM-DD format.";
    }
    if (values.startDate && !isValidDate(values.startDate)) {
      nextErrors.startDate = "Enter a valid start date in YYYY-MM-DD format.";
    } else if (
      values.startDate
      && values.dueDate
      && isValidDate(values.startDate)
      && isValidDate(values.dueDate)
      && values.startDate > values.dueDate
    ) {
      nextErrors.dueDate = "Due date cannot be before the start date.";
    }

    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(`f-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    submittingRef.current = true;
    try {
      await onSubmit({
        name,
        description,
        employee,
        priority: values.priority,
        status: values.status,
        startDate: values.startDate,
        dueDate: values.dueDate,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
        const firstInvalid = Object.keys(error.fieldErrors)[0];
        if (firstInvalid) document.getElementById(`f-${firstInvalid}`)?.focus();
      } else {
        setFormError(
          task
            ? "The task could not be updated. Please try again."
            : "The task could not be created. Please try again.",
        );
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (!isSubmitting && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-busy={isSubmitting}
      >
        <header>
          <h2 id="modal-title">{task ? "Edit Task" : "Add Task"}</h2>
          <button
            className="x"
            type="button"
            aria-label="Close"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form noValidate onSubmit={submit}>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="f full">
            <label htmlFor="f-name">Task name <i>*</i></label>
            <input
              ref={nameInputRef}
              id="f-name"
              name="name"
              maxLength={80}
              placeholder="e.g. Design login screen"
              autoComplete="off"
              required
              disabled={isSubmitting}
              value={values.name}
              onChange={update}
              className={errors.name ? "bad" : ""}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "e-name" : undefined}
            />
            <span className="err" id="e-name">{errors.name || ""}</span>
          </div>
          <div className="f full">
            <label htmlFor="f-description">Description</label>
            <textarea
              id="f-description"
              name="description"
              maxLength={400}
              placeholder="What needs to be done?"
              disabled={isSubmitting}
              value={values.description}
              onChange={update}
              className={errors.description ? "bad" : ""}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "e-description" : undefined}
            />
            <span className="err" id="e-description">{errors.description || ""}</span>
          </div>
          <div className="f">
            <label htmlFor="f-employee">Employee <i>*</i></label>
            <input
              id="f-employee"
              name="employee"
              maxLength={60}
              placeholder="e.g. Priya Nair"
              autoComplete="off"
              required
              disabled={isSubmitting}
              value={values.employee}
              onChange={update}
              className={errors.employee ? "bad" : ""}
              aria-invalid={Boolean(errors.employee)}
              aria-describedby={errors.employee ? "e-employee" : undefined}
            />
            <span className="err" id="e-employee">{errors.employee || ""}</span>
          </div>
          <div className="f">
            <label htmlFor="f-priority">Priority</label>
            <select
              id="f-priority"
              name="priority"
              disabled={isSubmitting}
              value={values.priority}
              onChange={update}
              className={errors.priority ? "bad" : ""}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={errors.priority ? "e-priority" : undefined}
            >
              {task && !priorities.includes(values.priority) && (
                <option value="">Select priority</option>
              )}
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
            <span className="err" id="e-priority">{errors.priority || ""}</span>
          </div>
          <div className="f">
            <label htmlFor="f-status">Status</label>
            <select
              id="f-status"
              name="status"
              disabled={isSubmitting}
              value={values.status}
              onChange={update}
              className={errors.status ? "bad" : ""}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? "e-status" : undefined}
            >
              {task && !statuses.includes(values.status) && (
                <option value="">Select status</option>
              )}
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <span className="err" id="e-status">{errors.status || ""}</span>
          </div>
          <div className="f" aria-hidden="true" />
          <div className="f">
            <label htmlFor="f-startDate">Start date</label>
            <input
              id="f-startDate"
              name="startDate"
              type="date"
              disabled={isSubmitting}
              value={values.startDate}
              onChange={update}
              className={errors.startDate ? "bad" : ""}
              aria-invalid={Boolean(errors.startDate)}
              aria-describedby={errors.startDate ? "e-startDate" : undefined}
            />
            <span className="err" id="e-startDate">{errors.startDate || ""}</span>
          </div>
          <div className="f">
            <label htmlFor="f-dueDate">Due date <i>*</i></label>
            <input
              id="f-dueDate"
              name="dueDate"
              type="date"
              required
              disabled={isSubmitting}
              value={values.dueDate}
              onChange={update}
              className={errors.dueDate ? "bad" : ""}
              aria-invalid={Boolean(errors.dueDate)}
              aria-describedby={errors.dueDate ? "e-dueDate" : undefined}
            />
            <span className="err" id="e-dueDate">{errors.dueDate || ""}</span>
          </div>
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? task ? "Saving…" : "Creating…"
                : task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default TaskFormModal;
