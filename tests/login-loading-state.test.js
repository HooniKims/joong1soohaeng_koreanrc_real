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
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, reason: "student_number_name_mismatch" }));
      }, 1000);
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
    await page.locator("#student-number").fill("1101");
    await page.locator("#student-name").fill("홍길동");
    await page.locator(".login-submit").click();

    const submitButton = page.locator(".login-submit");
    const loadingMessage = page.locator("#login-loading");

    await loadingMessage.waitFor({ state: "visible", timeout: 1500 });
    const loadingText = await loadingMessage.textContent();
    if (loadingText !== "잠시만 기다려 주세요.") {
      throw new Error(`unexpected loading message: ${loadingText}`);
    }

    const buttonText = await submitButton.textContent();
    if (buttonText !== "학번, 이름 확인 중입니다.") {
      throw new Error(`unexpected loading button text: ${buttonText}`);
    }

    if (!(await submitButton.isDisabled())) {
      throw new Error("submit button should be disabled while login is loading");
    }

    if (!(await page.locator("#student-number").isDisabled())) {
      throw new Error("student number input should be disabled while login is loading");
    }

    await page.waitForFunction(() =>
      document.querySelector("#login-error")?.textContent?.includes("이미 다른 이름으로 등록된 학번입니다"),
    );
    const restoredButtonText = await submitButton.textContent();
    if (restoredButtonText !== "확인") {
      throw new Error(`submit button should be restored after failure: ${restoredButtonText}`);
    }

    if (await submitButton.isDisabled()) {
      throw new Error("submit button should be enabled after failure");
    }

    const loadingVisible = await loadingMessage.evaluate((element) => element.dataset.visible === "true");
    if (loadingVisible) {
      throw new Error("loading message should be hidden after failure");
    }

    console.log("login loading state passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
