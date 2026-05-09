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
    await page.addInitScript(() => {
      window.APP_CONFIG = { APPS_SCRIPT_URL: "" };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator(".login-submit").click();
    await page.waitForTimeout(250);

    if (dialogMessage) {
      throw new Error(`native dialog should not open, got: ${dialogMessage}`);
    }

    const error = page.locator("#login-error");
    await error.waitFor({ state: "visible" });
    const message = await error.textContent();
    if (message !== "학번과 이름을 입력하세요.") {
      throw new Error(`unexpected inline error: ${message}`);
    }

    const formBox = await page.locator("#student-login-form").boundingBox();
    const errorBox = await error.boundingBox();
    if (!formBox || !errorBox) throw new Error("form or error is not visible");
    if (errorBox.y < formBox.y || errorBox.y > formBox.y + formBox.height + 20) {
      throw new Error("inline error is not near the student input form");
    }

    await page.waitForTimeout(2800);
    const hiddenMessage = await error.textContent();
    const isVisible = await error.evaluate((element) => element.dataset.visible === "true");
    if (hiddenMessage || isVisible) {
      throw new Error("inline error should disappear after a short delay");
    }

    console.log("login inline error passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
