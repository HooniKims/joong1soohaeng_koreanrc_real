import { appsScriptUrl } from "./config.js";
import { calculateObjectiveScore } from "./progress.js";

async function requestSheet(action, payload) {
  if (!appsScriptUrl) {
    return { ok: true, skipped: true, record: {} };
  }

  if (appsScriptUrl.includes("script.google.com")) {
    return requestSheetWithJsonp(action, payload);
  }

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ action, ...payload }),
  });

  return response.json();
}

function requestSheetWithJsonp(action, payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `sheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(appsScriptUrl);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("action", action);
    Object.entries(payload).forEach(([key, value]) => {
      url.searchParams.set(key, String(value ?? ""));
    });

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("sheet_request_failed"));
    };
    script.src = url.toString();
    document.head.append(script);
  });
}

export async function getStudentRecord(student) {
  const result = await requestSheet("getRecord", {
    studentNumber: student.number,
    studentName: student.name,
  });

  if (!result.ok) {
    throw new Error(result.reason || "record_lookup_failed");
  }

  return result.record ?? {};
}

export async function submitAnswerScore(student, scoreKey, score) {
  const result = await requestSheet("submitAnswer", {
    studentNumber: student.number,
    studentName: student.name,
    scoreKey,
    score,
  });

  if (!result.ok && result.reason !== "already_submitted") {
    throw new Error(result.reason || "answer_submit_failed");
  }

  return result;
}

export async function submitSummary(student, scores, summary) {
  const result = await requestSheet("submitSummary", {
    studentNumber: student.number,
    studentName: student.name,
    summary,
    objectiveScore: calculateObjectiveScore(scores),
  });

  if (!result.ok) {
    throw new Error(result.reason || "summary_submit_failed");
  }

  return result;
}
