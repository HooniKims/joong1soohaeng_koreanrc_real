// 수행평가 입장 화면의 입력 제한과 화면 전환을 관리하는 모듈
const loginPageEl = document.querySelector("#login-page");
const mainAppEl = document.querySelector("#main-app");
const formEl = document.querySelector("#student-login-form");
const numberInputEl = document.querySelector("#student-number");
const nameInputEl = document.querySelector("#student-name");
const errorEl = document.querySelector("#login-error");
let isNameComposing = false;
let errorDismissTimer = null;

export function initStudentLogin(onConfirm) {
  numberInputEl.addEventListener("input", () => {
    numberInputEl.value = numberInputEl.value.replace(/\D/g, "").slice(0, 4);
    clearError();
  });

  nameInputEl.addEventListener("compositionstart", () => {
    isNameComposing = true;
  });

  nameInputEl.addEventListener("compositionend", () => {
    isNameComposing = false;
    nameInputEl.value = sanitizeName(nameInputEl.value);
    clearError();
  });

  nameInputEl.addEventListener("input", () => {
    clearError();
  });

  nameInputEl.addEventListener("blur", () => {
    if (!isNameComposing) {
      nameInputEl.value = sanitizeName(nameInputEl.value);
    }
  });

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const student = {
      number: numberInputEl.value.trim(),
      name: sanitizeName(nameInputEl.value.trim()),
    };
    nameInputEl.value = student.name;
    const missingFieldMessage = getMissingFieldMessage(student);

    if (missingFieldMessage) {
      showError(missingFieldMessage);
      focusFirstMissingField(student);
      return;
    }

    const errorMessage = validateStudent(student);

    if (errorMessage) {
      showError(errorMessage);
      return;
    }

    loginPageEl.hidden = true;
    mainAppEl.hidden = false;
    onConfirm(student);
  });
}

function getMissingFieldMessage(student) {
  if (!student.number && !student.name) {
    return "학번과 이름을 입력하세요.";
  }

  if (!student.number) {
    return "학번을 입력하세요.";
  }

  if (!student.name) {
    return "이름을 입력하세요.";
  }

  return "";
}

function focusFirstMissingField(student) {
  if (!student.number) {
    numberInputEl.focus();
    return;
  }

  if (!student.name) {
    nameInputEl.focus();
  }
}

function validateStudent(student) {
  if (!/^\d{4}$/.test(student.number)) {
    return "학번은 숫자 4자리로 입력하세요.";
  }

  if (!/^[가-힣]{1,5}$/.test(student.name)) {
    return "이름은 한글 1글자부터 5글자까지 입력하세요.";
  }

  return "";
}

function sanitizeName(value) {
  return value.replace(/[^가-힣]/g, "").slice(0, 5);
}

function showError(message) {
  window.clearTimeout(errorDismissTimer);
  errorEl.textContent = message;
  errorEl.dataset.visible = "true";
  errorEl.style.animation = "none";
  errorEl.offsetHeight;
  errorEl.style.animation = "";
  errorDismissTimer = window.setTimeout(() => {
    errorEl.dataset.visible = "false";
    errorEl.textContent = "";
  }, 2400);
}

function clearError() {
  window.clearTimeout(errorDismissTimer);
  errorEl.dataset.visible = "false";
  errorEl.textContent = "";
}
