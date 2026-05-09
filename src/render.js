// 학습 화면과 피드백 화면을 그리는 렌더링 모듈
import { buildSummaryPieces } from "./summary.js";

const titleEl = document.querySelector("#lesson-title");
const subtitleEl = document.querySelector("#lesson-subtitle");
const progressLabelEl = document.querySelector("#progress-label");
const progressDotsEl = document.querySelector("#progress-dots");
const stageEl = document.querySelector("#lesson-stage");
const summaryEl = document.querySelector("#summary-stage");

export function renderStaticHeader(lesson) {
  titleEl.textContent = lesson.title;
  subtitleEl.textContent = lesson.subtitle;
}

export function renderProgress(lesson, state) {
  const currentNumber = Math.min(state.currentIndex + 1, lesson.paragraphs.length);
  progressLabelEl.textContent = state.isComplete
    ? "모든 문단 학습 완료"
    : `${currentNumber} / ${lesson.paragraphs.length} 문단`;

  progressDotsEl.replaceChildren(
    ...lesson.paragraphs.map((paragraph, index) => {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      dot.dataset.active = String(index === state.currentIndex && !state.isComplete);
      dot.dataset.done = String(state.solvedParagraphs.has(paragraph.id));
      dot.setAttribute("aria-label", `${paragraph.label} 진행 표시`);
      return dot;
    }),
  );
}

export function renderParagraph(lesson, state, handlers) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const isSolved = state.solvedParagraphs.has(paragraph.id);

  const section = document.createElement("article");
  section.className = "paragraph-panel";
  section.dataset.animate = String(handlers.animate ?? true);
  section.innerHTML = `
    <div class="paragraph-kicker">${paragraph.label}</div>
    <h2>${paragraph.sectionTitle}</h2>
    <p class="task-text">문장을 차례로 읽고 이 문단의 중심 문장을 선택하세요.</p>
    <div class="sentence-list"></div>
    <div class="feedback-panel" hidden></div>
    <div class="action-row"></div>
  `;

  const list = section.querySelector(".sentence-list");
  paragraph.sentences.forEach((sentence, index) => {
    const sentenceEl = document.createElement("span");
    sentenceEl.className = "sentence-block";
    sentenceEl.style.setProperty("--delay", `${index * 90}ms`);
    sentenceEl.dataset.animate = String(handlers.animate ?? true);
    sentenceEl.dataset.selected = String(state.selectedIndex === index);
    sentenceEl.dataset.correct = String(isSolved && index === paragraph.centerIndex);
    sentenceEl.dataset.noncenter = String(isSolved && index !== paragraph.centerIndex);
    sentenceEl.dataset.incorrect = String(
      state.selectedIndex === index && state.feedback && !state.feedback.isCorrect,
    );
    sentenceEl.dataset.disabled = String(isSolved);
    sentenceEl.setAttribute("role", "button");
    sentenceEl.setAttribute("tabindex", isSolved ? "-1" : "0");
    sentenceEl.setAttribute("aria-label", `${index + 1}문장 선택. ${sentence.text}`);
    sentenceEl.innerHTML = `<span class="sentence-text">${sentence.text}</span>`;

    if (!isSolved) {
      sentenceEl.addEventListener("click", (event) => {
        handlers.onSelect(createPendingSelection(index, event, sentenceEl, list));
      });
      sentenceEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlers.onSelect(createPendingSelection(index, event, sentenceEl, list));
        }
      });
    }

    list.append(sentenceEl);
    list.append(document.createTextNode(" "));
  });

  renderSelectionConfirm(list, state, handlers);
  renderFeedback(section, paragraph, state, handlers);
  stageEl.replaceChildren(section);
  summaryEl.hidden = true;
}

function createPendingSelection(sentenceIndex, event, sentenceEl, list) {
  const listRect = list.getBoundingClientRect();
  const sentenceRect = sentenceEl.getBoundingClientRect();
  const clientX = event.clientX || sentenceRect.left + Math.min(sentenceRect.width / 2, 160);
  const clientY = event.clientY || sentenceRect.top + sentenceRect.height / 2;
  const confirmWidth = Math.min(260, Math.max(160, listRect.width - 28));
  const horizontalPadding = confirmWidth / 2 + 8;

  return {
    sentenceIndex,
    left: clamp(
      clientX - listRect.left,
      horizontalPadding,
      Math.max(horizontalPadding, listRect.width - horizontalPadding),
    ),
    top: clamp(clientY - listRect.top, 14, Math.max(14, listRect.height - 14)),
  };
}

function renderSelectionConfirm(list, state, handlers) {
  if (!state.pendingSelection) {
    return;
  }

  const confirmEl = document.createElement("div");
  confirmEl.className = "selection-confirm";
  confirmEl.dataset.placement = state.pendingSelection.top < 96 ? "below" : "above";
  confirmEl.style.left = `${state.pendingSelection.left}px`;
  confirmEl.style.top = `${state.pendingSelection.top}px`;
  confirmEl.setAttribute("role", "dialog");
  confirmEl.setAttribute("aria-label", state.pendingSelection.isFinalConfirm ? "최종 선택 확인" : "선택 확인");
  const isSaving = state.submittingAnswerStep === "center";
  const prompt = isSaving
    ? "답을 저장 중입니다."
    : state.pendingSelection.isFinalConfirm
    ? "진짜 후회 없죠?"
    : "이 문장으로 선택할까요?";
  const primaryClass = state.pendingSelection.isFinalConfirm
    ? "final-confirm-selection"
    : "confirm-selection";
  confirmEl.innerHTML = `
    <p class="${isSaving ? "answer-saving-title" : ""}">${prompt}</p>
    ${isSaving ? `<p class="answer-saving-copy">잠시만 기다려 주세요.</p>` : ""}
    <div class="selection-confirm-actions">
      <button class="${primaryClass}" type="button" ${isSaving ? "disabled" : ""}>확인</button>
      <button class="cancel-selection" type="button" ${isSaving ? "disabled" : ""}>다시 선택</button>
    </div>
  `;

  if (isSaving) {
    list.append(confirmEl);
    return;
  }

  if (state.pendingSelection.isFinalConfirm) {
    confirmEl
      .querySelector(".final-confirm-selection")
      .addEventListener("click", handlers.onFinalConfirmSelection);
  } else {
    confirmEl.querySelector(".confirm-selection").addEventListener("click", handlers.onConfirmSelection);
  }
  confirmEl.querySelector(".cancel-selection").addEventListener("click", handlers.onCancelSelection);
  list.append(confirmEl);
  requestAnimationFrame(() =>
    confirmEl.querySelector(".confirm-selection, .final-confirm-selection")?.focus(),
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderFeedback(section, paragraph, state, handlers) {
  const feedbackPanel = section.querySelector(".feedback-panel");
  const actionRow = section.querySelector(".action-row");

  if (!state.feedback) {
    feedbackPanel.hidden = true;
    actionRow.replaceChildren();
    return;
  }

  feedbackPanel.hidden = false;
  feedbackPanel.className = `feedback-panel ${state.feedback.isCorrect ? "is-correct" : "is-wrong"}`;
  feedbackPanel.dataset.animate = String(handlers.animate ?? true);

  if (state.feedback.isCorrect) {
    const shouldShowRelations = !state.reviewStarted || state.reviewFeedback?.isCorrect;
    feedbackPanel.innerHTML = `
      <p class="feedback-title">정답입니다.</p>
      <p class="feedback-copy">이 문장이 문단의 핵심 생각을 가장 넓게 담고 있습니다.</p>
      ${shouldShowRelations ? renderRelationList(paragraph) : ""}
      ${
        state.reviewStarted
          ? renderReviewQuestion(paragraph, state)
          : `
            <div class="review-ready">
              <div>
                <p class="review-ready-title">이제 확인 문제를 풀겠습니다.</p>
                <p class="shiny-text">그 전에 각 문장의 설명을 잘 읽어보세요.</p>
              </div>
              <button class="secondary-action review-start" type="button">확인 문제 풀기</button>
            </div>
          `
      }
    `;
  } else {
    feedbackPanel.innerHTML = `
      <p class="feedback-title">오답입니다.</p>
      <p class="feedback-copy">선택한 문장은 <strong>${state.feedback.role}</strong>입니다.</p>
      <p class="hint-copy">${state.feedback.relation}</p>
      ${
        state.reviewStarted
          ? renderReviewQuestion(paragraph, state)
          : `
            ${renderRelationList(paragraph)}
            <div class="review-ready">
              <div>
                <p class="review-ready-title">이제 확인 문제를 풀겠습니다.</p>
                <p class="shiny-text">각 문장의 설명을 확인한 뒤 문제로 넘어가세요.</p>
              </div>
              <button class="secondary-action review-start" type="button">확인 문제 풀기</button>
            </div>
          `
      }
    `;
  }

  feedbackPanel.querySelectorAll(".review-option").forEach((button, index) => {
    button.addEventListener("click", () => handlers.onReviewSelect(index));
  });
  feedbackPanel
    .querySelector(".review-confirm-step")
    ?.addEventListener("click", handlers.onConfirmReviewSelection);
  feedbackPanel
    .querySelector(".review-final-confirm-step")
    ?.addEventListener("click", handlers.onFinalConfirmReviewSelection);
  feedbackPanel
    .querySelector(".review-cancel-selection")
    ?.addEventListener("click", handlers.onCancelReviewSelection);
  feedbackPanel.querySelector(".review-start")?.addEventListener("click", handlers.onReviewStart);

  actionRow.replaceChildren();
  if (state.feedback && state.reviewFeedback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-action";
    button.textContent = handlers.isLast ? "전체 요약 보기" : "다음 문단으로";
    button.addEventListener("click", handlers.onNext);
    actionRow.append(button);
  }
}

function renderRelationList(paragraph) {
  return `
    <div class="relation-list">
      ${paragraph.sentences
        .map(
          (sentence, index) => `
            <div class="relation-item ${index === paragraph.centerIndex ? "is-center" : ""}">
              <span>${index + 1}문장</span>
              <p>${sentence.relation}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderReviewQuestion(paragraph, state) {
  const answerIndex = state.reviewTargetIndex;
  const review = createReviewQuestion(paragraph, answerIndex);

  return `
    <section class="review-panel" aria-label="문장 내용 확인 문제">
      <p class="review-kicker">확인 문제</p>
      <h3>${review.prompt}</h3>
      <div class="review-options">
        ${paragraph.sentences
          .map(
            (sentence, index) => `
              <button
                class="review-option"
                type="button"
                data-selected="${state.reviewAnswerIndex === index}"
                data-correct="${state.reviewFeedback?.isCorrect && answerIndex === index}"
                data-incorrect="${state.reviewAnswerIndex === index && state.reviewFeedback && !state.reviewFeedback.isCorrect}"
                ${state.reviewFeedback ? "disabled" : ""}
              >
                <span>${index + 1}문장</span>
              </button>
            `,
          )
          .join("")}
      </div>
      ${renderReviewAnswerConfirm(state)}
      ${
        state.reviewFeedback
          ? `<p class="review-feedback" data-correct="${state.reviewFeedback.isCorrect}">${state.reviewFeedback.message}</p>`
          : `<p class="review-help">본문의 각 문장이 무슨 역할을 했는지 떠올리며 골라 보세요.</p>`
      }
    </section>
  `;
}

function renderReviewAnswerConfirm(state) {
  if (!state.pendingReviewSelection || state.reviewFeedback) {
    return "";
  }

  const answerNumber = state.pendingReviewSelection.answerIndex + 1;
  const isSaving = state.submittingAnswerStep === "review";
  const prompt = isSaving
    ? "답을 저장 중입니다."
    : state.pendingReviewSelection.isFinalConfirm
    ? "마지막 확인입니다. 이 답으로 확정할까요?"
    : `${answerNumber}문장으로 제출할까요?`;
  const primaryClass = state.pendingReviewSelection.isFinalConfirm
    ? "review-final-confirm-step"
    : "review-confirm-step";

  return `
    <div class="review-answer-confirm" role="status" aria-live="polite">
      <p class="${isSaving ? "answer-saving-title" : ""}">${prompt}</p>
      ${isSaving ? `<p class="answer-saving-copy">잠시만 기다려 주세요.</p>` : ""}
      <div class="review-answer-confirm-actions">
        <button class="${primaryClass}" type="button" ${isSaving ? "disabled" : ""}>제출</button>
        <button class="review-cancel-selection" type="button" ${isSaving ? "disabled" : ""}>다시 고르기</button>
      </div>
    </div>
  `;
}

function createReviewQuestion(paragraph, answerIndex) {
  const sentence = paragraph.sentences[answerIndex];
  const clue = sentence.relation.split(".")[0];

  return {
    prompt: `다음 설명에 해당하는 문장은 몇 번째 문장인가요? ${clue}.`,
  };
}

export function renderSummary(lesson, state, handlers) {
  stageEl.replaceChildren();
  summaryEl.hidden = false;
  if (!state.shuffledSummaryCenters) {
    state.shuffledSummaryCenters = shuffleSummaryCenters(state.collectedCenters);
  }
  const pieces = buildSummaryPieces(state.shuffledSummaryCenters);

  summaryEl.innerHTML = `
    <div class="summary-panel">
      <p class="eyebrow">전체 글 요약</p>
      <h2>중심 문장들을 바탕으로 전체 글을 직접 요약하세요.</h2>
      <div class="collected-sentences">
        ${pieces
          .map(
            (piece, index) => `
              <div class="center-chip" style="--delay:${index * 100}ms">
                <div class="center-chip-header">
                  <span>${piece.label}</span>
                  <button class="copy-center-sentence" type="button" data-copy-text="${escapeHtml(piece.text)}">복사하기</button>
                </div>
                <p>${piece.text}</p>
              </div>
            `,
          )
          .join("")}
      </div>
      <form class="student-summary-form">
        <label for="student-summary">나의 요약</label>
        <textarea
          id="student-summary"
          name="studentSummary"
          rows="6"
          placeholder="중심 문장들을 이어 보며 전체 글의 핵심 내용을 직접 정리해 보세요."
          ${state.isSummarySubmitted ? "disabled" : ""}
        >${escapeHtml(state.studentSummary)}</textarea>
        <div class="summary-actions">
          <button class="summary-submit" type="submit" ${state.isSummarySubmitted ? "disabled" : ""}>제출</button>
          <button class="secondary-action" type="button">처음부터 다시 학습하기</button>
        </div>
        ${
          state.isSummarySubmitted
            ? `<p class="summary-submit-message">요약이 제출되었습니다.</p>`
            : `<p class="summary-submit-help">빈칸에 직접 요약을 쓴 뒤 제출하세요.</p>`
        }
      </form>
    </div>
  `;

  summaryEl.querySelector(".student-summary-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onSubmit(summaryEl.querySelector("#student-summary").value);
  });
  summaryEl.querySelectorAll(".copy-center-sentence").forEach((button) => {
    button.addEventListener("click", () => copyCenterSentence(button));
  });
  summaryEl.querySelector(".secondary-action").addEventListener("click", handlers.onRestart);
  summaryEl.dataset.summary = state.studentSummary;
  renderProgress(lesson, state);
}

function shuffleSummaryCenters(collectedCenters) {
  const shuffled = [...collectedCenters];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (isOriginalOrder(collectedCenters, shuffled) && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function isOriginalOrder(original, shuffled) {
  return original.every((item, index) => item.paragraphId === shuffled[index]?.paragraphId);
}

async function copyCenterSentence(button) {
  const text = button.dataset.copyText;
  await navigator.clipboard.writeText(text);
  button.textContent = "복사됨";
  window.setTimeout(() => {
    button.textContent = "복사하기";
  }, 1200);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
