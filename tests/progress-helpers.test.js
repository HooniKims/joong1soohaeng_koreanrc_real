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
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${baseUrl}/`);

    const result = await page.evaluate(async () => {
      const progress = await import("/src/progress.js");
      return {
        tabs: [
          progress.getClassSheetName("1101"),
          progress.getClassSheetName("1201"),
          progress.getClassSheetName("1301"),
          progress.getClassSheetName("1401"),
          progress.getClassSheetName("1509"),
        ],
        keys: [
          progress.getScoreKey(0, "center"),
          progress.getScoreKey(0, "review"),
          progress.getScoreKey(6, "center"),
          progress.getScoreKey(6, "review"),
        ],
        nextAfterPartial: progress.getNextResumePoint(
          { "1.1": 1, "1.2": 0, "2.1": 1 },
          7,
        ),
        nextAfterDone: progress.getNextResumePoint(
          {
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
          7,
        ),
        total: progress.calculateObjectiveScore({ "1.1": 1, "1.2": 0, "2.1": 1 }),
      };
    });

    if (result.tabs.join(",") !== "1-1,1-2,1-3,1-4,1-5") {
      throw new Error(`wrong class tab mapping: ${result.tabs.join(",")}`);
    }

    if (result.keys.join(",") !== "1.1,1.2,7.1,7.2") {
      throw new Error(`wrong score keys: ${result.keys.join(",")}`);
    }

    if (result.nextAfterPartial.paragraphIndex !== 1 || result.nextAfterPartial.step !== "review") {
      throw new Error(`wrong partial resume point: ${JSON.stringify(result.nextAfterPartial)}`);
    }

    if (result.nextAfterDone.step !== "summary") {
      throw new Error(`completed scores should resume at summary: ${JSON.stringify(result.nextAfterDone)}`);
    }

    if (result.total !== 2) {
      throw new Error(`wrong total score: ${result.total}`);
    }

    console.log("progress helpers passed");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
