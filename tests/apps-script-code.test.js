const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class MockRange {
  constructor(sheet, row, column, rows = 1, columns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }

  getValue() {
    return this.sheet.getCell(this.row, this.column);
  }

  setValue(value) {
    this.sheet.setCell(this.row, this.column, value);
  }

  getValues() {
    return Array.from({ length: this.rows }, (_, rowOffset) =>
      Array.from({ length: this.columns }, (_, columnOffset) =>
        this.sheet.getCell(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }
}

class MockSheet {
  constructor(name, headers) {
    this.name = name;
    this.rows = [headers];
  }

  getRange(row, column, rows, columns) {
    return new MockRange(this, row, column, rows, columns);
  }

  getLastColumn() {
    return this.rows[0].length;
  }

  getLastRow() {
    return this.rows.length;
  }

  getCell(row, column) {
    return this.rows[row - 1]?.[column - 1] ?? "";
  }

  setCell(row, column, value) {
    while (this.rows.length < row) {
      this.rows.push([]);
    }
    this.rows[row - 1][column - 1] = value;
  }
}

function loadAppsScript(headers = ["학번", "이름", "1.1", "1.2", "최종 점수", "요약하기 점수"]) {
  const sheet = new MockSheet("1-1", headers);
  const spreadsheet = {
    getSheetByName(name) {
      return name === sheet.name ? sheet : null;
    },
  };

  const sandbox = {
    console,
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {},
        };
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return spreadsheet;
      },
    },
    ContentService: {
      MimeType: {
        JAVASCRIPT: "application/javascript",
        JSON: "application/json",
      },
      createTextOutput(body) {
        return {
          body,
          mimeType: "",
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          },
        };
      },
    },
  };

  const source = fs.readFileSync(path.join(root, "google-apps-script", "Code.gs"), "utf8");
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sheet, sandbox };
}

function runAction(sandbox, payload) {
  const output = sandbox.doGet({ parameter: payload });
  return JSON.parse(output.body);
}

function run() {
  const { sheet, sandbox } = loadAppsScript();

  const firstSubmit = runAction(sandbox, {
    action: "submitAnswer",
    studentNumber: "1101",
    studentName: "홍길동",
    scoreKey: "1.1",
    score: "1",
  });
  if (!firstSubmit.ok) {
    throw new Error(`first score submit failed: ${JSON.stringify(firstSubmit)}`);
  }
  if (sheet.getCell(2, 3) !== 1 || sheet.getCell(2, 5) !== 1) {
    throw new Error(`score or total was not written correctly: ${JSON.stringify(sheet.rows)}`);
  }

  const duplicateSubmit = runAction(sandbox, {
    action: "submitAnswer",
    studentNumber: "1101",
    studentName: "홍길동",
    scoreKey: "1.1",
    score: "0",
  });
  if (duplicateSubmit.ok || duplicateSubmit.reason !== "already_submitted") {
    throw new Error(`duplicate score should be rejected: ${JSON.stringify(duplicateSubmit)}`);
  }
  if (sheet.getCell(2, 3) !== 1 || sheet.getCell(2, 5) !== 1) {
    throw new Error(`duplicate score overwrote existing values: ${JSON.stringify(sheet.rows)}`);
  }

  const mismatch = runAction(sandbox, {
    action: "getRecord",
    studentNumber: "1101",
    studentName: "다른명",
  });
  if (mismatch.ok || mismatch.reason !== "student_number_name_mismatch") {
    throw new Error(`name mismatch should be rejected: ${JSON.stringify(mismatch)}`);
  }

  const summary = runAction(sandbox, {
    action: "submitSummary",
    studentNumber: "1101",
    studentName: "홍길동",
    summary: "요약문",
  });
  if (!summary.ok || sheet.getCell(2, 6) !== "요약문") {
    throw new Error(`summary was not saved to the first matching header: ${JSON.stringify(sheet.rows)}`);
  }

  console.log("apps script code passed");
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
