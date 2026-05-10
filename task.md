# 2026 1학기 비판적 독해 수행평가 프로젝트 정리

## 프로젝트 개요

이 프로젝트는 중학교 1학년 국어 비판적 독해 수행평가용 웹 학습 앱이다.

학생은 학번과 이름을 입력해 입장하고, 1문단부터 7문단까지 각 문단의 중심 문장을 고른 뒤 확인 문제를 푼다. 마지막에는 수집된 중심 문장을 바탕으로 직접 요약문을 작성한다.

앱은 정적 프런트엔드로 구성되어 있으며, Google Sheets를 DB처럼 사용한다. Google Sheets 쓰기 작업은 브라우저에서 직접 수행하지 않고 Google Apps Script 웹앱을 통해 처리한다.

## 실제 수행평가 본문 설계

현재 실제 수행평가 소재는 `원자력 발전 기술`이다.

글 제목:

```txt
원자력 발전 기술의 명암
```

글의 큰 흐름:

- 1문단: 전기를 만드는 여러 방법 중 하나로 원자력 발전 기술을 소개한다.
- 2문단: 원자력 발전이 많은 전기를 비교적 안정적으로 공급할 수 있다는 장점을 설명한다.
- 3문단: 장점만 볼 것이 아니라 신중하게 바라보아야 할 이유를 묻는다.
- 4문단: 큰 사고가 났을 때 피해가 넓고 오래 이어질 수 있음을 설명한다.
- 5문단: 사용한 연료를 오랫동안 안전하게 보관해야 하는 어려움을 설명한다.
- 6문단: 발전소 건설, 관리, 사고 대응에 비용과 책임이 따른다는 점을 설명한다.
- 7문단: 장점과 위험을 함께 따져 보는 신중한 태도가 필요하다고 결론을 맺는다.

중심문장 위치 설계:

```txt
1문단: 4번째 문장
2문단: 1번째 문장
3문단: 3번째 문장
4문단: 1번째 문장
5문단: 3번째 문장
6문단: 1번째 문장
7문단: 4번째 문장
```

학생에게 공지한 조건에 맞춰 7개 문단 중 6개 문단은 기존 훈련용 글의 중심문장 위치와 같게 유지했다. 5문단만 중심문장을 첫 문장이 아니라 세 번째 문장에 두었다. 이 문단은 단순히 첫 문장만 고르는 학생과 문장 관계를 실제로 읽는 학생을 구분하기 위한 장치다.

5문단은 중학교 1학년 수준에서 풀 수 있도록 다음 흐름으로 구성했다.

- 1문장: 사용한 연료가 남는다는 소재 소개
- 2문장: 그 연료를 아무 곳에나 버릴 수 없는 이유
- 3문장: 사용한 연료를 오랫동안 안전하게 보관해야 한다는 중심문장
- 4문장: 보관 장소와 장기 안전 문제를 더 생각해야 한다는 보충 설명

## 주요 파일

- `index.html`: 로그인 화면과 앱 루트 마크업
- `styles.css`: 전체 화면 스타일
- `src/app.js`: 앱 진입, 화면 전환, DB 저장 흐름 연결
- `src/login.js`: 학번/이름 입력 검증 및 로그인 오류 표시
- `src/state.js`: 학습 진행 상태, 정답 처리, 시트 기록 복원
- `src/render.js`: 문단, 피드백, 확인 문제, 요약 화면 렌더링
- `src/data.js`: 문단/문장/정답 데이터
- `src/progress.js`: 점수 키, 학급 탭 매핑, 이어하기 위치 계산
- `src/sheets.js`: Apps Script 웹앱 통신
- `src/config.js`: Apps Script 웹앱 URL 설정
- `google-apps-script/Code.gs`: Google Sheet에 붙여 넣는 Apps Script 서버 코드
- `google-apps-script/README.md`: Apps Script 배포 및 연결 방법
- `tests/*.test.js`: Playwright 기반 기능 테스트

## Google Sheet DB 구조

Google Sheet URL:

```txt
https://docs.google.com/spreadsheets/d/1lOnr8FTIwGwREeNeLWYe8nk9Dsn6RJ73qrYU4URu74Q/edit?usp=sharing
```

학번 앞 두 자리로 저장할 탭을 결정한다.

- `11` -> `1-1`
- `12` -> `1-2`
- `13` -> `1-3`
- `14` -> `1-4`
- `15` -> `1-5`

각 탭은 1행을 헤더로 사용한다.

주요 헤더:

- `학번`
- `이름`
- `1.1` ~ `7.2`
- `요약하기 점수`
- `최종 점수`
- `등급`

현재 실제 시트에서는 요약 열이 `요약하기 점수`로 읽힌다. 코드에서는 `요약하기`, `요약하기 점수`, `요약` 순서로 저장 후보를 처리한다.

## 점수 기록 규칙

각 문단은 2개 점수 칸을 가진다.

- `n.1`: n번째 문단의 중심 문장 선택 점수
- `n.2`: n번째 문단의 확인 문제 점수

예:

- 1문단 중심 문장 정답 -> `1.1 = 1`
- 1문단 중심 문장 오답 -> `1.1 = 0`
- 1문단 확인 문제 정답 -> `1.2 = 1`
- 1문단 확인 문제 오답 -> `1.2 = 0`

7문단까지 반복하여 `1.1`부터 `7.2`까지 총 14점 만점이다.

## 재시도 방지 규칙

재시도 방지는 브라우저 상태가 아니라 Google Sheet 값을 기준으로 한다.

- 학생이 답을 확정하는 즉시 해당 점수 칸을 Apps Script로 저장한다.
- 이미 값이 들어간 점수 칸은 Apps Script가 절대 덮어쓰지 않는다.
- 새로고침, 다른 브라우저, 다른 기기로 다시 접속해도 시트 값이 기준이 된다.
- 마지막 요약 제출 한 번에만 저장하는 방식은 사용하지 않는다.

Apps Script의 핵심 방어:

```js
if (cell.getValue() !== "") {
  return { ok: false, reason: "already_submitted" };
}
```

## 새로고침 후 이어하기 규칙

학생이 새로고침하면 다시 로그인 화면을 본다.

로그인 후 Apps Script가 기존 기록을 조회하고 다음 위치로 복원한다.

- 기록 없음 -> 1문단 중심 문장 선택
- `n.1`만 있음 -> n문단 확인 문제
- `n.1`, `n.2` 둘 다 있음 -> 다음 문단
- `1.1` ~ `7.2` 모두 있음 -> 요약 화면
- 요약까지 있음 -> 요약 제출 완료 상태

## 요약 작성 및 모범 답안 안내

마지막 요약 화면의 `나의 요약` 입력칸은 다음 안내 문구를 보여 준다.

```txt
중심 문장들을 이어보고, 문장들을 자연스럽게 연결할 수 있는 말들을 포함해서 글의 핵심 내용을 정리해보세요.
```

학생이 중심 문장을 줄마다 붙여 넣는 경우를 줄이기 위해, 요약 제출 시 입력값의 줄바꿈은 한 칸 공백으로 정리해 저장한다. 예를 들어 두 줄로 붙여 넣은 문장도 시트에는 한 문단처럼 이어진 문장으로 저장된다.

요약 제출이 끝나면 화면 가운데에 `문단 요약 모범 답안` 창을 띄운다. 이 창은 학생이 제출을 마친 뒤 자신의 요약과 비교해 볼 수 있는 안내용이며, 점수 저장 흐름에는 영향을 주지 않는다.

## 테스트용 요약 화면 바로 보기

실제 학생 흐름은 로그인과 문단별 풀이를 거쳐야 한다. 다만 교사용 테스트 단계에서는 마지막 요약 화면을 바로 확인할 수 있도록 다음 URL 파라미터를 지원한다.

```txt
?preview=summary
```

예:

```txt
http://localhost:4173/?preview=summary
```

이 경로는 시트에 점수를 저장하지 않고, 현재 `src/data.js`의 7개 중심문장을 모아 요약 화면만 바로 보여 준다. 기존 호환용 `?summaryPreview=1`도 계속 동작한다.

## 학번/이름 중복 방지 규칙

같은 학번이 이미 시트에 있을 때:

- 같은 학번 + 같은 이름 -> 기존 기록 이어하기 허용
- 같은 학번 + 다른 이름 -> 로그인 차단
- 다른 학번 + 같은 이름 -> 허용

Apps Script는 같은 학번의 기존 이름과 제출 이름이 다르면 다음 오류를 반환한다.

```txt
student_number_name_mismatch
```

프런트는 이 오류를 다음 메시지로 보여준다.

```txt
이미 다른 이름으로 등록된 학번입니다. 학번과 이름을 다시 확인하세요.
```

오류 메시지는 로그인 화면 안에 잠깐 표시된 뒤 사라진다.

## Apps Script 연결

현재 `src/config.js`에 설정된 웹앱 URL:

```txt
https://script.google.com/macros/s/AKfycbzSQbjleRwiotTX_Ll_Ql-lgXCA3MzYTYK6w7bMf41Hh89mRqjM4r0J7M8ALARRLint/exec
```

Apps Script 배포 설정:

- 실행 권한: `나`
- 액세스 권한: `모든 사용자`
- 코드 수정 후 반드시 `배포 업데이트` 필요

브라우저와 Apps Script 사이의 통신은 JSONP 방식을 사용한다. Google Apps Script 웹앱 응답은 리다이렉트와 CORS 제약이 있어, 실제 `script.google.com` URL에서는 `script` 태그 기반 JSONP 요청을 사용한다.

로컬 테스트 mock 서버에서는 일반 `fetch`를 사용한다.

## 실제 배포본 테스트 결과

실제 Apps Script 새 배포본으로 테스트했다.

테스트 학번:

```txt
1187
```

테스트 이름:

```txt
테스트
```

확인 결과:

- `1.1`부터 `7.2`까지 모두 저장됨
- 모든 점수 값은 `1`
- `최종 점수`는 `14`
- 요약문은 `요약하기 점수` 열에 저장됨
- 같은 학번 `1187`에 다른 이름 `다른명`으로 접근하면 차단됨
- 브라우저 화면에 중복 오류 메시지가 표시되고 본 화면 진입이 차단됨

실제 조회 핵심 결과:

```json
{
  "학번": 1187,
  "이름": "테스트",
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
  "요약하기 점수": "중심 문장을 바탕으로 원자력 발전 기술은 유용하지만 장점과 위험을 함께 따져 보아야 한다.",
  "최종 점수": 14
}
```

중복 이름 테스트 결과:

```json
{
  "ok": false,
  "reason": "student_number_name_mismatch"
}
```

## 테스트 설치 및 실행

의존성 설치:

```powershell
npm install
```

Playwright Chromium 설치:

```powershell
npx playwright install chromium
```

전체 테스트 실행:

```powershell
Get-ChildItem tests -Filter *.test.js | ForEach-Object { Write-Host "Running $($_.Name)"; node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

## 테스트 통과 조건

전체 테스트는 다음 조건을 모두 만족해야 통과로 본다.

- 로그인 입력 검증 오류가 화면 안에 표시되고 잠깐 뒤 사라진다.
- 학번/이름 입력 후 앱 본 화면에 진입할 수 있다.
- 중심 문장 선택은 2단계 확인 후 확정된다.
- 중심 문장 첫 선택 결과가 즉시 `n.1`로 저장된다.
- 중심 문장 오답이어도 다시 선택하지 못하고 확인 문제로 넘어간다.
- 확인 문제 선택은 2단계 확인 후 확정된다.
- 확인 문제 첫 선택 결과가 즉시 `n.2`로 저장된다.
- 확인 문제 오답이어도 다음 문단으로 넘어갈 수 있다.
- 기존 시트 기록이 있으면 새로고침 후 로그인 시 다음 미완료 위치로 복원된다.
- 이미 기록된 점수 칸은 덮어쓰지 않는다.
- Apps Script 서버 코드도 이미 기록된 점수 칸을 `already_submitted`로 거부하고 기존 값을 유지한다.
- `11`, `12`, `13`, `14`, `15` 학번 prefix가 각각 `1-1` ~ `1-5` 탭으로 매핑된다.
- `1.1`부터 `7.2`까지 모두 채워지면 요약 화면으로 이동한다.
- 요약 입력 후 제출 완료 메시지가 표시된다.
- Apps Script 서버 코드가 요약문을 `요약하기`, `요약하기 점수`, `요약` 중 실제 존재하는 첫 헤더에 저장한다.
- 같은 학번 + 다른 이름은 로그인 차단된다.
- 중복 오류 메시지는 로그인 화면 안에 표시되고 본 화면으로 진입하지 않는다.

## 현재 전체 로컬 테스트 결과

마지막 전체 테스트 실행 결과:

```txt
Running answer-saving-state.test.js
answer saving state passed
Running apps-script-code.test.js
apps script code passed
Running apps-script-flow.test.js
apps script flow passed
Running confirm-selection-flow.test.js
confirm selection flow passed
Running lesson-data.test.js
lesson data passed
Running login-inline-error.test.js
login inline error passed
Running login-loading-state.test.js
login loading state passed
Running manual-summary-flow.test.js
manual summary flow passed
Running progress-helpers.test.js
progress helpers passed
Running review-double-confirm-flow.test.js
review double confirm flow passed
Running summary-preview-route.test.js
summary preview route passed
Running summary-submit-state.test.js
summary submit state passed
Running wrong-center-goes-to-review.test.js
wrong center goes to review passed
Running wrong-review-can-move-next.test.js
wrong review can move next passed
```

총 14개 테스트가 모두 통과했다.

## 운영 시 주의사항

- Apps Script 코드를 수정하면 반드시 웹앱 배포를 업데이트해야 한다.
- 실제 시트 테스트에는 테스트용 학번을 사용한다.
- 이미 기록된 점수 칸은 덮어쓰지 않으므로, 같은 테스트 학번으로 다시 14개 점수를 재테스트하려면 시트에서 해당 행을 삭제하거나 새 테스트 학번을 사용한다.
- 학생 이름은 한글 1~5글자만 허용된다.
- 학번은 숫자 4자리만 허용된다.
- 수행평가 운영에서는 마지막 요약 제출 뒤 다시 시작 버튼을 제공하지 않는다.
