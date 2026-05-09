// 문단 진행 상태와 정답 판정을 관리하는 모듈
export function createInitialState() {
  return {
    currentIndex: 0,
    answerScores: {},
    selectedIndex: null,
    pendingSelection: null,
    feedback: null,
    reviewTargetIndex: null,
    reviewStarted: false,
    reviewAnswerIndex: null,
    pendingReviewSelection: null,
    reviewFeedback: null,
    solvedParagraphs: new Set(),
    collectedCenters: [],
    shuffledSummaryCenters: null,
    studentSummary: "",
    isSummarySubmitted: false,
    isComplete: false,
  };
}

export function restoreProgressFromRecord(state, lesson, record, helpers) {
  state.answerScores = helpers.normalizeScores(record);
  state.solvedParagraphs.clear();
  state.collectedCenters = [];

  lesson.paragraphs.forEach((paragraph, index) => {
    if (helpers.hasSubmittedScore(state.answerScores, helpers.getScoreKey(index, "center"))) {
      state.solvedParagraphs.add(paragraph.id);
      state.collectedCenters.push({
        paragraphId: paragraph.id,
        label: paragraph.label,
        text: paragraph.sentences[paragraph.centerIndex].text,
      });
    }
  });

  const resumePoint = helpers.getNextResumePoint(state.answerScores, lesson.paragraphs.length);
  state.currentIndex = resumePoint.paragraphIndex;
  state.selectedIndex = null;
  state.pendingSelection = null;
  state.reviewAnswerIndex = null;
  state.pendingReviewSelection = null;
  state.reviewFeedback = null;
  state.shuffledSummaryCenters = null;
  state.studentSummary = record["요약하기"] ?? record["요약하기 점수"] ?? "";
  state.isSummarySubmitted = Boolean(state.studentSummary);
  state.isComplete = resumePoint.step === "summary";

  if (resumePoint.step === "review") {
    const paragraph = lesson.paragraphs[resumePoint.paragraphIndex];
    const centerScore = Number(state.answerScores[helpers.getScoreKey(resumePoint.paragraphIndex, "center")]);
    const centerSentence = paragraph.sentences[paragraph.centerIndex];
    state.feedback = {
      isCorrect: centerScore === 1,
      role: centerScore === 1 ? centerSentence.role : "이미 제출된 선택",
      relation: centerScore === 1 ? centerSentence.relation : "이미 제출된 중심 문장 선택입니다.",
      sentence: centerSentence.text,
    };
    state.reviewTargetIndex = pickReviewTargetIndex(paragraph);
    state.reviewStarted = true;
    return;
  }

  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
}

export function recordAnswerScore(state, scoreKey, score) {
  if (state.answerScores[scoreKey] !== undefined && state.answerScores[scoreKey] !== "") {
    return false;
  }

  state.answerScores[scoreKey] = score;
  return true;
}

export function setPendingSentenceSelection(state, selection) {
  state.selectedIndex = selection.sentenceIndex;
  state.pendingSelection = {
    ...selection,
    isFinalConfirm: false,
  };
  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
  state.reviewAnswerIndex = null;
  state.pendingReviewSelection = null;
  state.reviewFeedback = null;
}

export function requestPendingSelectionFinalConfirm(state) {
  if (!state.pendingSelection) {
    return false;
  }

  state.pendingSelection.isFinalConfirm = true;
  return true;
}

export function clearPendingSentenceSelection(state) {
  state.pendingSelection = null;
  state.selectedIndex = null;
}

export function selectSentence(state, lesson, sentenceIndex) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const sentence = paragraph.sentences[sentenceIndex];
  const isCorrect = sentenceIndex === paragraph.centerIndex;

  state.selectedIndex = sentenceIndex;
  state.pendingSelection = null;
  state.feedback = {
    isCorrect,
    role: sentence.role,
    relation: sentence.relation,
    sentence: sentence.text,
  };

  if (!state.solvedParagraphs.has(paragraph.id)) {
    state.solvedParagraphs.add(paragraph.id);
    state.reviewTargetIndex = pickReviewTargetIndex(paragraph);
    state.reviewStarted = false;
    state.collectedCenters.push({
      paragraphId: paragraph.id,
      label: paragraph.label,
      text: paragraph.sentences[paragraph.centerIndex].text,
    });
  }

  state.reviewAnswerIndex = null;
  state.pendingReviewSelection = null;
  state.reviewFeedback = null;
  return state.feedback;
}

export function startReviewQuestion(state) {
  if (!state.feedback) {
    return false;
  }

  state.reviewStarted = true;
  return true;
}

export function setPendingReviewAnswerSelection(state, answerIndex) {
  if (!state.reviewStarted || state.reviewFeedback?.isCorrect) {
    return false;
  }

  state.reviewAnswerIndex = answerIndex;
  state.pendingReviewSelection = {
    answerIndex,
    isFinalConfirm: false,
  };
  state.reviewFeedback = null;
  return true;
}

export function requestPendingReviewFinalConfirm(state) {
  if (!state.pendingReviewSelection) {
    return false;
  }

  state.pendingReviewSelection.isFinalConfirm = true;
  return true;
}

export function clearPendingReviewAnswerSelection(state) {
  state.pendingReviewSelection = null;
  state.reviewAnswerIndex = null;
}

export function selectReviewAnswer(state, lesson, sentenceIndex) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const answerIndex = state.reviewTargetIndex ?? pickReviewTargetIndex(paragraph);
  state.reviewTargetIndex = answerIndex;
  const isCorrect = sentenceIndex === answerIndex;

  state.reviewAnswerIndex = sentenceIndex;
  state.pendingReviewSelection = null;
  state.reviewFeedback = {
    isCorrect,
    message: isCorrect
      ? `맞습니다. ${answerIndex + 1}문장을 정확히 찾았습니다. 문장 설명을 다시 확인한 뒤 다음 문단으로 넘어가세요.`
      : `${sentenceIndex + 1}문장은 ${paragraph.sentences[sentenceIndex].role}입니다. ${paragraph.sentences[sentenceIndex].relation}`,
  };

  return state.reviewFeedback;
}

function pickReviewTargetIndex(paragraph) {
  const candidateIndexes = paragraph.sentences
    .map((sentence, index) => index)
    .filter((index) => index !== paragraph.centerIndex);

  return candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];
}

export function canMoveNext(state) {
  return Boolean(state.feedback && state.reviewFeedback);
}

export function submitStudentSummary(state, summaryText) {
  const normalizedSummary = summaryText.trim();
  if (!normalizedSummary) {
    return false;
  }

  state.studentSummary = normalizedSummary;
  state.isSummarySubmitted = true;
  return true;
}

export function moveNext(state, lesson) {
  if (!canMoveNext(state)) {
    return false;
  }

  if (state.currentIndex >= lesson.paragraphs.length - 1) {
    state.isComplete = true;
    return true;
  }

  state.currentIndex += 1;
  state.selectedIndex = null;
  state.pendingSelection = null;
  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
  state.reviewAnswerIndex = null;
  state.pendingReviewSelection = null;
  state.reviewFeedback = null;
  return true;
}

export function restartLesson(state) {
  state.currentIndex = 0;
  state.selectedIndex = null;
  state.pendingSelection = null;
  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
  state.reviewAnswerIndex = null;
  state.pendingReviewSelection = null;
  state.reviewFeedback = null;
  state.solvedParagraphs.clear();
  state.collectedCenters = [];
  state.shuffledSummaryCenters = null;
  state.studentSummary = "";
  state.isSummarySubmitted = false;
  state.isComplete = false;
}
