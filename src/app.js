// 학습 웹앱의 초기화와 사용자 상호작용을 연결하는 모듈
import { lesson } from "./data.js";
import { initStudentLogin } from "./login.js";
import {
  createInitialState,
  moveNext,
  restartLesson,
  selectReviewAnswer,
  selectSentence,
  startReviewQuestion,
} from "./state.js";
import {
  renderParagraph,
  renderProgress,
  renderStaticHeader,
  renderSummary,
} from "./render.js";

const state = createInitialState();

function paint(options = {}) {
  renderProgress(lesson, state);

  if (state.isComplete) {
    renderSummary(lesson, state, {
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
    onSelect: (sentenceIndex) => {
      selectSentence(state, lesson, sentenceIndex);
      paint({ animate: false });
    },
    onReviewSelect: (sentenceIndex) => {
      selectReviewAnswer(state, lesson, sentenceIndex);
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

initStudentLogin(() => {
  renderStaticHeader(lesson);
  paint();
  window.scrollTo({ top: 0, behavior: "auto" });
});
