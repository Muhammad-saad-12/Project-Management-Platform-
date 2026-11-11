"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivityLogList } from "@/components/ActivityLogList";

interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  id: string;
  role: "ADMIN" | "MEMBER";
  userId: string;
  workspaceId: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  members?: WorkspaceMember[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"register" | "login">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Workspaces & Projects State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projectsByWorkspace, setProjectsByWorkspace] = useState<
    Record<string, Project[]>
  >({});
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Create Workspace State
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  // Create Project State
  const [activeProjectFormWsId, setActiveProjectFormWsId] = useState<
    string | null
  >(null);
  const [projectForms, setProjectForms] = useState<
    Record<string, { name: string; description: string }>
  >({});
  const [creatingProject, setCreatingProject] = useState(false);

  // Tab selection per workspace: "projects" | "activity"
  const [workspaceTabs, setWorkspaceTabs] = useState<
    Record<string, "projects" | "activity">
  >({});

  // Edit Workspace State
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [editWsSlug, setEditWsSlug] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [editWsError, setEditWsError] = useState<string | null>(null);

  // Delete Workspace State
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWsError, setDeleteWsError] = useState<string | null>(null);

  // Response Logger for inspection
  const [responseLog, setResponseLog] = useState<{
    status: number;
    data: unknown;
  } | null>(null);

  // Check active session on mount
  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (isCancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch {
        // Unauthenticated session
      }
    }

    checkSession();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch workspaces & their projects when currentUser is authenticated
  useEffect(() => {
    let isCancelled = false;

    if (!currentUser) {
      return;
    }

    async function fetchWorkspacesAndProjects() {
      setLoadingWorkspaces(true);
      try {
        const res = await fetch("/api/workspaces");
        if (isCancelled) return;

        if (res.ok) {
          const wsList: Workspace[] = await res.json();
          if (isCancelled) return;
          setWorkspaces(wsList);

          // Fetch projects for each workspace
          const map: Record<string, Project[]> = {};
          await Promise.all(
            wsList.map(async (ws) => {
              try {
                const pRes = await fetch(`/api/workspaces/${ws.id}/projects`);
                if (pRes.ok) {
                  const pData: Project[] = await pRes.json();
                  map[ws.id] = pData;
                }
              } catch {
                // Ignore single workspace project fetch failure
              }
            })
          );

          if (!isCancelled) {
            setProjectsByWorkspace(map);
          }
        }
      } catch {
        // Error fetching workspaces
      } finally {
        if (!isCancelled) {
          setLoadingWorkspaces(false);
        }
      }
    }

    fetchWorkspacesAndProjects();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  // Auth Submit (Register / Login)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setResponseLog(null);

    const endpoint =
      activeTab === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      setResponseLog({ status: res.status, data });

      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setEmail("");
        setPassword("");
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (err: unknown) {
      setResponseLog({
        status: 500,
        data: { error: err instanceof Error ? err.message : "Request failed" },
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      setResponseLog({ status: res.status, data });
      setCurrentUser(null);
      setWorkspaces([]);
      setProjectsByWorkspace({});
    } catch (err: unknown) {
      setResponseLog({
        status: 500,
        data: { error: err instanceof Error ? err.message : "Request failed" },
      });
    }
  };

  // Reload workspaces
  const reloadWorkspaces = async () => {
    if (!currentUser) return;
    setLoadingWorkspaces(true);
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const wsList: Workspace[] = await res.json();
        setWorkspaces(wsList);

        const map: Record<string, Project[]> = {};
        await Promise.all(
          wsList.map(async (ws) => {
            const pRes = await fetch(`/api/workspaces/${ws.id}/projects`);
            if (pRes.ok) {
              map[ws.id] = await pRes.json();
            }
          })
        );
        setProjectsByWorkspace(map);
      }
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // Create Workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreatingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });
      const data = await res.json();
      setResponseLog({ status: res.status, data });

      if (res.ok) {
        setWorkspaces((prev) => [data, ...prev]);
        setProjectsByWorkspace((prev) => ({ ...prev, [data.id]: [] }));
        setNewWorkspaceName("");
      } else {
        alert(data.error || "Failed to create workspace");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // Create Project in Workspace
  const handleCreateProject = async (workspaceId: string, e: React.FormEvent) => {
    e.preventDefault();
    const form = projectForms[workspaceId];
    if (!form || !form.name.trim()) return;

    setCreatingProject(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || undefined,
        }),
      });

      const data = await res.json();
      setResponseLog({ status: res.status, data });

      if (res.ok) {
        setProjectsByWorkspace((prev) => ({
          ...prev,
          [workspaceId]: [data, ...(prev[workspaceId] || [])],
        }));
        setProjectForms((prev) => ({
          ...prev,
          [workspaceId]: { name: "", description: "" },
        }));
        setActiveProjectFormWsId(null);
      } else {
        alert(data.error || "Failed to create project");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating project");
    } finally {
      setCreatingProject(false);
    }
  };

  // Open Edit Workspace Modal
  const openEditWorkspace = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditWsName(ws.name);
    setEditWsSlug(ws.slug);
    setEditWsError(null);
  };

  // Update Workspace (Name / Slug)
  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;

    setSavingWorkspace(true);
    setEditWsError(null);

    try {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editWsName.trim(),
          slug: editWsSlug.trim(),
        }),
      });

      const data = await res.json();
      setResponseLog({ status: res.status, data });

      if (res.ok) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === data.id ? { ...w, ...data } : w))
        );
        setEditingWorkspace(null);
      } else {
        setEditWsError(data.error || "Failed to update workspace");
      }
    } catch (err: unknown) {
      setEditWsError(
        err instanceof Error ? err.message : "Error updating workspace"
      );
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Delete Workspace (Cascades all data)
  const handleDeleteWorkspace = async () => {
    if (!deletingWorkspace) return;

    setIsDeletingWorkspace(true);
    setDeleteWsError(null);

    try {
      const res = await fetch(`/api/workspaces/${deletingWorkspace.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      setResponseLog({ status: res.status, data });

      if (res.ok) {
        const deletedId = deletingWorkspace.id;
        setWorkspaces((prev) => prev.filter((w) => w.id !== deletedId));
        setProjectsByWorkspace((prev) => {
          const next = { ...prev };
          delete next[deletedId];
          return next;
        });
        setDeletingWorkspace(null);
      } else {
        setDeleteWsError(data.error || "Failed to delete workspace");
      }
    } catch (err: unknown) {
      setDeleteWsError(
        err instanceof Error ? err.message : "Error deleting workspace"
      );
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <header className="border-b border-slate-200 dark:border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Work Management Platform
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Workspaces, Projects, and Kanban Boards
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold">{currentUser.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium ml-2"
                >
                  Log out
                </button>
              </div>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                Not Authenticated
              </span>
            )}
          </div>
        </header>

        {/* Not Logged In: Authentication View */}
        {!currentUser ? (
          <div className="max-w-md mx-auto bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md">
            <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "login"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === "register"
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {authLoading
                  ? "Processing..."
                  : activeTab === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="space-y-8">
            {/* Top Bar: Create Workspace */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold">Your Workspaces</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Manage team spaces, create projects, and collaborate.
                </p>
              </div>

              <form
                onSubmit={handleCreateWorkspace}
                className="flex items-center gap-2 w-full md:w-auto"
              >
                <input
                  type="text"
                  required
                  placeholder="New workspace name..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                />
                <button
                  type="submit"
                  disabled={creatingWorkspace}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap disabled:opacity-50 transition-colors shadow-sm"
                >
                  {creatingWorkspace ? "Creating..." : "+ Add Workspace"}
                </button>
                <button
                  type="button"
                  onClick={reloadWorkspaces}
                  title="Reload Workspaces"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  ↻
                </button>
              </form>
            </div>

            {/* Workspaces List */}
            {loadingWorkspaces ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm">Loading workspaces and projects...</p>
              </div>
            ) : workspaces.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-8">
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                  No workspaces found
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Create your first workspace using the form above to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {workspaces.map((ws) => {
                  const wsProjects = projectsByWorkspace[ws.id] || [];
                  const isAddingProject = activeProjectFormWsId === ws.id;
                  const currentForm = projectForms[ws.id] || {
                    name: "",
                    description: "",
                  };
                  const currentTab = workspaceTabs[ws.id] || "projects";
                  const callerRole = ws.members?.find(
                    (m) => m.userId === currentUser?.id
                  )?.role;
                  const isAdmin = callerRole === "ADMIN";

                  return (
                    <div
                      key={ws.id}
                      className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden"
                    >
                      {/* Workspace Header */}
                      <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-zinc-900/50">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                              {ws.name}
                            </h3>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                              /{ws.slug}
                            </span>
                            {callerRole && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isAdmin
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                    : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}
                              >
                                {callerRole}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                            ID: {ws.id}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditWorkspace(ws)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1"
                                title="Edit workspace name & slug"
                              >
                                <span>✏️</span> Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingWorkspace(ws);
                                  setDeleteWsError(null);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-1"
                                title="Delete workspace"
                              >
                                <span>🗑️</span> Delete
                              </button>
                            </>
                          )}

                          <Link
                            href={`/workspaces/${ws.id}/settings/members`}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                          >
                            <span>👥</span> Members
                          </Link>

                          <button
                            type="button"
                            onClick={() => {
                              setWorkspaceTabs((prev) => ({
                                ...prev,
                                [ws.id]: "projects",
                              }));
                              setActiveProjectFormWsId(
                                isAddingProject ? null : ws.id
                              );
                              if (!projectForms[ws.id]) {
                                setProjectForms((prev) => ({
                                  ...prev,
                                  [ws.id]: { name: "", description: "" },
                                }));
                              }
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                          >
                            {isAddingProject ? "Cancel" : "+ New Project"}
                          </button>
                        </div>
                      </div>

                      {/* Workspace Tabs (Projects vs Activity Feed) */}
                      <div className="flex items-center gap-6 px-6 pt-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/30">
                        <button
                          type="button"
                          onClick={() =>
                            setWorkspaceTabs((prev) => ({
                              ...prev,
                              [ws.id]: "projects",
                            }))
                          }
                          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
                            currentTab === "projects"
                              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          <span>📁</span> Projects ({wsProjects.length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setWorkspaceTabs((prev) => ({
                              ...prev,
                              [ws.id]: "activity",
                            }))
                          }
                          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
                            currentTab === "activity"
                              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          <span>⚡</span> Activity Feed
                        </button>
                      </div>

                      {/* Tab Content */}
                      {currentTab === "activity" ? (
                        <div className="p-6">
                          <ActivityLogList workspaceId={ws.id} />
                        </div>
                      ) : (
                        <>
                          {/* Add Project Form Drawer */}
                          {isAddingProject && (
                            <div className="p-6 bg-indigo-50/30 dark:bg-indigo-950/10 border-b border-slate-200 dark:border-zinc-800">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-3">
                                Create Project in {ws.name}
                              </h4>
                              <form
                                onSubmit={(e) => handleCreateProject(ws.id, e)}
                                className="space-y-3 max-w-xl"
                              >
                                <div>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Project Name (e.g. Website Overhaul)"
                                    value={currentForm.name}
                                    onChange={(e) =>
                                      setProjectForms((prev) => ({
                                        ...prev,
                                        [ws.id]: {
                                          ...currentForm,
                                          name: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Optional description or goals..."
                                    value={currentForm.description}
                                    onChange={(e) =>
                                      setProjectForms((prev) => ({
                                        ...prev,
                                        [ws.id]: {
                                          ...currentForm,
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="submit"
                                    disabled={creatingProject}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
                                  >
                                    {creatingProject
                                      ? "Creating..."
                                      : "Save Project"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveProjectFormWsId(null)}
                                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}

                          {/* Projects Grid */}
                          <div className="p-6">
                            {wsProjects.length === 0 ? (
                              <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
                                No projects yet. Click &quot;+ New Project&quot; above to create one.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {wsProjects.map((project) => (
                                  <div
                                    key={project.id}
                                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 hover:border-blue-400 dark:hover:border-blue-600 transition flex flex-col justify-between group shadow-sm hover:shadow"
                                  >
                                    <div>
                                      <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {project.name}
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                        {project.description ||
                                          "No description provided"}
                                      </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ID: {project.id.slice(0, 8)}...
                                      </span>

                                      {/* Clickable link to Kanban board */}
                                      <Link
                                        href={`/projects/${project.id}`}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                                      >
                                        Kanban Board →
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom Response Inspector */}
        {responseLog && (
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Latest API Activity
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded ${
                  responseLog.status >= 200 && responseLog.status < 300
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                HTTP {responseLog.status}
              </span>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
              {JSON.stringify(responseLog.data, null, 2)}
            </pre>
          </div>
        )}
        {/* Edit Workspace Modal */}
        {editingWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Edit Workspace
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Update workspace name and unique URL slug
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {editWsError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                  {editWsError}
                </div>
              )}

              <form onSubmit={handleUpdateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={editWsName}
                    onChange={(e) => setEditWsName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                    Workspace URL Slug
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 text-xs rounded-l-lg border border-r-0 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500 font-mono">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={50}
                      value={editWsSlug}
                      onChange={(e) =>
                        setEditWsSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      className="w-full px-3 py-2 text-sm rounded-r-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    Lowercase letters, numbers, and hyphens (3–50 chars).
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingWorkspace(null)}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWorkspace}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {savingWorkspace ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Workspace Confirmation Modal */}
        {deletingWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Delete Workspace?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              {deleteWsError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                  {deleteWsError}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1 mb-5">
                <p>
                  You are about to delete{" "}
                  <strong className="text-slate-900 dark:text-zinc-100 font-semibold">
                    {deletingWorkspace.name}
                  </strong>{" "}
                  (<code className="font-mono">/{deletingWorkspace.slug}</code>).
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium">
                  All associated projects, tasks, comments, members, and activity logs
                  will be permanently erased.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingWorkspace(null)}
                  disabled={isDeletingWorkspace}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWorkspace}
                  disabled={isDeletingWorkspace}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isDeletingWorkspace ? "Deleting..." : "Permanently Delete Workspace"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
