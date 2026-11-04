// @ts-check
// Pure velocity from closed sprints (completed points); the average covers the last three.

/** @param {any[]} sprints */
function velocityOf(sprints) {
  const closed = (Array.isArray(sprints) ? sprints : []).filter((sprint) => sprint.status === "closed" && sprint.summary);
  const history = closed.map((sprint) => ({
    sprintId: sprint.id,
    name: sprint.name,
    committedPoints: sprint.summary.committedPoints,
    completedPoints: sprint.summary.completedPoints,
  }));
  const last = history.slice(-3);
  const average = last.length
    ? Math.round((last.reduce((total, item) => total + item.completedPoints, 0) / last.length) * 10) / 10
    : null;
  return { history, average };
}

module.exports = { velocityOf };
