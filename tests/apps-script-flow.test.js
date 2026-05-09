const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".ttf", "font/ttf"],
]);

function createServer(requests, record) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/mock-db") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const payload = body ? JSON.parse(body) : {};
        requests.push(payload);

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        if (payload.action === "getRecord") {
          if (record.ok === false) {
            res.end(JSON.stringify(record));
            return;
          }
          res.end(JSON.stringify({ ok: true, record }));
          return;
        }

        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    const urlPath = decodeURIComponent(url.pathname);
    const safePath = path.normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^[/\\]+/, "");
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404).end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": types.get(path.extname(filePath)) || "application/octet-stream",
      });
      res.end(data);
    });
  });
}

async function login(page) {
  await page.locator("#student-number").fill("1101");
  await page.locator("#student-name").fill("홍길동");
  await page.locator(".login-submit").click();
}

async function runResumeScenario() {
  const requests = [];
  const server = createServer(requests, {
    "학번": "1101",
    "이름": "홍길동",
    "1.1": 1,
    "1.2": 0,
    "2.1": 1,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "/mock-db" };
    });
    await page.goto(`${baseUrl}/`);
    await login(page);

    await page.locator(".review-panel").waitFor({ state: "visible" });
    const progressText = await page.locator("#progress-label").textContent();
    if (!progressText.includes("2 / 7")) {
      throw new Error(`expected resume at paragraph 2, got ${progressText}`);
    }

    const firstRequest = requests[0];
    if (firstRequest.action !== "getRecord" || firstRequest.studentNumber !== "1101") {
      throw new Error(`wrong login lookup payload: ${JSON.stringify(firstRequest)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function runAnswerSubmitScenario() {
  const requests = [];
  const server = createServer(requests, {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "/mock-db" };
    });
    await page.goto(`${baseUrl}/`);
    await login(page);

    await page.locator(".sentence-block").first().click();
    await page.locator(".confirm-selection").click();
    await page.locator(".final-confirm-selection").click();
    await page.locator(".feedback-panel.is-wrong").waitFor({ state: "visible" });

    const answerRequest = requests.find((request) => request.action === "submitAnswer");
    if (!answerRequest) {
      throw new Error(`missing submitAnswer request: ${JSON.stringify(requests)}`);
    }

    if (answerRequest.scoreKey !== "1.1" || answerRequest.score !== 0) {
      throw new Error(`wrong answer payload: ${JSON.stringify(answerRequest)}`);
    }

    console.log("apps script flow passed");
  } finally {
    await browser.close();
    server.close();
  }
}

async function runNameMismatchScenario() {
  const requests = [];
  const server = createServer(requests, {
    ok: false,
    reason: "student_number_name_mismatch",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "/mock-db" };
    });
    await page.goto(`${baseUrl}/`);
    await login(page);

    await page.locator("#login-error").waitFor({ state: "visible" });
    const message = await page.locator("#login-error").textContent();
    if (!message.includes("이미 다른 이름으로 등록된 학번입니다")) {
      throw new Error(`wrong mismatch error message: ${message}`);
    }

    const mainHidden = await page.locator("#main-app").evaluate((element) => element.hidden);
    if (!mainHidden) {
      throw new Error("mismatch login should not enter the main app");
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function run() {
  await runResumeScenario();
  await runAnswerSubmitScenario();
  await runNameMismatchScenario();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
