import { addDays } from "./dates";

export type Phase = { title: string; weeks: number };
export type PlannedTask = { title: string; dueDate: string };

/**
 * One task per phase of the proposal's timeline. A phase is due on the last day of the week it ends in, counted from
 * the project's start day: start 2026-01-01, phases of 2 and 4 weeks -> due 2026-01-14 and 2026-02-11.
 */
export function planFromPhases(startDate: string, phases: readonly Phase[]): PlannedTask[] {
  let weeks = 0;
  return phases.map((phase) => {
    weeks += phase.weeks;
    return { title: phase.title, dueDate: addDays(startDate, weeks * 7 - 1) };
  });
}
