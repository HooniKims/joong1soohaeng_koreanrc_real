// 학습 웹앱의 초기화와 사용자 상호작용을 연결하는 모듈
import { lesson } from "./data.js";
import { initStudentLogin } from "./login.js";
import {
  createInitialState,
  clearPendingSentenceSelection,
  moveNext,
  requestPendingSelectionFinalConfirm,
  requestPendingReviewFinalConfirm,
  restartLesson,
  clearPendingReviewAnswerSelection,
  selectReviewAnswer,
  selectSentence,
  setPendingReviewAnswerSelection,
  setPendingSentenceSelection,
  startReviewQuestion,
  submitStudentSummary,
} from "./state.js";
import {
  renderParagraph,
  renderProgress,
  renderStaticHeader,
  renderSummary,
} from "./render.js";

const state = createInitialState();
const isSummaryPreview = new URLSearchParams(window.location.search).has("summaryPreview");

function paint(options = {}) {
  renderProgress(lesson, state);

  if (state.isComplete) {
    renderSummary(lesson, state, {
      onSubmit: (summaryText) => {
        submitStudentSummary(state, summaryText);
        paint({ animate: false });
      },
      onRestart: () => {
        restartLesson(state);
        paint();
      },
    });
    return;
  }

  renderParagraph(lesson, state, {
    animate: options.animate ?? true,
    isLast: state.currentIndex === lesson.paragraphs.length - 1,
    onSelect: (selection) => {
      setPendingSentenceSelection(state, selection);
      paint({ animate: false });
    },
    onConfirmSelection: () => {
      if (!state.pendingSelection) {
        return;
      }

      requestPendingSelectionFinalConfirm(state);
      paint({ animate: false });
    },
    onFinalConfirmSelection: () => {
      if (!state.pendingSelection) {
        return;
      }

      selectSentence(state, lesson, state.pendingSelection.sentenceIndex);
      paint({ animate: false });
    },
    onCancelSelection: () => {
      clearPendingSentenceSelection(state);
      paint({ animate: false });
    },
    onReviewSelect: (sentenceIndex) => {
      setPendingReviewAnswerSelection(state, sentenceIndex);
      paint({ animate: false });
    },
    onConfirmReviewSelection: () => {
      requestPendingReviewFinalConfirm(state);
      paint({ animate: false });
    },
    onFinalConfirmReviewSelection: () => {
      if (!state.pendingReviewSelection) {
        return;
      }

      selectReviewAnswer(state, lesson, state.pendingReviewSelection.answerIndex);
      paint({ animate: false });
    },
    onCancelReviewSelection: () => {
      clearPendingReviewAnswerSelection(state);
      paint({ animate: false });
    },
    onReviewStart: () => {
      startReviewQuestion(state);
      paint({ animate: false });
    },
    onNext: () => {
      moveNext(state, lesson);
      paint({ animate: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
}

function showMainApp() {
  document.querySelector("#login-page").hidden = true;
  document.querySelector("#main-app").hidden = false;
}

function prepareSummaryPreview() {
  lesson.paragraphs.forEach((paragraph) => {
    state.solvedParagraphs.add(paragraph.id);
    state.collectedCenters.push({
      paragraphId: paragraph.id,
      label: paragraph.label,
      text: paragraph.sentences[paragraph.centerIndex].text,
    });
  });
  state.currentIndex = lesson.paragraphs.length - 1;
  state.isComplete = true;
}

if (isSummaryPreview) {
  prepareSummaryPreview();
  showMainApp();
  renderStaticHeader(lesson);
  paint({ animate: false });
  window.scrollTo({ top: 0, behavior: "auto" });
} else {
  initStudentLogin(() => {
    showMainApp();
    renderStaticHeader(lesson);
    paint();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}
