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
        const delay = payload.action === "submitSummary" ? 1000 : 0;
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          if (payload.action === "getRecord") {
            res.end(JSON.stringify({
              ok: true,
              record: {
                "학번": "1101",
                "이름": "홍길동",
                "1.1": 1,
                "1.2": 1,
                "2.1": 1,
                "2.2": 1,
                "3.1": 1,
                "3.2": 1,
                "4.1": 1,
                "4.2": 1,
                "5.1": 1,
                "5.2": 1,
                "6.1": 1,
                "6.2": 1,
                "7.1": 1,
                "7.2": 1,
              },
            }));
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

    await page.locator("#student-summary").waitFor({ state: "visible" });
    if (await page.locator(".center-chip-header span").count()) {
      throw new Error("summary cards should not show paragraph labels");
    }

    const chipText = await page.locator(".collected-sentences").textContent();
    if (/[1-7]문단/.test(chipText)) {
      throw new Error(`summary cards should not expose paragraph numbers: ${chipText}`);
    }

    await page.locator("#student-summary").fill("중심 문장을 바탕으로 전체 글의 핵심을 정리했다.");
    await page.locator(".summary-submit").click();

    await page.locator(".summary-saving").waitFor({ state: "visible" });
    const savingText = await page.locator(".summary-saving").textContent();
    if (!savingText.includes("요약을 저장 중입니다.") || !savingText.includes("잠시만 기다려 주세요.")) {
      throw new Error(`unexpected summary saving text: ${savingText}`);
    }

    if (!(await page.locator(".summary-submit").isDisabled())) {
      throw new Error("summary submit button should be disabled while saving");
    }

    await page.locator(".summary-complete").waitFor({ state: "visible" });
    const completeText = await page.locator(".summary-complete").textContent();
    if (completeText !== "수고했습니다.") {
      throw new Error(`unexpected summary completion text: ${completeText}`);
    }

    const completeBox = await page.locator(".summary-complete").boundingBox();
    const viewport = page.viewportSize();
    if (!completeBox || !viewport) {
      throw new Error("summary completion message should be visible");
    }
    const centerX = completeBox.x + completeBox.width / 2;
    if (Math.abs(centerX - viewport.width / 2) > viewport.width * 0.18) {
      throw new Error("summary completion message should be centered");
    }

    console.log("summary submit state passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
