// Site-level streak, recovery-first. The chain continues through amber weeks;
// only a red week (or a gap with no data) breaks it. History is never erased —
// a broken chain reports the previous best. Pure + unit-tested.
import type { WeekStatus } from "./score";

export type WeekPoint = { weekStart: string; status: WeekStatus; score: number | null };

export type Streak = {
  chainWeeks: number; // current consecutive healthy (green/amber) weeks
  previousBest: number; // longest healthy run ever (>= chainWeeks)
  brokeRecently: boolean; // most recent week broke a chain (red)
};

function isHealthy(s: WeekStatus): boolean {
  return s === "green" || s === "amber";
}

/** `weeks` oldest → newest. */
export function computeStreak(weeks: WeekPoint[]): Streak {
  // Current chain: trailing run of healthy weeks.
  let chainWeeks = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (isHealthy(weeks[i].status)) chainWeeks++;
    else break;
  }

  // Longest healthy run anywhere.
  let best = 0;
  let run = 0;
  for (const w of weeks) {
    if (isHealthy(w.status)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  const last = weeks[weeks.length - 1];
  return {
    chainWeeks,
    previousBest: Math.max(best, chainWeeks),
    brokeRecently: chainWeeks === 0 && last?.status === "red",
  };
}

/** Whole days since the last incident (null = never / unknown). */
export function incidentFreeDays(lastIncidentAt: string | null, now: Date): number | null {
  if (!lastIncidentAt) return null;
  const then = new Date(lastIncidentAt).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
