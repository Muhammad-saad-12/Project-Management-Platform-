"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  role: "ADMIN" | "MEMBER";
  userId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.workspaceId as string;

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [callerRole, setCallerRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [callerId, setCallerId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Row action loading states
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Edit Workspace State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editWsName, setEditWsName] = useState("");
  const [editWsSlug, setEditWsSlug] = useState("");
  const [savingWs, setSavingWs] = useState(false);
  const [editWsError, setEditWsError] = useState<string | null>(null);

  // Delete Workspace State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);
  const [deleteWsError, setDeleteWsError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      if (!workspaceId) return;

      try {
        setError(null);
        const res = await fetch(`/api/workspaces/${workspaceId}/members`);

        if (isCancelled) return;

        if (res.status === 401) {
          setError("You must be logged in to access this workspace.");
          router.push("/");
          return;
        }

        if (res.status === 403) {
          setError("You do not have permission to view members in this workspace.");
          return;
        }

        if (res.status === 404) {
          setError("Workspace not found.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to load workspace members");
        }

        const data = await res.json();
        if (!isCancelled) {
          setWorkspace(data.workspace);
          setCallerRole(data.callerRole);
          setCallerId(data.callerId);
          setMembers(data.members);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Error loading members");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, router]);

  const reloadMembers = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
        setCallerRole(data.callerRole);
        setCallerId(data.callerId);
        setMembers(data.members);
      }
    } catch {
      // ignore
    }
  };

  // Add / Invite Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Failed to add member to workspace",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Successfully added ${data.user.email} as ${data.role}!`,
      });
      setInviteEmail("");
      setInviteRole("MEMBER");
      setMembers((prev) => [...prev, data]);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Network error adding member",
      });
    } finally {
      setInviting(false);
    }
  };

  // Update Member Role
  const handleUpdateRole = async (memberId: string, newRole: "ADMIN" | "MEMBER") => {
    setUpdatingMemberId(memberId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update member role");
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setFeedback({
        type: "success",
        message: `Updated ${data.user.email}'s role to ${newRole}`,
      });
    } catch {
      alert("Network error updating member role");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Remove Member
  const handleRemoveMember = async (member: Member) => {
    const isSelf = member.userId === callerId;
    const confirmMessage = isSelf
      ? "Are you sure you want to leave this workspace?"
      : `Are you sure you want to remove ${member.user.email} from this workspace?`;

    if (!confirm(confirmMessage)) return;

    setRemovingMemberId(member.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to remove member");
        return;
      }

      if (isSelf) {
        // If user removed themselves, redirect to dashboard
        router.push("/");
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setFeedback({
        type: "success",
        message: `Removed ${member.user.email} from workspace.`,
      });
    } catch {
      alert("Network error removing member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Open Edit Workspace Modal
  const openEditModal = () => {
    if (!workspace) return;
    setEditWsName(workspace.name);
    setEditWsSlug(workspace.slug);
    setEditWsError(null);
    setIsEditModalOpen(true);
  };

  // Update Workspace
  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    setSavingWs(true);
    setEditWsError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editWsName.trim(),
          slug: editWsSlug.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWorkspace({ id: data.id, name: data.name, slug: data.slug });
        setIsEditModalOpen(false);
        setFeedback({
          type: "success",
          message: "Workspace details updated successfully.",
        });
      } else {
        setEditWsError(data.error || "Failed to update workspace");
      }
    } catch {
      setEditWsError("Network error updating workspace");
    } finally {
      setSavingWs(false);
    }
  };

  // Delete Workspace
  const handleDeleteWorkspace = async () => {
    setDeletingWs(true);
    setDeleteWsError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/");
      } else {
        setDeleteWsError(data.error || "Failed to delete workspace");
      }
    } catch {
      setDeleteWsError("Network error deleting workspace");
    } finally {
      setDeletingWs(false);
    }
  };

  const isAdmin = callerRole === "ADMIN";
  const adminCount = members.filter((m) => m.role === "ADMIN").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <header className="border-b border-slate-200 dark:border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Dashboard
              </Link>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                {workspace?.name || "Workspace"}
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-semibold">
                Members
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {workspace ? `${workspace.name} • Team Members` : "Workspace Members"}
              </h1>
              {workspace && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  /{workspace.slug}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Manage member roles, invitations, and workspace access permissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                isAdmin
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              Your Role: {callerRole}
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={openEditModal}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 font-medium"
              >
                <span>✏️</span> Edit Workspace
              </button>
            )}
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              ← Back
            </Link>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Action Feedback Notification */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs hover:opacity-75 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Loading workspace team members...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Add Member Card (Visible to ADMINs) */}
            {isAdmin ? (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold">Invite / Add Member</h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Add a registered user to this workspace by entering their email address.
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium">
                    Admin Only
                  </span>
                </div>

                <form
                  onSubmit={handleAddMember}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <input
                      type="email"
                      required
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="w-full sm:w-40">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                  >
                    {inviting ? "Adding..." : "+ Add to Workspace"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
                You are currently a <span className="font-semibold">MEMBER</span> in this workspace.
                Only workspace <span className="font-semibold">ADMINs</span> can add new members or modify permissions.
              </div>
            )}

            {/* Members List Table Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">Workspace Members</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    {members.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={reloadMembers}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  ↻ Refresh List
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-3.5 px-6 font-semibold">User</th>
                      <th className="py-3.5 px-6 font-semibold">Joined</th>
                      <th className="py-3.5 px-6 font-semibold">Role</th>
                      <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {members.map((member) => {
                      const isSelf = member.userId === callerId;
                      const isLastAdmin = member.role === "ADMIN" && adminCount <= 1;

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                        >
                          {/* User info */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                                {member.user.email.charAt(0)}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                                    {member.user.email}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ID: {member.user.id.slice(0, 10)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Joined date */}
                          <td className="py-4 px-6 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                            {new Date(member.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>

                          {/* Role Badge / Role Selector */}
                          <td className="py-4 px-6">
                            {isAdmin ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={member.role}
                                  disabled={
                                    updatingMemberId === member.id ||
                                    (isLastAdmin && member.role === "ADMIN")
                                  }
                                  onChange={(e) =>
                                    handleUpdateRole(
                                      member.id,
                                      e.target.value as "ADMIN" | "MEMBER"
                                    )
                                  }
                                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                                    member.role === "ADMIN"
                                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                      : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                  <option value="MEMBER">Member</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                                {isLastAdmin && member.role === "ADMIN" && (
                                  <span
                                    title="Workspaces must have at least one ADMIN"
                                    className="text-[10px] text-slate-400 italic"
                                  >
                                    (Sole Admin)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  member.role === "ADMIN"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {member.role}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            {(isAdmin || isSelf) && (
                              <button
                                type="button"
                                disabled={
                                  removingMemberId === member.id ||
                                  (isLastAdmin && member.role === "ADMIN")
                                }
                                onClick={() => handleRemoveMember(member)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                  isLastAdmin
                                    ? "text-slate-400 border-slate-200 dark:border-zinc-800 cursor-not-allowed opacity-50"
                                    : "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20"
                                }`}
                              >
                                {removingMemberId === member.id
                                  ? "Removing..."
                                  : isSelf
                                  ? "Leave"
                                  : "Remove"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Danger Zone: Workspace Deletion for Admins */}
            {isAdmin && (
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-2xl p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
                      Danger Zone
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                      Permanently delete this workspace and all associated projects, tasks, comments, and member associations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteWsError(null);
                      setIsDeleteModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm whitespace-nowrap self-start sm:self-auto"
                  >
                    Delete Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Workspace Modal */}
        {isEditModalOpen && workspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100">
                    Edit Workspace Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Update workspace name and slug
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWs}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {savingWs ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Workspace Confirmation Modal */}
        {isDeleteModalOpen && workspace && (
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
                    {workspace.name}
                  </strong>{" "}
                  (<code className="font-mono">/{workspace.slug}</code>).
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium">
                  All associated projects, tasks, comments, members, and activity logs
                  will be permanently erased.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deletingWs}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWorkspace}
                  disabled={deletingWs}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {deletingWs ? "Deleting..." : "Permanently Delete Workspace"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
