// 중심 문장을 모아 전체 글 요약을 만드는 모듈
const connectors = ["먼저", "또한", "하지만", "그 까닭으로", "또한", "나아가", "따라서"];

export function buildSummaryPieces(collectedCenters) {
  return collectedCenters.map((item, index) => ({
    connector: connectors[index] ?? "그리고",
    label: item.label,
    text: cleanSummarySentence(item.text),
  }));
}

export function createSummaryText(collectedCenters) {
  return buildSummaryPieces(collectedCenters)
    .map((piece) => `${piece.connector}, ${piece.text}`)
    .join(" ");
}

function cleanSummarySentence(text) {
  return text.replace(/^이러한\s+/, "");
}
