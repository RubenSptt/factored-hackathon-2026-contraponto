// Small presentation helpers shared by the agent desk views.

import type { HandoffCase, HandoffPriority } from "../_lib/api";
import type { Dictionary } from "../_lib/i18n";

const PRIORITY_RANK: Record<HandoffPriority, number> = { urgent: 0, high: 1, normal: 2 };

/** Triage order: priority first, then newest first. */
export function sortForTriage(cases: HandoffCase[]): HandoffCase[] {
  return [...cases].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.created_at.localeCompare(a.created_at),
  );
}

export function formatAge(createdAt: string, now: number, t: Dictionary): string {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  return minutes < 60
    ? t.agentDesk.minutesAgo(minutes)
    : t.agentDesk.hoursAgo(Math.floor(minutes / 60));
}

export function intentLabel(intent: string, t: Dictionary): string {
  return t.agentDesk.intents[intent] ?? intent;
}
