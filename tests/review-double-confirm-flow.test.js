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

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let dialogMessage = "";
  page.on("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#student-number").fill("1101");
    await page.locator("#student-name").fill("홍길동");
    await page.locator(".login-submit").click();

    await page.locator(".sentence-block").nth(3).click();
    await page.locator(".confirm-selection").click();
    await page.locator(".final-confirm-selection").click();
    await page.locator(".review-start").click();

    const firstReviewOption = page.locator(".review-option").first();
    await firstReviewOption.click();

    if (dialogMessage) {
      throw new Error(`native dialog should not open, got: ${dialogMessage}`);
    }

    const confirmBar = page.locator(".review-answer-confirm");
    await confirmBar.waitFor({ state: "visible" });

    const firstPrompt = await confirmBar.locator("p").textContent();
    if (firstPrompt !== "1문장으로 제출할까요?") {
      throw new Error(`unexpected first review confirmation prompt: ${firstPrompt}`);
    }

    const reviewFeedbackBeforeConfirm = await page.locator(".review-feedback").count();
    if (reviewFeedbackBeforeConfirm) {
      throw new Error("review feedback should stay hidden before confirmation");
    }

    await page.locator(".review-confirm-step").click();
    const secondPrompt = await confirmBar.locator("p").textContent();
    if (secondPrompt !== "마지막 확인입니다. 이 답으로 확정할까요?") {
      throw new Error(`unexpected second review confirmation prompt: ${secondPrompt}`);
    }

    await page.locator(".review-final-confirm-step").click();
    await page.locator(".review-feedback").waitFor({ state: "visible" });

    console.log("review double confirm flow passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
