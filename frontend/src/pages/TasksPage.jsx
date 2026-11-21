import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createTask,
  DEFAULT_TASK_PAGE_SIZE,
  deleteTask as deleteTaskRequest,
  getTask,
  getTasks,
  updateTask,
} from "../api/client.js";
import DeleteConfirmation from "../components/DeleteConfirmation.jsx";
import Pagination from "../components/Pagination.jsx";
import Sidebar from "../components/Sidebar.jsx";
import StatusFilters from "../components/StatusFilters.jsx";
import TaskDetailsPanel from "../components/TaskDetailsPanel.jsx";
import TaskFormModal from "../components/TaskFormModal.jsx";
import TaskHeader from "../components/TaskHeader.jsx";
import TaskList from "../components/TaskList.jsx";
import Toast from "../components/Toast.jsx";

function TasksPage() {
  const [taskList, setTaskList] = useState(null);
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailsTask, setDetailsTask] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTask, setDeletingTask] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const addButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  const modalRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const panelRef = useRef(null);
  const panelReturnFocusRef = useRef(null);
  const formReturnFocusRef = useRef(null);
  const deleteReturnFocusRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const isDeletingRef = useRef(false);
  const detailsRequestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTasks() {
      setLoading(true);
      setError(null);
      try {
        const response = await getTasks({
          status: filter,
          page,
          pageSize: DEFAULT_TASK_PAGE_SIZE,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setTaskList(response);
          setPage(response.pagination.page);
        }
      } catch (requestError) {
        if (controller.signal.aborted || requestError.name === "AbortError") return;
        if (requestError instanceof ApiError) setError(requestError.message);
        else setError("Tasks could not be loaded. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadTasks();
    return () => controller.abort();
  }, [filter, page, retryCount]);

  useEffect(() => {
    if (selectedTaskId === null) return undefined;

    const controller = new AbortController();
    const requestId = ++detailsRequestIdRef.current;
    setDetailsTask(null);
    setDetailsLoading(true);
    setDetailsError(null);

    async function loadTaskDetails() {
      try {
        const task = await getTask(selectedTaskId, controller.signal);
        if (!controller.signal.aborted && detailsRequestIdRef.current === requestId) {
          setDetailsTask(task);
        }
      } catch (requestError) {
        if (controller.signal.aborted || requestError.name === "AbortError") return;
        if (detailsRequestIdRef.current === requestId) {
          setDetailsError(
            requestError instanceof ApiError
              ? requestError.message
              : "Task details could not be loaded. Please try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted && detailsRequestIdRef.current === requestId) {
          setDetailsLoading(false);
        }
      }
    }

    loadTaskDetails();
    return () => controller.abort();
  }, [selectedTaskId]);

  const focusAfterClose = (target) => {
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else addButtonRef.current?.focus();
    });
  };

  function openCreateTask() {
    formReturnFocusRef.current = document.activeElement;
    setEditingTask(null);
    setIsFormOpen(true);
  }

  function openEditTask(task) {
    formReturnFocusRef.current = document.activeElement;
    setEditingTask(task);
    setIsFormOpen(true);
  }

  function closeCreateTask() {
    if (isSubmittingRef.current) return;
    setIsFormOpen(false);
    setEditingTask(null);
    focusAfterClose(formReturnFocusRef.current);
  }

  async function submitTask(values) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const taskToUpdate = editingTask;
      const savedTask = taskToUpdate
        ? await updateTask(taskToUpdate.id, values)
        : await createTask(values);
      if (taskToUpdate && selectedTaskId === taskToUpdate.id) {
        setDetailsTask(savedTask);
      }
      setIsFormOpen(false);
      setEditingTask(null);
      focusAfterClose(formReturnFocusRef.current);
      setToastMessage(taskToUpdate ? "Task updated" : "Task created");
      if (!taskToUpdate) setFilter("All");
      setPage(1);
      setRetryCount((count) => count + 1);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function openDetails(taskId) {
    panelReturnFocusRef.current = document.activeElement;
    detailsRequestIdRef.current += 1;
    setSelectedTaskId(taskId);
    setDetailsTask(null);
    setDetailsLoading(true);
    setDetailsError(null);
  }

  function closeDetails() {
    detailsRequestIdRef.current += 1;
    setSelectedTaskId(null);
    setDetailsTask(null);
    setDetailsLoading(false);
    setDetailsError(null);
    focusAfterClose(panelReturnFocusRef.current);
  }

  function openDeleteConfirmation(task) {
    deleteReturnFocusRef.current = document.activeElement;
    setDeleteError(null);
    setDeletingTask(task);
  }

  function cancelDelete() {
    if (isDeletingRef.current) return;
    setDeleteError(null);
    setDeletingTask(null);
    focusAfterClose(deleteReturnFocusRef.current);
  }

  async function confirmDelete() {
    if (!deletingTask || isDeletingRef.current) return;
    const taskId = deletingTask.id;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTaskRequest(taskId);
    } catch (requestError) {
      setDeleteError(
        requestError instanceof ApiError
          ? requestError.message
          : "The task could not be deleted. Please try again.",
      );
      isDeletingRef.current = false;
      setIsDeleting(false);
      return;
    }

    isDeletingRef.current = false;
    setIsDeleting(false);
    setDeletingTask(null);
    setDeleteError(null);
    setToastMessage("Task deleted");

    if (selectedTaskId === taskId) {
      detailsRequestIdRef.current += 1;
      setSelectedTaskId(null);
      setDetailsTask(null);
      setDetailsLoading(false);
      setDetailsError(null);
    }

    const totalAfterDelete = Math.max(0, (taskList?.pagination.total ?? 0) - 1);
    const pageSize = taskList?.pagination.pageSize ?? DEFAULT_TASK_PAGE_SIZE;
    const lastPageAfterDelete = Math.max(1, Math.ceil(totalAfterDelete / pageSize));
    if (page > lastPageAfterDelete) setPage(lastPageAfterDelete);
    setRetryCount((count) => count + 1);
    focusAfterClose(addButtonRef.current);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (isFormOpen) {
          if (!isSubmittingRef.current) closeCreateTask();
        } else if (deletingTask !== null) {
          if (!isDeletingRef.current) cancelDelete();
        } else if (selectedTaskId !== null) closeDetails();
        else if (isMenuOpen) {
          setIsMenuOpen(false);
          menuButtonRef.current?.focus();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const topLayer = isFormOpen
        ? modalRef.current
        : deletingTask !== null
          ? deleteDialogRef.current
          : selectedTaskId !== null
            ? panelRef.current
            : null;
      if (!topLayer) return;
      const focusable = [...topLayer.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, isFormOpen, isMenuOpen, deletingTask]);

  useEffect(() => {
    function closeMenuOnResize() {
      if (window.innerWidth > 820) setIsMenuOpen(false);
    }
    window.addEventListener("resize", closeMenuOnResize);
    return () => window.removeEventListener("resize", closeMenuOnResize);
  }, []);

  function changeFilter(status) {
    if (status === filter) return;
    setLoading(true);
    setError(null);
    setFilter(status);
    setPage(1);
  }

  function changePage(nextPage) {
    if (nextPage === page) return;
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function retry() {
    setLoading(true);
    setError(null);
    setRetryCount((count) => count + 1);
  }

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen((open) => !open)}
        onClose={() => setIsMenuOpen(false)}
        menuButtonRef={menuButtonRef}
      />
      <main id="tasks">
        <TaskHeader
          taskCount={taskList?.counts.All ?? null}
          onAddTask={openCreateTask}
          addButtonRef={addButtonRef}
        />
        <StatusFilters
          selected={filter}
          counts={taskList?.counts ?? null}
          onSelect={changeFilter}
        />
        <TaskList
          tasks={taskList?.items ?? []}
          filter={filter}
          loading={loading}
          error={error}
          onAddTask={openCreateTask}
          onRetry={retry}
          onView={openDetails}
          onEdit={openEditTask}
          onDelete={openDeleteConfirmation}
        />
        {!loading && !error && taskList && (
          <Pagination
            page={taskList.pagination.page}
            pageCount={taskList.pagination.totalPages}
            pageSize={taskList.pagination.pageSize}
            total={taskList.pagination.total}
            onPageChange={changePage}
          />
        )}
      </main>
      {isFormOpen && (
        <TaskFormModal
          task={editingTask}
          onClose={closeCreateTask}
          onSubmit={submitTask}
          isSubmitting={isSubmitting}
          dialogRef={modalRef}
        />
      )}
      <TaskDetailsPanel
        isOpen={selectedTaskId !== null}
        task={detailsTask}
        loading={detailsLoading}
        error={detailsError}
        onClose={closeDetails}
        onEdit={openEditTask}
        onDelete={openDeleteConfirmation}
        panelRef={panelRef}
      />
      <DeleteConfirmation
        task={deletingTask}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
        dialogRef={deleteDialogRef}
      />
      <Toast message={toastMessage} onDismiss={() => setToastMessage("")} />
    </div>
  );
}

export default TasksPage;
