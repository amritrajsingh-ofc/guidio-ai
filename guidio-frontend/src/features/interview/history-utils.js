import { asArray } from "./interview-utils";

export const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "IN_PROGRESS", label: "In progress" },
];

export function filterInterviews(interviews, filter) {
  const list = asArray(interviews);

  if (filter === "COMPLETED") {
    return list.filter((item) => item.status === "COMPLETED");
  }

  if (filter === "IN_PROGRESS") {
    return list.filter((item) => item.status !== "COMPLETED");
  }

  return list;
}

function getScoredInterviews(interviews) {
  return asArray(interviews).filter(
    (item) => item.status === "COMPLETED" && typeof item.overallScore === "number"
  );
}

/** Real numbers only. average and best are null until there is a score. */
export function getHistoryStats(interviews) {
  const list = asArray(interviews);
  const completed = list.filter((item) => item.status === "COMPLETED").length;
  const scored = getScoredInterviews(list);

  const total = scored.reduce((sum, item) => sum + item.overallScore, 0);

  return {
    total: list.length,
    completed,
    inProgress: list.length - completed,
    average: scored.length > 0 ? Math.round(total / scored.length) : null,
    best:
      scored.length > 0
        ? Math.max(...scored.map((item) => item.overallScore))
        : null,
  };
}

/** The latest completed, scored interviews, oldest first. */
export function getScoreTrend(interviews, limit = 10) {
  const time = (item) => new Date(item.completedAt || item.createdAt).getTime() || 0;

  return getScoredInterviews(interviews)
    .sort((a, b) => time(a) - time(b))
    .slice(-limit);
}