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
const centerIndexes = [3, 0, 2, 0, 0, 0, 3];

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
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

async function answerReviewQuestion(page) {
  const count = await page.locator(".review-option").count();
  for (let index = 0; index < count; index += 1) {
    await page.locator(".review-option").nth(index).click();
    await page.locator(".review-confirm-step").click();
    await page.locator(".review-final-confirm-step").click();
    if (await page.locator(".primary-action").isVisible()) {
      return;
    }
  }
  throw new Error("could not solve review question");
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "" };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#student-number").fill("1101");
    await page.locator("#student-name").fill("홍길동");
    await page.locator(".login-submit").click();

    for (const centerIndex of centerIndexes) {
      await page.locator(".sentence-block").nth(centerIndex).click();
      await page.locator(".confirm-selection").click();
      await page.locator(".final-confirm-selection").click();
      await page.locator(".review-start").click();
      await answerReviewQuestion(page);
      await page.locator(".primary-action").click();
    }

    const summaryInput = page.locator("#student-summary");
    await summaryInput.waitFor({ state: "visible" });
    if (await page.locator(".summary-copy").count()) {
      throw new Error("automatic summary text should not be rendered");
    }
    if ((await summaryInput.inputValue()) !== "") {
      throw new Error("summary input should start blank");
    }
    if (!(await page.locator(".summary-submit").isVisible())) {
      throw new Error("summary submit button should be visible");
    }

    await summaryInput.fill("유전 조작은 장점도 있지만 생태계와 생명 윤리 문제 때문에 신중하게 판단해야 한다.");
    await page.locator(".summary-submit").click();
    await page.locator(".summary-complete").waitFor({ state: "visible" });
    const completeText = await page.locator(".summary-complete").textContent();
    if (completeText !== "수고했습니다.") {
      throw new Error(`unexpected summary completion message: ${completeText}`);
    }

    console.log("manual summary flow passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
