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

    const firstSentence = page.locator(".sentence-block").first();
    const box = await firstSentence.boundingBox();
    if (!box) throw new Error("first sentence is not visible");

    await firstSentence.click({ position: { x: Math.min(12, box.width / 2), y: Math.min(12, box.height / 2) } });

    const confirm = page.locator(".selection-confirm");
    await confirm.waitFor({ state: "visible" });

    const confirmBox = await confirm.boundingBox();
    if (!confirmBox) throw new Error("confirmation popover is not visible");
    if (Math.abs(confirmBox.x - box.x) > 180 || Math.abs(confirmBox.y - box.y) > 180) {
      throw new Error("confirmation popover is not near the selected sentence");
    }

    const feedbackHiddenBeforeConfirm = await page
      .locator(".feedback-panel")
      .evaluate((element) => element.hidden);
    if (!feedbackHiddenBeforeConfirm) {
      throw new Error("feedback should stay hidden before confirming the sentence");
    }

    await page.locator(".confirm-selection").click();
    await page.waitForTimeout(250);

    if (dialogMessage) {
      throw new Error(`native dialog should not open, got: ${dialogMessage}`);
    }

    const finalPrompt = await confirm.locator("p").textContent();
    if (finalPrompt !== "진짜 후회 없죠?") {
      throw new Error(`unexpected second confirmation prompt: ${finalPrompt}`);
    }

    const feedbackHiddenBeforeFinalConfirm = await page
      .locator(".feedback-panel")
      .evaluate((element) => element.hidden);
    if (!feedbackHiddenBeforeFinalConfirm) {
      throw new Error("feedback should stay hidden before the second confirmation");
    }

    await page.locator(".final-confirm-selection").click();

    const feedbackHiddenAfterConfirm = await page
      .locator(".feedback-panel")
      .evaluate((element) => element.hidden);
    if (feedbackHiddenAfterConfirm) {
      throw new Error("feedback should appear after confirmation");
    }

    console.log("confirm selection flow passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
