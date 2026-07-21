# iframe 임베드 (vanilla 앱을 호스트에 iframe으로 붙이기)

이 문서는 **배포 중인 vanilla 앱**(`index.html` + `support.js` + `corpus*.js` + `vendor/`)을
호스트(Tactile World / tw-app)에 **iframe으로** 임베드하는 경로를 다룬다.

> `INTEGRATION.md`는 이것과 **별개 경로**다 — 그쪽은 `tactile-studio/react`의
> `<TactileStudioEditor>`를 호스트에 **React 컴포넌트로 직접 마운트**하는 정식/장기 경로이고,
> services 주입·콜백을 쓴다. 이 iframe 경로는 "지금 배포본을 그대로, 최소 배선으로 붙인다"에
> 최적화된 브리지다. 컴포넌트 경로로 전환할 준비가 되면 이 iframe 브리지는 걷어내면 된다.

---

## 구성

- **`embed-bridge.js`** — 새 sibling 스크립트(`corpus-search.js`와 같은 방식). 임베드 감지,
  크롬 숨김(브랜드 로고/디바이더만), 부모와의 검증된 postMessage 채널을 담당. 에디터 내부·라우팅·
  인증·언어 채널은 건드리지 않는다.
- **in-app 훅 2곳** (`index.html`, additive):
  1. `<script src="./embed-bridge.js"></script>` 로드 (corpus-search.js 다음).
  2. `componentDidMount`에서 읽기 전용 facade 노출 — 호스트가 현재 그래픽을 당겨갈 수 있게:
     ```js
     window.__tsStudioGraphic = () => ({
       title: this.state.fileName || this.T().untitled,
       spec:  this.state.gridW + 'x' + this.state.gridH,   // '60x40' | '96x64'
       data:  this.cellsToHex(),                            // TW.encodeBits 결과 (dotBit=lx*4+ly)
     });
     ```
     (`componentWillUnmount`에서 정리.)

auth 경계: **스튜디오는 익명.** 변환·미리보기·핀 편집·DotPad emboss(BLE, 서버 쓰기 없음)·로컬
내보내기 전부 로그인 없이. **publish/업로드는 호스트가 소유** — 호스트가 자기 크롬에 "공개하기"
버튼을 두고, 그래픽을 당겨간 뒤 로그인 게이트 + 저장을 자기 백엔드로 처리한다.

---

## postMessage 계약

봉투: `{ source, type, payload? }`.

### 스튜디오 → 부모 — `source: 'tactile-studio'`

| type | payload | 의미 |
|---|---|---|
| `ready` | — | 브리지 마운트 완료. 이후 부모가 `locale-change`/`request-graphic`를 보내도 됨. |
| `graphic` | `{ title, spec:'60x40'\|'96x64', data:<hex> }` | `request-graphic`에 대한 응답. 현재 페이지의 제목·스펙·hex. |
| `graphic-error` | `{ reason }` | facade 없음/빈 그래픽 등 — 부모는 안내 후 무시. |
| `exit` | — | (선택) `window.__tsEmbed.notifyExit()` 호출 시. 부모가 모달 닫기. |

### 부모 → 스튜디오 — `source: 'tactile-world'`

| type | payload | 의미 |
|---|---|---|
| `locale-change` | `{ locale:'ko'\|'en' }` | 언어 전환. **앱의 기존 `onParentLocale` 핸들러가 처리**(embed-bridge.js 아님). |
| `request-graphic` | — | 현재 그래픽을 달라. 스튜디오가 `graphic`으로 응답. |

### 오리진 검증 (양측 필수)

- 스튜디오: `window.parent !== window` + `e.source === window.parent` +
  (도출 가능하면) `e.origin === ancestorOrigins[0]||referrer origin` + `source === 'tactile-world'`.
- 부모: `e.origin === (studio iframe 오리진)` + `source === 'tactile-studio'`. 스튜디오로 보낼 때
  `postMessage`의 targetOrigin에 `'*'` 쓰지 말 것.
- payload 재검증: `spec ∈ {'60x40','96x64'}`, hex 길이 = `spec==='96x64' ? 1536 : 600`, `[0-9a-f]`만.

---

## 핸드셰이크

```
studio(iframe) mount → embed-bridge.js
  · ?embed=1 또는 iframe 내부 → <html>.ts-embed 클래스 + 크롬 숨김
  · ready ─────────────────────────────▶ 부모
                                          부모: locale-change {locale} ──▶ studio (앱이 반영)
... 사용자가 변환/편집/emboss (전부 iframe 내부) ...
호스트 크롬의 "공개하기" 클릭
  부모: request-graphic ───────────────▶ studio
  studio: graphic {title,spec,data} ───▶ 부모
                                          부모: 로그인 게이트 → 자기 백엔드에 저장
```

---

## 부모(호스트) 측 참고 구현

`StudioFrame.tsx`(이 브랜치 산출물에 동봉) 참고. 요지:

```ts
const src = studioUrl + '?embed=1';                 // 언어는 query 아님 — ready 후 locale-change로 전달
const origin = new URL(studioUrl).origin;

// 수신
onMessage(e){
  if (e.origin !== origin) return;
  if (e.data?.source !== 'tactile-studio') return;
  if (e.data.type === 'ready')  frame.postMessage({source:'tactile-world',type:'locale-change',locale}, origin);
  if (e.data.type === 'graphic') onPublish(e.data.payload);   // 로그인 게이트는 여기서
  if (e.data.type === 'graphic-error') showNotice(...);
}

// 공개하기 클릭 (호스트 크롬, iframe 밖)
onPublishClick(){ frame.postMessage({source:'tactile-world',type:'request-graphic'}, origin); }
```

iframe `allow`: 최소 `"bluetooth; clipboard-write"`.

---

## 검증

**1) 자동 (배포 게이트에 포함)**
- `node tools/check-xdc-syntax.mjs` — index.html의 x-dc 블록 문법. (통과 확인됨)
- `node --check embed-bridge.js` — 스크립트 문법.
- `npm test`(vitest) — `tests/regression/embed-bridge.test.ts`가 순수 계약을 검증한다:
  `validHex`(60x40=600 / 96x64=1536 / 비-hex 거부), `decideResponse` 해피패스(request-graphic→graphic,
  title 60자 클램프), 거부 경로(비-부모창·오리진 불일치·낯선 source·locale-change는 앱 몫이라 null),
  graphic-error(no-facade / facade-threw / empty-or-invalid). 이 테스트는 배포본 `embed-bridge.js`를
  그대로 로드해 순수 코어만 실행한다(브라우저 배선 미실행).

**2) 브라우저 눈 확인 (자동화 불가 — 반드시 사람이)**
`dev/embed-harness.html`을 **http로** 띄워 부모 프레임 역할로 스튜디오를 iframe 임베드하고 왕복을 본다.
(file://은 오리진이 `null`이라 안 됨 — `npx serve .` 또는 `python3 -m http.server` 후 접속.)
- `ready` 수신 로그가 뜨는지 → 핸드셰이크 OK
- lang 토글 + `locale-change`로 스튜디오 UI 언어가 바뀌는지
- "공개하기(request-graphic)" → 우측에 title/spec/hex 길이(600/1536 ✓)가 뜨는지
- "오리진 위조 테스트"(낯선 source) 후 graphic이 **안** 뜨는지 → 무시 정상
- 크롬 확인: 브랜드 로고/디바이더만 사라지고 도구·만들기/내보내기 메뉴·캔버스는 그대로인지
- (하드웨어 있으면) iframe 안에서 Web Bluetooth로 실제 DotPad emboss가 되는지
