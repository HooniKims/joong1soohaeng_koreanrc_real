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
  const requests = [];
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/mock-db") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const payload = body ? JSON.parse(body) : {};
        requests.push(payload);
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

    if (url.pathname === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(requests));
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
    const placeholder = await page.locator("#student-summary").getAttribute("placeholder");
    const expectedPlaceholder =
      "중심 문장들을 이어보고, 문장들을 자연스럽게 연결할 수 있는 말들을 포함해서 글의 핵심 내용을 정리해보세요.";
    if (placeholder !== expectedPlaceholder) {
      throw new Error(`unexpected summary placeholder: ${placeholder}`);
    }
    if (await page.locator(".center-chip-header span").count()) {
      throw new Error("summary cards should not show paragraph labels");
    }
    if (await page.getByRole("button", { name: "처음부터 다시 학습하기" }).count()) {
      throw new Error("summary page should not show a restart button during assessment");
    }

    const chipText = await page.locator(".collected-sentences").textContent();
    if (/[1-7]문단/.test(chipText)) {
      throw new Error(`summary cards should not expose paragraph numbers: ${chipText}`);
    }

    await page
      .locator("#student-summary")
      .fill("원자력 발전 기술은 전기를 안정적으로 만들 수 있다.\n하지만 사고와 폐기물 문제도 함께 살펴야 한다.");
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
    await page.locator(".model-summary-modal").waitFor({ state: "visible" });
    const modalText = await page.locator(".model-summary-modal").textContent();
    if (
      !modalText.includes("문단 요약 모범 답안") ||
      !modalText.includes("전기를 만드는 여러 방법 중 하나가 원자력 발전 기술입니다.") ||
      !modalText.includes("또한 원자력 발전 기술은 사용한 연료를 오랫동안 안전하게 보관해야 하는 어려움을 안고 있습니다.") ||
      !modalText.includes("따라서 원자력 발전 기술을 활용할 때 우리에게 가장 필요한 것은 장점과 위험을 함께 따져 보는 신중한 태도입니다.")
    ) {
      throw new Error(`unexpected model summary modal: ${modalText}`);
    }
    await page.locator(".model-summary-close").click();
    if (await page.locator(".model-summary-modal").count()) {
      throw new Error("model summary modal should close when 확인 is clicked");
    }

    const requestsResponse = await fetch(`${baseUrl}/__requests`);
    const requests = await requestsResponse.json();
    const summaryRequest = requests.find((request) => request.action === "submitSummary");
    if (
      !summaryRequest ||
      summaryRequest.summary !==
        "원자력 발전 기술은 전기를 안정적으로 만들 수 있다. 하지만 사고와 폐기물 문제도 함께 살펴야 한다."
    ) {
      throw new Error(`summary should be saved as one connected paragraph: ${JSON.stringify(summaryRequest)}`);
    }

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
