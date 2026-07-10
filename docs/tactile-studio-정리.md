# Tactile Studio — 정리 요약 · 기능 명세서

> 기준: `index.html` 단일 파일(커스텀 dc-runtime + React UMD). 배포는 GitHub Pages(`byeol-coder/tactile-studio` `main`).
> 이 문서는 이번 정리 작업의 변경 요약, 남은 Beta 기능, 그리고 향후 Tactile Worlds 이관을 위한 기능 명세를 담습니다.

---

## 1. 변경 요약

### 1) 커서 도구 제거 + 접근성 모드 분리
- 기본 툴바에서 **커서(cursor) 도구를 제거**했습니다. 기본 툴바는 포인터 우선(펜·지우개·도형·선두께·선택·묵자)입니다.
- **화살표/스페이스 키보드 편집은 항상 동작**합니다(핵심 접근성 기능 유지). 어떤 도구가 활성화돼 있어도 화살표로 셀 커서를 이동하고 스페이스로 점을 토글할 수 있습니다.
- **안내(설명)만 분리**했습니다. 기본 상태에서는 캔버스 `aria-label`·"캔버스 준비됨" 안내·키보드 도움말에서 커서/화살표/스페이스 문구를 노출하지 않습니다.
- 오른쪽 속성(Properties) pane에 **접근성 모드(Accessibility Mode) 토글**(기본 OFF)을 추가했습니다. 켜면:
  - 커서 도구가 툴바 맨 앞으로 복귀(단축키 `V`)
  - 캔버스 `aria-label`/준비 안내가 키보드 편집 문구 포함 버전으로 전환
  - 도움말에 `V`/화살표/Space 행 노출
- 접근성 기능 코드는 **삭제하지 않고 feature flag(`a11yMode` state)로 분리**했습니다.

관련 코드: `state.a11yMode`, `pickTool()` 가드, `onKey` tools 맵의 `v` 게이팅, `_readyMsg()`, `canvasAria`/`helpRows` renderVals, `hRowsA11y` i18n, 속성 pane 토글(`toggleA11y`/`a11yTrackStyle`/`a11yKnobStyle`).

### 2) 툴바 / 오른쪽 pane 역할 정리
- 기본 작업은 툴바에서 바로 동작(펜·지우개·도형·선두께·선택·묵자·빠른작업·실행취소/다시실행).
- **선두께**는 도형처럼 툴바 드롭다운으로 유지. 오른쪽 pane에 **중복 노출 없음**(속성 pane의 "정리"는 얇게/굵게/노이즈 제거 = 모폴로지 연산으로, 선두께 설정과 별개). → 가장 깔끔한 단일 소스 유지.
- **DotPad 연결/전송/연결해제는 이미 오른쪽 pane(Inspector · DotPad)로 일원화**되어 있음(connect→send→disconnect 단일 흐름). 상단 바에는 device 상태가 없음(중복 제거 상태 유지).
- 세부 설정·특수 기능(나레이션/점자, 라이브 미리보기, 하드웨어 진단, 이미지 변환·벡터화)은 pane 또는 전용 다이얼로그에 위치.

### 3) 상단 정보 정리
- 상단 DotPad 연결 상태: **제거 상태 유지**(DotPad 액션은 오른쪽 pane으로 일원화).
- **"저장됨" 상시 표시 제거**. 이제 저장 상태는 의미 있는 상태에서만 노출:
  - 일반 상태: **표시 없음**
  - 저장 직후: "저장됨"을 잠깐(2.5초) 표시 후 자동 사라짐
  - 저장 실패(자산 내보내기 예외 등): "저장 실패"를 다음 저장 시도까지 유지
  - (`saveStatus` state: `'' | 'saving' | 'saved' | 'error'`, `_flashSaveStatus()`, `doSaveCommit()` 연동)

### 4) 촉각 이미지 벡터화 기능 명확화
- 벡터화는 **원본 이미지가 아니라, 변환으로 생성된 촉각 점 그리드(`cells`)를 입력**으로 사용함을 명시(도움말 문구 개정).
- 뷰 탭 라벨을 **"벡터화 보기 Beta"** / "Vectorized view Beta"로 명확화. 토글 라벨도 "(Beta)".
- 상세 데이터 구조/타입/좌표/저장·내보내기는 아래 [3. 기능 명세](#3-기능-명세--촉각-벡터화-beta) 참조.

### 5) 클린 코드 정리 (주석 은닉이 아니라 실제 삭제)
- **미사용 i18n 키 71개 제거**(ko/en 총 142개 엔트리). 구 "World Hub" 셸·구 device 패널·구 import 플로우 잔재(예: `entryTitle/hubTitle/heroAria/devConnect/connToggleHint/dpConnBle/impFlow1…/createTitle` 등). 전부 `t.KEY` 참조 0건·타 파일 참조 0건 확인 후 제거.
- **미사용 state 필드 3개 제거**: `converting`, `convertDone`, `connType`(쓰기만 있고 읽기 0건).
- 제거 후 `<script data-dc-script>` 블록 **구문 검사 통과**, 브라우저 콘솔 에러/경고 0건, 이미지 변환 다이얼로그·속성 pane 정상 렌더 확인.

> 검증: 로컬 프리뷰(`node .claude/serve.mjs`, :8777) 리로드 → 콘솔 에러 없음 / 커서 도구 부재 / 접근성 모드 토글 시 커서 복귀 / 저장 표시 기본 숨김 확인.

---

## 2. 남은 Beta 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| **벡터화 보기(Vectorize lines)** | Beta | 촉각 점 그리드 → 선/도형 오브젝트 추출. 미리보기 + JSON 자산에 메타로 내보내기까지. 메인 캔버스 편집·재열기 복원은 미구현(아래 명세 참조). |
| 명령어로 만들기 (Command → tactile) | v1 (정식, AI 아님) | 결정론적 로컬 규칙 기반 생성. "실제 AI 아님" 라벨 유지. Beta 아님. |
| 점자 텍스트 채널 (liblouis) | 정식 | ko/UEB(1·2급)만 번역 가능(엔진 한계). Beta 아님. |

> "명령어로 만들기"와 "점자 채널"은 정식 기능이며 Beta 표기 대상이 아닙니다. 현재 UI에서 **Beta 표기가 필요한 유일한 기능은 벡터화**입니다.

---

## 3. 기능 명세 — 촉각 벡터화 (Beta)

### 3.1 정의 / 입력 기준
- 입력은 **원본 이미지가 아니라 변환 결과인 촉각 점 그리드**(`Uint8Array(gridW*gridH)`, 1=점 있음).
- 이미지 변환 다이얼로그에서 `벡터 라인 오브젝트 (Beta)` 토글을 켜면, 변환된 그리드에 대해 `vectorizeGrid(cells, w, h)`가 실행되어 선/도형 오브젝트 배열을 생성합니다.
- 알고리즘: 연결 요소(4-이웃) → 윤곽 추적 → RDP 단순화 → 근접점 병합 → 형태 분류.

### 3.2 데이터 구조 — `pageVectors`
```
this.pageVectors : { [pageIndex:number]: VectorObject[] }
```
- **페이지 인덱스별** 벡터 오브젝트 배열(페이지 그래픽 `pages[i]`와 병렬).
- 페이지 추가/삭제 시 `_reindexPageVectorsInsert/Delete`로 인덱스 재정렬.
- `resetPages()` / 새 이미지 변환 시 초기화. 값이 없으면 해당 키는 삭제(빈 배열 미보존).

### 3.3 오브젝트 타입 — `VectorObject`
```js
{
  type: 'line' | 'rect' | 'ellipse' | 'polyline',
  points: [[x, y], ...],          // 좌표 배열 (아래 좌표 기준 참조)
  closed: boolean,                // 'line' = false, 그 외 = true
  bbox: { x, y, w, h }            // 경계 상자 (그리드 셀 단위)
}
```
- `line`: 얇고 긴(hairline) 요소. 최원접점 쌍 2점, `closed:false`.
- `rect`: 축 정렬된 4~6점 폐곡선(`_vecClassifyShape`).
- `ellipse`: 중심 반지름 변동계수(cv)<0.18, 점 ≥8개인 폐곡선.
- `polyline`: 위 어디에도 안 맞는 일반 폐곡선.

### 3.4 좌표 기준
- **그리드 셀 좌표계**: 원점 좌상단 `(0,0)`, x는 0..gridW-1, y는 0..gridH-1 — 촉각 점 그리드와 동일한 단위.
- 모든 좌표·bbox 값은 **소수점 1자리로 반올림**(`_vecRound1`).

### 3.5 생성 파라미터 (기본값) 및 품질 신호
- `tolerance=1.1`(RDP), `minArea=3`, `minGap=0.8`, `minLoopPoints=3`, `maxObjects=400`.
- `stats.tooFragmented`: 오브젝트 > 60개 또는 밀도 > 0.06 → "조각이 너무 많음" 경고.
- `stats.truncated`: `maxObjects` 도달 시 true(초과분 버림) — UI 경고와 연동.

### 3.6 저장 / 내보내기 가능 여부 (현재 Beta 범위)
| 경로 | 벡터 보존 | 비고 |
|---|---|---|
| 세션 메모리(`pageVectors`) | ✅ | 세션 중 유지 |
| **JSON 자산 내보내기**(`buildLibraryAsset` → `exportLibraryAsset`) | ✅ | 페이지별 `vectorLineObjects` 필드로 기록(추가 전용 필드) |
| localStorage 라이브러리 저장(`saveLibrary`) | ❌ | cells/hex/thumb만 저장 → 재열기 시 벡터 미복원 |
| 자산 다시 열기(import) | ❌ | `vectorLineObjects`를 다시 `pageVectors`로 읽어들이는 경로 없음 |
| 메인 캔버스 렌더/편집 | ❌ | 벡터는 **이미지 변환 다이얼로그의 "벡터화 보기 Beta" 프리뷰**에서만 표시 |

> 즉 현재 벡터화는 **(1) 촉각 그리드 기반 미리보기 + (2) JSON 자산으로의 메타 내보내기**까지가 범위입니다.
> 정식 승격을 위해 필요한 후속 작업: 자산 import 시 `vectorLineObjects → pageVectors` 복원, 메인 캔버스 벡터 레이어 렌더/선택/편집, localStorage 저장 포맷에 벡터 포함.

---

## 4. Tactile Worlds 이관 관점 (기능별 분리 지점)
- **접근성**: `a11yMode` 플래그 + 관련 renderVals/`hRowsA11y`로 격리 → 별도 Accessibility 모듈로 추출 가능.
- **DotPad I/O**: Inspector · DotPad pane + `DP.output/outputText`, liblouis(`window.TSBraille`) → 디바이스 모듈.
- **이미지 변환 + 벡터화**: import 다이얼로그 + `applyConv`/`vectorizeGrid`/`pageVectors` → 변환 모듈(벡터화는 Beta 하위 기능).
- **명령어/랜덤 생성**: `runCommand`/`buildDraft`/`makePattern` + corpus(`corpus.js`) → 생성 모듈.
- **문서/저장**: `pages`/`pageAudio`/`pageVectors` + `buildLibraryAsset`(schema v1) → 문서 모델 모듈.
