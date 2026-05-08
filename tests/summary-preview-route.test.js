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
    await page.goto(`http://127.0.0.1:${server.address().port}/?summaryPreview=1`);

    await page.locator("#student-summary").waitFor({ state: "visible" });
    if (!(await page.locator("#login-page").evaluate((element) => element.hidden))) {
      throw new Error("login page should be hidden in summary preview mode");
    }
    if (await page.locator(".center-chip").count() < 7) {
      throw new Error("summary preview should include all collected center sentences");
    }
    const labels = await page.locator(".center-chip-header span").allTextContents();
    if (labels.join(",") === "1문단,2문단,3문단,4문단,5문단,6문단,7문단") {
      throw new Error("summary paragraph cards should be shuffled");
    }

    const firstSentence = await page.locator(".center-chip p").first().textContent();
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
