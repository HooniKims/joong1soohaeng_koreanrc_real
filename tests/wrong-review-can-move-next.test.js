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
  await page.addInitScript(() => {
    window.APP_CONFIG = { APPS_SCRIPT_URL: "" };
    Math.random = () => 0.99;
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

    const options = page.locator(".review-option");
    const count = await options.count();
    let choseWrong = false;
    for (let index = 0; index < count; index += 1) {
      await options.nth(index).click();
      await page.locator(".review-confirm-step").click();
      await page.locator(".review-final-confirm-step").click();
      const isCorrect = await page.locator(".review-feedback").getAttribute("data-correct");
      if (isCorrect === "false") {
        choseWrong = true;
        break;
      }
      throw new Error("first option was correct; test needs a wrong answer fixture");
    }

    if (!choseWrong) {
      throw new Error("could not choose a wrong review answer");
    }

    if (!(await page.locator(".primary-action").isVisible())) {
      throw new Error("next button should appear after a wrong review answer");
    }

    const disabledCount = await page.locator(".review-option:disabled").count();
    if (disabledCount !== count) {
      throw new Error("review options should be locked after the first submitted answer");
    }

    console.log("wrong review can move next passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
