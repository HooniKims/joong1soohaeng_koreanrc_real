const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadLessonData() {
  const source = fs.readFileSync(path.join(root, "src", "data.js"), "utf8");
  const transformed = source
    .replace("export const lesson =", "const lesson =")
    .replace("export const totalSentenceCount =", "const totalSentenceCount =")
    .concat("\nlessonData = { lesson, totalSentenceCount };\n");
  const sandbox = { lessonData: null };
  vm.createContext(sandbox);
  vm.runInContext(transformed, sandbox);
  return sandbox.lessonData;
}

function run() {
  const { lesson, totalSentenceCount } = loadLessonData();

  if (lesson.title !== "원자력 발전 기술의 명암") {
    throw new Error(`wrong lesson title: ${lesson.title}`);
  }

  if (lesson.paragraphs.length !== 7) {
    throw new Error(`expected 7 paragraphs, got ${lesson.paragraphs.length}`);
  }

  const centerPositions = lesson.paragraphs.map((paragraph) => paragraph.centerIndex);
  const expectedPositions = [3, 0, 2, 0, 2, 0, 3];
  if (centerPositions.join(",") !== expectedPositions.join(",")) {
    throw new Error(`wrong center positions: ${centerPositions.join(",")}`);
  }

  const originalPracticePositions = [3, 0, 2, 0, 0, 0, 3];
  const changedParagraphs = centerPositions
    .map((position, index) => (position === originalPracticePositions[index] ? null : index + 1))
    .filter(Boolean);
  if (changedParagraphs.join(",") !== "5") {
    throw new Error(`only paragraph 5 should differ from the practice pattern: ${changedParagraphs.join(",")}`);
  }

  lesson.paragraphs.forEach((paragraph) => {
    const centerSentence = paragraph.sentences[paragraph.centerIndex];
    if (centerSentence.role !== "중심 문장") {
      throw new Error(`${paragraph.label} center sentence role is wrong: ${centerSentence.role}`);
    }
  });

  const allText = JSON.stringify(lesson);
  if (allText.includes("인공위성") || allText.includes("우주 쓰레기") || allText.includes("로켓")) {
    throw new Error("old satellite material remains in lesson data");
  }

  const countedSentences = lesson.paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.sentences.length,
    0,
  );
  if (totalSentenceCount !== countedSentences) {
    throw new Error(`wrong totalSentenceCount: ${totalSentenceCount}`);
  }

  console.log("lesson data passed");
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
