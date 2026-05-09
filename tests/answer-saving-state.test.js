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

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/mock-db") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const payload = body ? JSON.parse(body) : {};
        const delay = payload.action === "submitAnswer" ? 1000 : 0;
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          if (payload.action === "getRecord") {
            res.end(JSON.stringify({ ok: true, record: {} }));
            return;
          }
          res.end(JSON.stringify({ ok: true }));
        }, delay);
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

async function expectSavingMessage(container) {
  await container.locator(".answer-saving-title").waitFor({ state: "visible", timeout: 1500 });
  const title = await container.locator(".answer-saving-title").textContent();
  if (title !== "답을 저장 중입니다.") {
    throw new Error(`unexpected saving title: ${title}`);
  }

  const copy = await container.locator(".answer-saving-copy").textContent();
  if (copy !== "잠시만 기다려 주세요.") {
    throw new Error(`unexpected saving copy: ${copy}`);
  }
}

async function run() {
  const server = createServer();
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

    await page.locator(".sentence-block").nth(3).click();
    await page.locator(".confirm-selection").click();
    await page.locator(".final-confirm-selection").click();

    const centerConfirm = page.locator(".selection-confirm");
    await expectSavingMessage(centerConfirm);
    if (!(await centerConfirm.locator("button").first().isDisabled())) {
      throw new Error("center confirmation buttons should be disabled while saving");
    }

    await page.locator(".feedback-panel.is-correct").waitFor({ state: "visible" });
    await page.locator(".review-start").click();
    await page.locator(".review-option").first().click();
    await page.locator(".review-confirm-step").click();
    await page.locator(".review-final-confirm-step").click();

    const reviewConfirm = page.locator(".review-answer-confirm");
    await expectSavingMessage(reviewConfirm);
    if (!(await reviewConfirm.locator("button").first().isDisabled())) {
      throw new Error("review confirmation buttons should be disabled while saving");
    }

    await page.locator(".review-feedback").waitFor({ state: "visible" });

    console.log("answer saving state passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
