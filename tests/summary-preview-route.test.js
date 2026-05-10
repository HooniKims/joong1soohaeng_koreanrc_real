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

  try {
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "" };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/?preview=summary`);

    await page.locator("#student-summary").waitFor({ state: "visible" });
    if (!(await page.locator("#login-page").evaluate((element) => element.hidden))) {
      throw new Error("login page should be hidden in summary preview mode");
    }
    if (await page.locator(".center-chip").count() < 7) {
      throw new Error("summary preview should include all collected center sentences");
    }
    if (await page.locator(".center-chip-header span").count()) {
      throw new Error("summary paragraph cards should not show paragraph labels");
    }
    if (await page.getByRole("button", { name: "처음부터 다시 학습하기" }).count()) {
      throw new Error("summary preview should not show a restart button during assessment");
    }
    const chipText = await page.locator(".collected-sentences").textContent();
    if (/[1-7]문단/.test(chipText)) {
      throw new Error(`summary paragraph cards should not expose paragraph numbers: ${chipText}`);
    }

    const firstSentence = await page.locator(".center-chip p").first().textContent();
    const firstSentenceBox = await page.locator(".center-chip p").first().boundingBox();
    const firstCopyButtonBox = await page.locator(".copy-center-sentence").first().boundingBox();
    if (!firstSentenceBox || !firstCopyButtonBox) {
      throw new Error("summary sentence and copy button should be visible");
    }
    const verticalOverlap =
      firstSentenceBox.y < firstCopyButtonBox.y + firstCopyButtonBox.height &&
      firstCopyButtonBox.y < firstSentenceBox.y + firstSentenceBox.height;
    if (!verticalOverlap || firstCopyButtonBox.x <= firstSentenceBox.x) {
      throw new Error("summary sentence and copy button should be placed on the same row");
    }

    const copyButtons = page.locator(".copy-center-sentence");
    if ((await copyButtons.count()) < 7) {
      throw new Error("each collected center sentence should have a copy button");
    }

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: `http://127.0.0.1:${server.address().port}`,
    });
    await copyButtons.first().click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    if (clipboardText !== firstSentence) {
      throw new Error("copy button should copy the matching center sentence");
    }

    console.log("summary preview route passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
