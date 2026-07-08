# vendor/liblouis/

Tactile Studio의 실제 점역(braille translation) 엔진. `window.TSBraille` (정의는
`braille.js`)를 통해서만 사용한다 — 이 폴더의 다른 파일을 직접 참조하지 않는다.

## 내용물

- `build-no-tables-utf32.js` (1.6MB) — liblouis 3.2.0의 공식 asm.js 빌드
  (`liblouis-build` npm 패키지, UTF-32 버전). WASM이 아니라 asm.js라서 스크립트
  실행이 끝나면 이미 동기적으로 초기화가 완료돼 있다 (별도 `onRuntimeInitialized`
  대기 불필요).
- `tables/` (18개 파일, ~940KB) — 아래 4개 루트 테이블과 그 include 의존성의
  전체 폐쇄 집합(transitive closure). 딱 이 18개만 있으면 되고, 더 필요 없다:
  - `ko-2006-g1.ctb` — 한국어 정자(1급)
  - `ko-2006-g2.ctb` — 한국어 약자(2급, 기본값)
  - `en-ueb-g1.ctb` — UEB 1급
  - `en-ueb-g2.ctb` — UEB 2급
  - `unicode.dis` — 출력을 유니코드 점자(U+2800 블록)로 만드는 디스플레이 테이블.
    항상 테이블 목록 맨 앞에 와야 한다 (`unicode.dis,ko-2006-g2.ctb` 순서).
- `braille.js` — 브라우저 어댑터. `window.TSBraille`만 외부에 노출한다.

## 왜 easy-api를 안 쓰는가

liblouis 공식 JS 래퍼(`easy-api.js`)는 출력 버퍼 크기 추정 버그가 있어 특정
입력에서 결과가 잘린다. `braille.js`는 이를 피하려고 C 함수
`lou_translateString`을 `Module.ccall`로 직접 호출하고, 출력 버퍼를 항상
넉넉하게(입력 길이 기준 여유 있게) 직접 할당한다.

## API (`window.TSBraille`)

```js
await window.TSBraille.preload();               // 엔진+테이블 지연 로드 (최초 1회만 네트워크 요청)
window.TSBraille.isReady();                      // preload 완료 여부
window.TSBraille.translate(text, langKey);       // langKey: 'ko-g2'|'ko-g1'|'ueb-g1'|'ueb-g2'
                                                  // → { ok, unicode, cells, reason? }
window.TSBraille.padOrTruncate(unicode, width);  // 지정 칸 수로 패딩(⠀)/절단
```

`translate()`는 **`preload()`가 끝나기 전에는 항상 `{ ok:false }`를 반환**한다 —
호출부는 반드시 먼저 `preload()`를 기다린 뒤 호출해야 한다 (`index.html`의
`translateToBraille()`, `_runBraillePreview()` 참고).

## DotPad 전송 바이트 변환 (`index.html`의 `_brailleUnicodeToHex`)

`window.TSBraille.translate()`가 돌려주는 유니코드 점자 문자를 실제 SDK
`outputText()`/`displayTextData()`에 넘길 hex로 바꿀 때, **비트 반전이나
재배열이 전혀 필요 없다** — 유니코드 코드포인트에서 `0x2800`만 빼면 그게
정확히 SDK가 원하는 바이트다.

이건 추정이 아니라 SDK 소스(`vendor/tw/dotpad-sdk.js`)의 실제
`brailleToGraphic()` 함수를 그대로 뽑아 각 점(dot1~dot8) 단독 비트를 하나씩
통과시켜 실측 검증한 결과다: dot1/2/3/8은 그대로, dot4/5/6/7은 2×4 그래픽
그리드의 두 번째 열/추가 행으로 이동 — 정확히 표준 8점 점자의 물리적 배치와
일치한다. (재현하고 싶으면 각 단일 비트 바이트를 `brailleToGraphic`에 넣고
출력을 확인하면 된다.)

## 절대 원칙

점역이 실패하면(엔진 미로드, 알 수 없는 언어, 예외 등) **절대 원문 텍스트를
대신 보내지 않는다.** 실패는 항상 `null`/`{ok:false}`로 알리고, 호출부는 조용히
건너뛴다(콘솔 경고 1회) — 시각장애인 사용자에게 잘못된 점자를 보여주는 것보다
아무것도 안 보내는 편이 안전하다.

## 라이선스

liblouis 자체와 대부분의 테이블은 LGPL v3(엔진) / 각 테이블 파일 헤더에 명시된
라이선스(대개 LGPL 계열)를 따른다. 배포 전 각 테이블 파일 상단의 라이선스
주석을 확인할 것.
