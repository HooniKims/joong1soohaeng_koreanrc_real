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
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#student-number").fill("1101");
    await page.locator("#student-name").fill("홍길동");
    await page.locator(".login-submit").click();

    await page.locator(".sentence-block").first().click();
    await page.locator(".confirm-selection").click();
    await page.locator(".final-confirm-selection").click();

    await page.locator(".feedback-panel.is-wrong").waitFor({ state: "visible" });
    await page.locator(".relation-list").waitFor({ state: "visible" });
    await page.locator(".review-start").waitFor({ state: "visible" });
    if (await page.locator(".review-panel").count()) {
      throw new Error("review question should stay hidden while sentence explanations are shown");
    }

    const firstSentenceTabIndex = await page.locator(".sentence-block").first().getAttribute("tabindex");
    if (firstSentenceTabIndex !== "-1") {
      throw new Error("wrong center selection should be locked, not selectable again");
    }

    const selectedWrong = await page.locator(".sentence-block").first().getAttribute("data-incorrect");
    if (selectedWrong !== "true") {
      throw new Error("selected wrong sentence should be marked incorrect");
    }

    await page.locator(".review-start").click();
    await page.locator(".review-panel").waitFor({ state: "visible" });
    if (await page.locator(".relation-list").count()) {
      throw new Error("sentence explanations should be hidden while solving the review question");
    }

    console.log("wrong center goes to review passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
