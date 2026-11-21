const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL =
  (configuredApiBaseUrl || "/api").replace(/\/+$/, "") || "/api";
export const DEFAULT_TASK_PAGE_SIZE = 5;

const taskStatuses = ["To Do", "In Progress", "Done"];
const taskPriorities = ["Low", "Medium", "High"];

export class ApiError extends Error {
  constructor(message, status = null, fieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function responseMessage(status, resource) {
  if (status === 404) {
    return resource === "task"
      ? "This task could not be found. It may have been removed."
      : "The task service could not be found. Please try again later.";
  }
  if (status === 422) {
    return resource === "task"
      ? "The task request was invalid. Please try again."
      : "The task list request was invalid. Please try again.";
  }
  if (status === 503) {
    return resource === "task"
      ? "Task details are temporarily unavailable. Please try again shortly."
      : "Tasks are temporarily unavailable. Please try again shortly.";
  }
  return resource === "task"
    ? "Task details could not be loaded. Please try again."
    : "Tasks could not be loaded. Please try again.";
}

function taskFieldErrors(detail) {
  if (!Array.isArray(detail)) return {};

  const fieldMap = {
    name: ["name", "Task name", 80],
    description: ["description", "Description", 400],
    employee_name: ["employee", "Employee name", 60],
    priority: ["priority", "Priority"],
    status: ["status", "Status"],
    start_date: ["startDate", "Start date"],
    due_date: ["dueDate", "Due date"],
  };
  const errors = {};

  for (const item of detail) {
    if (!isObject(item) || !Array.isArray(item.loc)) continue;
    const apiField = item.loc.find((part) => Object.prototype.hasOwnProperty.call(fieldMap, part));
    const field = apiField || (
      typeof item.msg === "string"
      && item.msg.includes("start_date cannot be later than due_date")
        ? "due_date"
        : null
    );
    if (!field) continue;

    const [formField, label, maxLength] = fieldMap[field];
    let message = "Please check this field.";
    if (item.type === "missing" || item.type === "string_too_short") {
      message = `${label} is required.`;
    } else if (item.type === "string_too_long") {
      message = `${label} must be ${maxLength} characters or fewer.`;
    } else if (item.type === "literal_error") {
      message = `Select a supported ${label.toLowerCase()}.`;
    } else if (
      item.type === "value_error"
      && typeof item.msg === "string"
      && item.msg.includes("start_date cannot be later than due_date")
    ) {
      message = "Due date cannot be before the start date.";
    } else if (item.type === "value_error" && ["start_date", "due_date"].includes(field)) {
      message = `Enter a valid ${label.toLowerCase()} in YYYY-MM-DD format.`;
    }

    errors[formField] = errors[formField]
      ? `${errors[formField]} ${message}`
      : message;
  }

  return errors;
}

async function getJson(path, signal, resource = "tasks") {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new ApiError(responseMessage(response.status, resource), response.status);
  }

  let body;
  try {
    body = await response.text();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("The server response could not be read. Please try again.", response.status);
  }
  if (!body.trim()) {
    throw new ApiError("The server returned an empty response. Please try again.", response.status);
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError("The server returned an invalid response. Please try again.", response.status);
  }
}

async function writeJson(method, path, payload) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }

  let body = "";
  try {
    body = await response.text();
  } catch {
    throw new ApiError("The server response could not be read. Please try again.", response.status);
  }

  let data = null;
  if (body.trim()) {
    try {
      data = JSON.parse(body);
    } catch {
      if (response.ok) {
        throw new ApiError("The server returned an invalid response. Please try again.", response.status);
      }
    }
  }

  if (!response.ok) {
    if (response.status === 422) {
      throw new ApiError(
        "Please correct the highlighted fields and try again.",
        response.status,
        taskFieldErrors(data?.detail),
      );
    }
    if (response.status === 503) {
      throw new ApiError(
        method === "PUT"
          ? "The task could not be updated right now. Please try again shortly."
          : "Tasks are temporarily unavailable. Please try again shortly.",
        response.status,
      );
    }
    if (method === "PUT" && response.status === 404) {
      throw new ApiError(responseMessage(response.status, "task"), response.status);
    }
    throw new ApiError(
      method === "PUT"
        ? "The task could not be updated. Please try again."
        : "The task could not be created. Please try again.",
      response.status,
    );
  }
  if (!body.trim()) {
    throw new ApiError("The server returned an empty response. Please try again.", response.status);
  }
  return data;
}

function postJson(path, payload) {
  return writeJson("POST", path, payload);
}

function putJson(path, payload) {
  return writeJson("PUT", path, payload);
}

function normalizeTaskList(data) {
  if (
    !isObject(data)
    || !Array.isArray(data.items)
    || !isObject(data.pagination)
    || !isObject(data.counts)
  ) {
    throw new ApiError("The server returned an unexpected task list. Please try again.");
  }

  const { pagination, counts } = data;
  if (
    !Number.isInteger(pagination.page)
    || pagination.page < 1
    || !Number.isInteger(pagination.page_size)
    || pagination.page_size < 1
    || !isNonNegativeInteger(pagination.total)
    || !isNonNegativeInteger(pagination.total_pages)
    || !isNonNegativeInteger(counts.all)
    || !isNonNegativeInteger(counts.to_do)
    || !isNonNegativeInteger(counts.in_progress)
    || !isNonNegativeInteger(counts.done)
  ) {
    throw new ApiError("The server returned an unexpected task list. Please try again.");
  }

  return {
    items: data.items.map(normalizeTask),
    pagination: {
      page: pagination.page,
      pageSize: pagination.page_size,
      total: pagination.total,
      totalPages: pagination.total_pages,
    },
    counts: {
      All: counts.all,
      "To Do": counts.to_do,
      "In Progress": counts.in_progress,
      Done: counts.done,
    },
  };
}

export async function getTasks({
  status = "All",
  page = 1,
  pageSize = DEFAULT_TASK_PAGE_SIZE,
  signal,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status !== "All") query.set("status", status);
  const data = await getJson(`/tasks/?${query.toString()}`, signal);
  return normalizeTaskList(data);
}

export async function getTask(taskId, signal) {
  if (!Number.isInteger(taskId) || taskId < 1) {
    throw new ApiError("The selected task could not be loaded. Please try again.");
  }
  return normalizeTask(await getJson(`/tasks/${taskId}`, signal, "task"));
}

function normalizeTask(task) {
  if (
    !isObject(task)
    || !Number.isInteger(task.id)
    || typeof task.name !== "string"
    || typeof task.employee_name !== "string"
    || typeof task.due_date !== "string"
    || (task.description !== null && typeof task.description !== "string")
    || (task.start_date !== null && typeof task.start_date !== "string")
    || (task.created_at !== null && typeof task.created_at !== "string")
    || (task.updated_at !== null && typeof task.updated_at !== "string")
    || (task.status !== null && !taskStatuses.includes(task.status))
    || (task.priority !== null && !taskPriorities.includes(task.priority))
  ) {
    throw new ApiError("The server returned an unexpected task. Please try again.");
  }
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    employee: task.employee_name,
    priority: task.priority,
    status: task.status,
    startDate: task.start_date,
    dueDate: task.due_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export async function createTask(task) {
  return normalizeTask(await postJson("/tasks/", taskRequestBody(task)));
}

export async function updateTask(taskId, task) {
  if (!Number.isInteger(taskId) || taskId < 1) {
    throw new ApiError("The selected task could not be updated. Please try again.");
  }
  return normalizeTask(await putJson(`/tasks/${taskId}`, taskRequestBody(task)));
}

export async function deleteTask(taskId) {
  if (!Number.isInteger(taskId) || taskId < 1) {
    throw new ApiError("The selected task could not be deleted. Please try again.");
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return;
  if (response.status === 404) {
    throw new ApiError("This task no longer exists. Refresh the task list and try again.", 404);
  }
  if (response.status === 503) {
    throw new ApiError("The task could not be deleted right now. Please try again shortly.", 503);
  }
  if (response.ok) {
    throw new ApiError(
      "The server returned an unexpected response. Refresh the task list before trying again.",
      response.status,
    );
  }
  throw new ApiError("The task could not be deleted. Please try again.", response.status);
}

function taskRequestBody(task) {
  return {
    name: task.name.trim(),
    description: task.description.trim() || null,
    employee_name: task.employee.trim(),
    priority: task.priority,
    status: task.status,
    start_date: task.startDate || null,
    due_date: task.dueDate,
  };
}
