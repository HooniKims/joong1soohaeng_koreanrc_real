const SCORE_HEADERS = [
  "1.1",
  "1.2",
  "2.1",
  "2.2",
  "3.1",
  "3.2",
  "4.1",
  "4.2",
  "5.1",
  "5.2",
  "6.1",
  "6.2",
  "7.1",
  "7.2",
];
const CLASS_SHEET_NAMES = ["1-1", "1-2", "1-3", "1-4", "1-5"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("수행평가 관리")
    .addItem("학번 순으로 정렬", "menuSortByStudentNumber")
    .addToUi();
}

function menuSortByStudentNumber() {
  const sortedCount = sortSheetsByStudentNumber_();
  SpreadsheetApp.getUi().alert(`${sortedCount}개 시트를 학번 순으로 정렬했습니다.`);
}

function doGet(e) {
  return handleRequest_(e.parameter);
}

function doPost(e) {
  const payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : e.parameter;
  return handleRequest_(payload);
}

function handleRequest_(payload) {
  const callback = payload.callback;
  const result = runAction_(payload);
  const body = callback
    ? `${callback}(${JSON.stringify(result)});`
    : JSON.stringify(result);
  const mimeType = callback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;

  return ContentService.createTextOutput(body).setMimeType(mimeType);
}

function runAction_(payload) {
  try {
    if (payload.action === "getRecord") {
      return getRecord_(payload);
    }

    if (payload.action === "submitAnswer") {
      return submitAnswer_(payload);
    }

    if (payload.action === "submitSummary") {
      return submitSummary_(payload);
    }

    return { ok: false, reason: "unknown_action" };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function getRecord_(payload) {
  const sheet = getStudentSheet_(payload.studentNumber);
  const headers = getHeaders_(sheet);
  const rowIndex = findOrCreateStudentRow_(sheet, headers, payload.studentNumber, payload.studentName);
  return { ok: true, record: getRowRecord_(sheet, headers, rowIndex) };
}

function submitAnswer_(payload) {
  if (SCORE_HEADERS.indexOf(payload.scoreKey) === -1) {
    return { ok: false, reason: "invalid_score_key" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const sheet = getStudentSheet_(payload.studentNumber);
    const headers = getHeaders_(sheet);
    const rowIndex = findOrCreateStudentRow_(sheet, headers, payload.studentNumber, payload.studentName);
    const columnIndex = headers.indexOf(payload.scoreKey) + 1;
    const cell = sheet.getRange(rowIndex, columnIndex);

    if (cell.getValue() !== "") {
      return { ok: false, reason: "already_submitted" };
    }

    cell.setValue(Number(payload.score));
    updateTotalScore_(sheet, headers, rowIndex);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function submitSummary_(payload) {
  const sheet = getStudentSheet_(payload.studentNumber);
  const headers = getHeaders_(sheet);
  const rowIndex = findOrCreateStudentRow_(sheet, headers, payload.studentNumber, payload.studentName);
  setFirstExistingHeader_(sheet, headers, rowIndex, ["요약하기", "요약하기 점수", "요약"], payload.summary);
  updateTotalScore_(sheet, headers, rowIndex);
  return { ok: true };
}

function sortSheetsByStudentNumber_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sortedCount = 0;

  CLASS_SHEET_NAMES.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 2) {
      return;
    }

    const headers = getHeaders_(sheet);
    const numberColumn = headers.indexOf("학번") + 1;
    if (!numberColumn) {
      throw new Error(`missing_student_number_header_${sheetName}`);
    }

    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .sort({ column: numberColumn, ascending: true });
    sortedCount += 1;
  });

  return sortedCount;
}

function getStudentSheet_(studentNumber) {
  const sheetName = getClassSheetName_(studentNumber);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`missing_sheet_${sheetName}`);
  }

  return sheet;
}

function getClassSheetName_(studentNumber) {
  const classCode = String(studentNumber).slice(0, 2);
  if (!/^1[1-5]$/.test(classCode)) {
    throw new Error("invalid_student_number");
  }

  return `1-${classCode.slice(1)}`;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function findOrCreateStudentRow_(sheet, headers, studentNumber, studentName) {
  const numberColumn = headers.indexOf("학번") + 1;
  const nameColumn = headers.indexOf("이름") + 1;

  if (!numberColumn || !nameColumn) {
    throw new Error("missing_required_headers");
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow > 1) {
    const numbers = sheet.getRange(2, numberColumn, lastRow - 1, 1).getValues();
    for (let index = 0; index < numbers.length; index += 1) {
      if (String(numbers[index][0]) === String(studentNumber)) {
        const rowIndex = index + 2;
        const existingName = String(sheet.getRange(rowIndex, nameColumn).getValue()).trim();
        const submittedName = String(studentName).trim();

        if (existingName && existingName !== submittedName) {
          throw new Error("student_number_name_mismatch");
        }

        if (!existingName) {
          sheet.getRange(rowIndex, nameColumn).setValue(submittedName);
        }

        return rowIndex;
      }
    }
  }

  const rowIndex = lastRow + 1;
  sheet.getRange(rowIndex, numberColumn).setValue(studentNumber);
  sheet.getRange(rowIndex, nameColumn).setValue(studentName);
  return rowIndex;
}

function getRowRecord_(sheet, headers, rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const record = {};
  headers.forEach((header, index) => {
    record[header] = values[index];
  });
  return record;
}

function updateTotalScore_(sheet, headers, rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const score = SCORE_HEADERS.reduce((sum, header) => {
    const columnIndex = headers.indexOf(header);
    return columnIndex === -1 ? sum : sum + (Number(values[columnIndex]) || 0);
  }, 0);

  setIfHeaderExists_(sheet, headers, rowIndex, "점수", score);
  setIfHeaderExists_(sheet, headers, rowIndex, "최종 점수", score);
}

function setIfHeaderExists_(sheet, headers, rowIndex, header, value) {
  const columnIndex = headers.indexOf(header) + 1;
  if (columnIndex > 0) {
    sheet.getRange(rowIndex, columnIndex).setValue(value);
  }
}

function setFirstExistingHeader_(sheet, headers, rowIndex, headerCandidates, value) {
  for (let index = 0; index < headerCandidates.length; index += 1) {
    const columnIndex = headers.indexOf(headerCandidates[index]) + 1;
    if (columnIndex > 0) {
      sheet.getRange(rowIndex, columnIndex).setValue(value);
      return true;
    }
  }

  return false;
}
