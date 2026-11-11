"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ActivityLogList } from "@/components/ActivityLogList";

type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  position: number;
  dueDate: string | null;
  projectId: string;
  assigneeId: string | null;
  assignee?: { id: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  author: {
    id: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMemberInfo {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
  };
}

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  workspace?: {
    id: string;
    name: string;
    slug: string;
    members?: WorkspaceMemberInfo[];
  };
}

const COLUMNS: {
  id: TaskStatus;
  title: string;
  accent: string;
  badge: string;
  borderTop: string;
}[] = [
  {
    id: "TODO",
    title: "To Do",
    accent: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    borderTop: "border-t-slate-400",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
    accent: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    borderTop: "border-t-blue-500",
  },
  {
    id: "REVIEW",
    title: "In Review",
    accent: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    borderTop: "border-t-amber-500",
  },
  {
    id: "DONE",
    title: "Done",
    accent: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    borderTop: "border-t-emerald-500",
  },
];

const PRIORITY_BADGES: Record<Priority, { label: string; class: string }> = {
  LOW: {
    label: "Low",
    class: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  MEDIUM: {
    label: "Medium",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  HIGH: {
    label: "High",
    class: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  URGENT: {
    label: "Urgent",
    class: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export default function KanbanPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New task modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("TODO");
  const [newPriority, setNewPriority] = useState<Priority>("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Drag-and-drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  // Slide-over Drawer / Task Detail State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Activity Log Drawer State
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");

  // Editable Drawer Fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("TODO");
  const [editPriority, setEditPriority] = useState<Priority>("MEDIUM");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load project details and tasks on mount
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!projectId) return;

      try {
        setError(null);

        // Fetch project info (with workspace members)
        fetch(`/api/projects/${projectId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!isCancelled && data) setProject(data);
          })
          .catch(() => {});

        // Fetch tasks
        const res = await fetch(`/api/projects/${projectId}/tasks`);
        if (isCancelled) return;

        if (res.status === 401) {
          setError("You must be logged in to view this board.");
          router.push("/");
          return;
        }
        if (res.status === 403) {
          setError("You do not have access to this project's workspace.");
          return;
        }
        if (res.status === 404) {
          setError("Project not found.");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load tasks");
        }

        const data = await res.json();
        if (!isCancelled) {
          setTasks(data);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Error fetching board");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [projectId, router]);

  const reloadTasks = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      // ignore reload error
    }
  };

  // Move task status with optimistic UI update
  const moveTaskStatus = async (taskId: string, targetStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    const previousTasks = [...tasks];

    // Optimistic update
    startTransition(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
      );
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status: targetStatus } : null));
        setEditStatus(targetStatus);
      }
    });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        setTasks(previousTasks);
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to update task status");
      }
    } catch {
      setTasks(previousTasks);
      alert("Network error updating task status");
    }
  };

  // Open modal for creating a task
  const openCreateModal = (status: TaskStatus = "TODO") => {
    setNewStatus(status);
    setNewTitle("");
    setNewDescription("");
    setNewPriority("MEDIUM");
    setNewDueDate("");
    setIsModalOpen(true);
  };

  // Create new task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        status: newStatus,
        priority: newPriority,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      };

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to create task");
        return;
      }

      const created = await res.json();
      setTasks((prev) => [created, ...prev]);
      setIsModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating task");
    } finally {
      setSubmitting(false);
    }
  };

  // Open task detail slide-over drawer
  const openTaskDrawer = async (task: Task) => {
    setSelectedTaskId(task.id);
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setEditAssigneeId(task.assigneeId || "");
    setSaveSuccess(false);

    // Fetch comments for this task
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      if (res.ok) {
        const data: Comment[] = await res.json();
        setTaskComments(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingComments(false);
    }
  };

  // Save task edits in slide-over drawer
  const handleSaveTaskEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !editTitle.trim()) return;

    setSavingTask(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/tasks/${selectedTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          status: editStatus,
          priority: editPriority,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          assigneeId: editAssigneeId ? editAssigneeId : null,
        }),
      });

      if (res.ok) {
        const updated: Task = await res.json();
        setSelectedTask(updated);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update task");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating task");
    } finally {
      setSavingTask(false);
    }
  };

  // Delete task from drawer
  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTaskId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
        setSelectedTaskId(null);
        setSelectedTask(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete task");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting task");
    } finally {
      setDeletingTask(false);
    }
  };

  // Post comment on task
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !newCommentText.trim()) return;

    setPostingComment(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTaskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newCommentText.trim() }),
      });

      if (res.ok) {
        const createdComment: Comment = await res.json();
        setTaskComments((prev) => [...prev, createdComment]);
        setNewCommentText("");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to post comment");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error posting comment");
    } finally {
      setPostingComment(false);
    }
  };

  // Drag and Drop handlers
  const onDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const onDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const onDragLeave = () => {
    setDragOverCol(null);
  };

  const onDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedTaskId) {
      moveTaskStatus(draggedTaskId, targetStatus);
      setDraggedTaskId(null);
    }
  };

  const workspaceMembers = useMemo(() => {
    return project?.workspace?.members || [];
  }, [project?.workspace?.members]);

  // Filter Active Check & Reset
  const isFilterActive =
    searchQuery.trim() !== "" ||
    selectedPriority !== "ALL" ||
    selectedAssignee !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedPriority("ALL");
    setSelectedAssignee("ALL");
  };

  // Unique assignees across workspace members and existing project tasks
  const assigneesList = useMemo(() => {
    const map = new Map<string, string>();
    workspaceMembers.forEach((m) => {
      if (m.user) map.set(m.user.id, m.user.email);
    });
    tasks.forEach((t) => {
      if (t.assignee) map.set(t.assignee.id, t.assignee.email);
    });
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }));
  }, [workspaceMembers, tasks]);

  // Dynamically filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search Query filter (title or description, case-insensitive)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description
          ? task.description.toLowerCase().includes(q)
          : false;
        if (!matchTitle && !matchDesc) {
          return false;
        }
      }

      // 2. Priority filter
      if (selectedPriority !== "ALL") {
        if (task.priority !== selectedPriority) {
          return false;
        }
      }

      // 3. Assignee filter
      if (selectedAssignee !== "ALL") {
        if (selectedAssignee === "UNASSIGNED") {
          if (task.assigneeId !== null && task.assigneeId !== undefined) {
            return false;
          }
        } else {
          if (task.assigneeId !== selectedAssignee) {
            return false;
          }
        }
      }

      return true;
    });
  }, [tasks, searchQuery, selectedPriority, selectedAssignee]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ← Back to Dashboard
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  {project?.name || "Kanban Board"}
                </h1>
                {project?.workspace && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">
                    {project.workspace.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {project?.description || `Project ID: ${projectId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project?.workspace && (
              <button
                type="button"
                onClick={() => setIsActivityOpen(true)}
                className="text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 font-medium"
              >
                <span>⚡</span> Activity Feed
              </button>
            )}
            <button
              onClick={() => reloadTasks()}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => openCreateModal("TODO")}
              className="text-xs px-3.5 py-2 font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span> New Task
            </button>
          </div>
        </div>
      </header>

      {/* Main Kanban Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
            <span className="font-semibold">Access Error:</span> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Loading project board...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Advanced Search and Filters Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* 1. Real-time Search Input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search tasks by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      title="Clear search"
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 2. Dropdowns & Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Priority Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      Priority:
                    </label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  {/* Assignee Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      Assignee:
                    </label>
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate"
                    >
                      <option value="ALL">All Assignees</option>
                      <option value="UNASSIGNED">Unassigned</option>
                      {assigneesList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Reset Filters Button */}
                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>✕</span> Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Priority Pill Filters & Filter Stats Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs text-slate-500 dark:text-zinc-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 dark:text-zinc-100 font-semibold">
                      {filteredTasks.length}
                    </strong>{" "}
                    of <strong>{tasks.length}</strong> tasks
                  </span>
                  {isFilterActive && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      Filters Active
                    </span>
                  )}
                </div>

                {/* Priority Pill Buttons */}
                <div className="flex items-center gap-1 text-[11px] flex-wrap">
                  <span className="text-slate-400 text-[10px] mr-1 uppercase font-medium">
                    Priority Pills:
                  </span>
                  {(["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => {
                    const isSelected = selectedPriority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPriority(p)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {p === "ALL" ? "All" : PRIORITY_BADGES[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Zero matching tasks banner when filters are active */}
            {tasks.length > 0 && filteredTasks.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  No tasks match your active filters or search criteria.
                </span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-100 self-start sm:self-auto"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Kanban Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
              {COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id);
                const isOver = dragOverCol === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => onDragOver(e, col.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, col.id)}
                    className={`flex flex-col bg-slate-100/70 dark:bg-zinc-900/60 rounded-2xl border ${
                      isOver
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-zinc-800"
                    } p-3 min-h-[520px] transition-all`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200/60 dark:border-zinc-800 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.accent}`}></span>
                        <h2 className="font-semibold text-sm tracking-tight">
                          {col.title}
                        </h2>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${col.badge}`}
                        >
                          {colTasks.length}
                        </span>
                      </div>

                      <button
                        onClick={() => openCreateModal(col.id)}
                        title={`Add task to ${col.title}`}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Task Card List */}
                    <div className="flex-1 space-y-3">
                      {colTasks.length === 0 ? (
                        <div className="h-32 border border-dashed border-slate-300 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xs text-slate-400 dark:text-zinc-500 italic text-center px-3">
                          {isFilterActive
                            ? "No matching tasks"
                            : "Drop tasks here"}
                        </div>
                      ) : (
                        colTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => onDragStart(task.id)}
                          onClick={() => openTaskDrawer(task)}
                          className={`bg-white dark:bg-zinc-900 p-4 rounded-xl border ${
                            selectedTaskId === task.id
                              ? "border-blue-500 ring-2 ring-blue-500/20"
                              : "border-slate-200 dark:border-zinc-800"
                          } shadow-sm hover:shadow-md transition cursor-pointer active:cursor-grabbing space-y-3 group`}
                        >
                          {/* Task Top Row: Priority & Move Controls */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                PRIORITY_BADGES[task.priority]?.class
                              }`}
                            >
                              {PRIORITY_BADGES[task.priority]?.label}
                            </span>

                            {/* Quick Shift Selector */}
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                moveTaskStatus(task.id, e.target.value as TaskStatus);
                              }}
                              className="text-[11px] bg-slate-100 dark:bg-zinc-800 border-none rounded px-2 py-0.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 focus:outline-none cursor-pointer"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                            </select>
                          </div>

                          {/* Task Title & Description */}
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Task Footer */}
                          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                            {task.assignee ? (
                              <div
                                title={task.assignee.email}
                                className="flex items-center gap-1.5 truncate max-w-[130px]"
                              >
                                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                                  {task.assignee.email.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate">{task.assignee.email}</span>
                              </div>
                            ) : (
                              <span className="italic">Unassigned</span>
                            )}

                            {task.dueDate && (
                              <span
                                title={`Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                                className="font-mono text-[10px]"
                              >
                                📅 {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </main>

      {/* Task Detail & Comments Slide-over Drawer */}
      {selectedTaskId && selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedTaskId(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>

          {/* Drawer Panel */}
          <div className="relative z-50 w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400">
                  Task #{selectedTask.id.slice(-6)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    PRIORITY_BADGES[selectedTask.priority]?.class
                  }`}
                >
                  {selectedTask.priority}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={deletingTask}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 px-2.5 py-1 rounded border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  {deletingTask ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Task Edit Form */}
              <form onSubmit={handleSaveTaskEdits} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add detailed task notes or links..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Priority
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as Priority)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Assignee
                    </label>
                    <select
                      value={editAssigneeId}
                      onChange={(e) => setEditAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {workspaceMembers.map((member) => (
                        <option key={member.id} value={member.user.id}>
                          {member.user.email} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Changes saved successfully!
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={savingTask}
                    className="ml-auto px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {savingTask ? "Saving..." : "Save Properties"}
                  </button>
                </div>
              </form>

              {/* Comments Section */}
              <div className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    Comments
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-mono">
                      {taskComments.length}
                    </span>
                  </h4>
                </div>

                {/* Add Comment Box */}
                <form onSubmit={handlePostComment} className="space-y-2">
                  <textarea
                    rows={2}
                    required
                    placeholder="Write a comment or update..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={postingComment || !newCommentText.trim()}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {postingComment ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-3 pt-2">
                  {loadingComments ? (
                    <p className="text-xs text-slate-400 italic">Loading comments...</p>
                  ) : taskComments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      No comments yet. Start the conversation!
                    </p>
                  ) : (
                    taskComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[9px]">
                              {comment.author.email.charAt(0).toUpperCase()}
                            </span>
                            {comment.author.email}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(comment.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold">Create New Task</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design user profile screen"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Add details, acceptance criteria, or links..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Feed Slide-over Drawer */}
      {isActivityOpen && project?.workspace && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsActivityOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>⚡</span> Workspace Activity Feed
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Recent actions in {project.workspace.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <ActivityLogList workspaceId={project.workspace.id} limit={50} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
