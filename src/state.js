// 문단 진행 상태와 정답 판정을 관리하는 모듈
export function createInitialState() {
  return {
    currentIndex: 0,
    selectedIndex: null,
    feedback: null,
    reviewTargetIndex: null,
    reviewStarted: false,
    reviewAnswerIndex: null,
    reviewFeedback: null,
    solvedParagraphs: new Set(),
    collectedCenters: [],
    isComplete: false,
  };
}

export function selectSentence(state, lesson, sentenceIndex) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const sentence = paragraph.sentences[sentenceIndex];
  const isCorrect = sentenceIndex === paragraph.centerIndex;

  state.selectedIndex = sentenceIndex;
  state.feedback = {
    isCorrect,
    role: sentence.role,
    relation: sentence.relation,
    sentence: sentence.text,
  };

  if (isCorrect && !state.solvedParagraphs.has(paragraph.id)) {
    state.solvedParagraphs.add(paragraph.id);
    state.reviewTargetIndex = pickReviewTargetIndex(paragraph);
    state.collectedCenters.push({
      paragraphId: paragraph.id,
      label: paragraph.label,
      text: sentence.text,
    });
  } else if (!isCorrect) {
    state.reviewTargetIndex = null;
    state.reviewStarted = false;
    state.reviewAnswerIndex = null;
    state.reviewFeedback = null;
  }

  return state.feedback;
}

export function startReviewQuestion(state) {
  if (!state.feedback?.isCorrect) {
    return false;
  }

  state.reviewStarted = true;
  return true;
}

export function selectReviewAnswer(state, lesson, sentenceIndex) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const answerIndex = state.reviewTargetIndex ?? pickReviewTargetIndex(paragraph);
  state.reviewTargetIndex = answerIndex;
  const isCorrect = sentenceIndex === answerIndex;

  state.reviewAnswerIndex = sentenceIndex;
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
  return Boolean(state.feedback?.isCorrect && state.reviewFeedback?.isCorrect);
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
  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
  state.reviewAnswerIndex = null;
  state.reviewFeedback = null;
  return true;
}

export function restartLesson(state) {
  state.currentIndex = 0;
  state.selectedIndex = null;
  state.feedback = null;
  state.reviewTargetIndex = null;
  state.reviewStarted = false;
  state.reviewAnswerIndex = null;
  state.reviewFeedback = null;
  state.solvedParagraphs.clear();
  state.collectedCenters = [];
  state.isComplete = false;
}
