"use client";

import { useEffect, useState } from "react";

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  workspaceId: string;
  actorId: string | null;
  actor: {
    id: string;
    email: string;
  } | null;
  createdAt: string;
}

interface ActivityLogListProps {
  workspaceId: string;
  limit?: number;
  compact?: boolean;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function getActionMeta(action: string): {
  label: string;
  badgeClass: string;
  icon: string;
} {
  switch (action) {
    case "TASK_CREATED":
      return {
        label: "Task Created",
        badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
        icon: "✨",
      };
    case "STATUS_CHANGED":
      return {
        label: "Status Changed",
        badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
        icon: "🔄",
      };
    case "TASK_UPDATED":
      return {
        label: "Task Updated",
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        icon: "✏️",
      };
    case "TASK_DELETED":
      return {
        label: "Task Deleted",
        badgeClass: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800",
        icon: "🗑️",
      };
    case "PROJECT_CREATED":
      return {
        label: "Project Created",
        badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
        icon: "🚀",
      };
    case "MEMBER_ADDED":
      return {
        label: "Member Added",
        badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800",
        icon: "👤",
      };
    case "ROLE_UPDATED":
      return {
        label: "Role Updated",
        badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800",
        icon: "🛡️",
      };
    case "MEMBER_REMOVED":
      return {
        label: "Member Removed",
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800",
        icon: "🚪",
      };
    case "COMMENT_ADDED":
      return {
        label: "Comment Added",
        badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
        icon: "💬",
      };
    default:
      return {
        label: action.replace(/_/g, " "),
        badgeClass: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
        icon: "📌",
      };
  }
}

export function ActivityLogList({
  workspaceId,
  limit = 50,
  compact = false,
}: ActivityLogListProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        setError(null);
        const res = await fetch(
          `/api/workspaces/${workspaceId}/activity?limit=${limit}`
        );
        if (isCancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Failed to fetch activity (${res.status})`
          );
        }
        const data = await res.json();
        if (!isCancelled) {
          setActivities(data.activities || []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Error loading activity"
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, [workspaceId, limit]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/activity?limit=${limit}`
      );
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading activity");
    } finally {
      setLoading(false);
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs">Loading activity feed...</p>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-red-500">
        <p>{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-2 px-3 py-1 text-xs rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Workspace Activity
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
            {activities.length} event{activities.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
        >
          <span>↻</span> {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
          No activity recorded yet for this workspace.
        </div>
      ) : (
        <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
          {activities.map((item) => {
            const meta = getActionMeta(item.action);
            return (
              <div
                key={item.id}
                className={`relative flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {/* Timeline node */}
                <div className="absolute -left-[19px] top-4 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-zinc-950" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto whitespace-nowrap">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-zinc-200 font-medium break-words">
                    {item.description}
                  </p>

                  <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    <span className="font-medium text-slate-700 dark:text-zinc-300">
                      {item.actor ? item.actor.email : "System / Unknown"}
                    </span>
                    <span>•</span>
                    <span
                      title={new Date(item.createdAt).toLocaleString()}
                      className="cursor-default"
                    >
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
