# Known Issues (pre-migration baseline)

문서 목적: 마이그레이션 규칙에 따라, **기존 동작에 포함된 확인된 버그**는 수정 전에 별도로 기록한다.
아래 항목은 Phase 1 시점의 `main`에서 실제로 재현·확인된 것이며, 회귀 픽스처는 (버그를 포함한) 현재 동작을 그대로 고정한다.
버그 수정은 마이그레이션 커밋과 분리된 독립 변경으로 진행하고, 그때 해당 픽스처를 의식적으로 재생성한다.

## 1. [해결됨] `banaPrintCheck` 미정의 → `buildLibraryAsset` 항상 TypeError

**상태: 해결** — `fix(studio): implement missing banaPrintCheck` 커밋에서 convQuality 지표를 재사용하는 `banaPrintCheck` 구현(비어있음·과밀·고립점 검사)과 누락됐던 `banaPass` i18n 키(ko/en)를 추가. `tests/fixtures/baseline/library-asset-v1.json` 픽스처를 성공 케이스로 의식적으로 재생성했고, 회귀 테스트가 Library Asset v1 전체 페이로드를 바이트 단위로 고정한다.

- 위치: `index.html` x-dc 블록
  - 호출부 3곳: `deriveGraphicFeatures()` 내부(라이브러리 에셋 v1의 `graphicFeatures.embossable` 산출), 및 인스펙터 쪽 1곳 (`this.banaPrintCheck(this.cells, 60, 40)`)
  - 정의부: `index.html`, `support.js`, `vendor/`, `corpus*.js` 어디에도 없음 (전 소스 grep으로 확인)
- 현재 런타임 영향:
  - `buildLibraryAsset()` → `deriveGraphicFeatures()` → `TypeError: this.banaPrintCheck is not a function`
  - `exportFormat('JSON')`(라이브러리 에셋 v1 내보내기)은 try/catch로 감싸져 있어 사용자에게는 "Export failed" 토스트로만 나타남 — 즉 **JSON/라이브러리 에셋 내보내기가 현재 main에서 동작하지 않음**
- 회귀 픽스처: `tests/fixtures/baseline/library-asset-v1.json` 은 `{ throws: true, errorName: "TypeError", … }` 형태로 현재 동작을 고정
- 조치 계획: Phase 2(코어 추출)와 무관한 별도 fix 커밋에서 `banaPrintCheck` 구현(BANA 인쇄 최소 규격 검사) 복원 또는 안전한 폴백 결정 → 그 커밋에서 픽스처를 성공 케이스로 재캡처

## 2. DotPad SDK `.d.ts` 불일치 (참고)

- `displayAllUp` / `displayAllDown` 은 번들된 SDK 런타임에는 존재하지만 타입 선언에는 없음.
- Phase 4(디바이스 어댑터)에서 실제 SDK 파일을 검사해 존재 여부를 재확인하고, 존재가 확인된 메서드만 어댑터 인터페이스의 optional 멤버로 노출한다.
