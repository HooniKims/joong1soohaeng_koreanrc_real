const steps = {
  center: "1",
  review: "2",
};

export function getClassSheetName(studentNumber) {
  const classCode = String(studentNumber).slice(0, 2);
  if (!/^1[1-5]$/.test(classCode)) {
    return "";
  }

  return `1-${classCode.slice(1)}`;
}

export function getScoreKey(paragraphIndex, step) {
  return `${paragraphIndex + 1}.${steps[step]}`;
}

export function hasSubmittedScore(scores, key) {
  return scores[key] !== undefined && scores[key] !== null && scores[key] !== "";
}

export function getNextResumePoint(scores, paragraphCount) {
  for (let paragraphIndex = 0; paragraphIndex < paragraphCount; paragraphIndex += 1) {
    const centerKey = getScoreKey(paragraphIndex, "center");
    const reviewKey = getScoreKey(paragraphIndex, "review");

    if (!hasSubmittedScore(scores, centerKey)) {
      return { paragraphIndex, step: "center" };
    }

    if (!hasSubmittedScore(scores, reviewKey)) {
      return { paragraphIndex, step: "review" };
    }
  }

  return { paragraphIndex: paragraphCount - 1, step: "summary" };
}

export function calculateObjectiveScore(scores) {
  return Object.values(scores).reduce((sum, value) => {
    const score = Number(value);
    return Number.isFinite(score) ? sum + score : sum;
  }, 0);
}

export function normalizeScores(record = {}) {
  const scores = {};
  Object.entries(record).forEach(([key, value]) => {
    if (/^[1-7]\.[12]$/.test(key) && hasSubmittedScore(record, key)) {
      scores[key] = Number(value);
    }
  });
  return scores;
}
