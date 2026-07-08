// vendor/liblouis/braille.js
// ------------------------------------------------------------------------
// Tactile Studio 점역 어댑터 (window.TSBraille)
//
// 무엇을 하는가: liblouis(asm.js, UTF-32 빌드)를 지연 로드해서 실제 점역 규정에
// 따라 텍스트 → 점자(유니코드 점자 코드포인트, U+2800블록)로 변환한다.
//
// 왜 easy-api를 안 쓰는가: liblouis의 공식 JS 래퍼(easy-api.js)는 출력 버퍼
// 크기를 잘못 추정해 특정 입력(특히 확장이 일어나는 조합)에서 잘리는 버그가
// 있다. 대신 C 함수 lou_translateString을 직접 호출해서 버퍼를 우리가 직접
// (넉넉하게) 관리한다.
//
// 절대 원칙: 점역에 실패하면(엔진 로드 실패, 알 수 없는 언어, 예외 등) 절대
// 원문 텍스트를 대신 반환하지 않는다. 실패는 항상 { ok:false }로 알린다 —
// 시각장애인 사용자에게 잘못된 점자를 보여주는 것보다, 아무것도 안 보내는
// 편이 안전하다.
// ------------------------------------------------------------------------
(function () {
  'use strict';

  const BASE = (function () {
    // 현재 스크립트 자신의 경로를 기준으로 vendor/liblouis/ 절대 경로를 구한다.
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('vendor/liblouis/braille.js') !== -1) {
        return src.slice(0, src.indexOf('braille.js'));
      }
    }
    return 'vendor/liblouis/';
  })();

  // 언어 키 → (표시 테이블 + 번역 테이블) 목록. unicode.dis를 항상 맨 앞에 둬야
  // 출력이 아스키 점자가 아니라 실제 유니코드 점자(U+2800 블록)로 나온다.
  const LANG_TABLES = {
    'ko-g2': ['unicode.dis', 'ko-2006-g2.ctb'],   // 한국어 약자(2급) — 기본값
    'ko-g1': ['unicode.dis', 'ko-2006-g1.ctb'],   // 한국어 정자(1급)
    'ueb-g1': ['unicode.dis', 'en-ueb-g1.ctb'],   // UEB 1급
    'ueb-g2': ['unicode.dis', 'en-ueb-g2.ctb'],   // UEB 2급
  };

  // 이 4개 루트 테이블이 실제로 include하는 전체 의존 파일 목록(닫힌 집합).
  // vendor/liblouis/tables/ 안에 정확히 이 18개 파일이 들어있다.
  const TABLE_FILES = [
    'unicode.dis', 'braille-patterns.cti', 'chardefs.cti', 'en-ueb-chardefs.uti',
    'en-ueb-g1.ctb', 'en-ueb-g2.ctb', 'en-ueb-math.ctb', 'en-us-g1.ctb', 'en-us-g2.ctb',
    'ko-2006-g1.ctb', 'ko-2006-g2.ctb', 'ko-2006.cti', 'ko-chars.cti',
    'ko-g1-rules.cti', 'ko-g2-rules.cti', 'latinLetterDef8Dots.uti',
    'litdigits6Dots.uti', 'loweredDigits6Dots.uti',
  ];

  let _readyPromise = null;
  let _Module = null;

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('점역 엔진 로드 실패: ' + src));
      document.head.appendChild(s);
    });
  }

  async function _init() {
    await _loadScript(BASE + 'build-no-tables-utf32.js');
    // 이 빌드는 asm.js(WASM 아님)라 스크립트 실행이 끝나는 시점에 이미
    // 동기적으로 run()까지 완료돼 있다 — 별도 onRuntimeInitialized 대기 불필요.
    const Module = window.liblouisBuild;
    if (!Module || !Module.FS || typeof Module.ccall !== 'function') {
      throw new Error('점역 엔진 초기화 실패 (Module.FS 없음)');
    }
    try { Module.FS.mkdir('/tables'); } catch (e) { /* 이미 있으면 무시 */ }

    await Promise.all(TABLE_FILES.map(async (fn) => {
      const res = await fetch(BASE + 'tables/' + fn);
      if (!res.ok) throw new Error('점역 테이블 로드 실패: ' + fn);
      const buf = new Uint8Array(await res.arrayBuffer());
      Module.FS.writeFile('/tables/' + fn, buf, { encoding: 'binary' });
    }));

    _Module = Module;
    return true;
  }

  function preload() {
    if (!_readyPromise) _readyPromise = _init().catch((err) => {
      _readyPromise = null; // 실패하면 다음에 다시 시도할 수 있게 리셋
      throw err;
    });
    return _readyPromise;
  }

  function isReady() {
    return !!_Module;
  }

  // 내부: 준비된 Module에 대해서만 호출. lou_translateString 직접 호출.
  function _translateSync(tableName, text) {
    const Module = _Module;
    const tables = LANG_TABLES[tableName];
    if (!tables) return { ok: false, unicode: '', cells: 0, reason: 'unknown-lang' };
    const tlist = tables.map(t => '/tables/' + t).join(',');

    const codepoints = Array.from(text).map(ch => ch.codePointAt(0));
    const inlen = codepoints.length;
    if (inlen === 0) return { ok: true, unicode: '', cells: 0 };
    const maxOut = (inlen + 16) * 8;

    let inbufPtr, outbufPtr, inlenPtr, outlenPtr, tableListPtr;
    try {
      inbufPtr = Module._malloc(inlen * 4);
      outbufPtr = Module._malloc(maxOut * 4);
      inlenPtr = Module._malloc(4);
      outlenPtr = Module._malloc(4);
      tableListPtr = Module._malloc(tlist.length + 1);

      for (let i = 0; i < inlen; i++) Module.HEAP32[(inbufPtr >> 2) + i] = codepoints[i];
      Module.HEAP32[inlenPtr >> 2] = inlen;
      Module.HEAP32[outlenPtr >> 2] = maxOut;
      Module.stringToUTF8(tlist, tableListPtr, tlist.length + 1);

      const ok = Module.ccall(
        'lou_translateString', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [tableListPtr, inbufPtr, inlenPtr, outbufPtr, outlenPtr, 0, 0, 0]
      );

      if (!ok) return { ok: false, unicode: '', cells: 0, reason: 'translate-failed' };

      const outlen = Module.HEAP32[outlenPtr >> 2];
      let result = '';
      for (let i = 0; i < outlen; i++) result += String.fromCodePoint(Module.HEAP32[(outbufPtr >> 2) + i]);
      return { ok: true, unicode: result, cells: outlen };
    } catch (e) {
      return { ok: false, unicode: '', cells: 0, reason: String(e && e.message || e) };
    } finally {
      if (inbufPtr) Module._free(inbufPtr);
      if (outbufPtr) Module._free(outbufPtr);
      if (inlenPtr) Module._free(inlenPtr);
      if (outlenPtr) Module._free(outlenPtr);
      if (tableListPtr) Module._free(tableListPtr);
    }
  }

  // 공개 API: 동기 번역. 엔진이 아직 준비 안 됐으면 항상 실패로 반환한다 —
  // 호출부는 미리 preload()를 걸어두고 그 결과를 기다린 뒤에 불러야 한다.
  function translate(text, langKey) {
    if (!_Module) return { ok: false, unicode: '', cells: 0, reason: 'not-ready' };
    if (!text) return { ok: true, unicode: '', cells: 0 };
    try {
      return _translateSync(langKey, text);
    } catch (e) {
      return { ok: false, unicode: '', cells: 0, reason: String(e && e.message || e) };
    }
  }

  // 20셀(또는 임의 N셀) DotPad 라인 전송용: 패딩(스페이스)/절단.
  // 원문이 20칸을 넘으면 잘리지만, 이건 '전송용' 헬퍼일 뿐 — 미리보기 카운터는
  // 별도로 전체 길이를 보여줘서 사용자가 초과 여부를 인지하게 한다.
  function padOrTruncate(unicodeCells, width) {
    width = width || 20;
    const BRAILLE_SPACE = '\u2800';
    if (unicodeCells.length >= width) return unicodeCells.slice(0, width);
    return unicodeCells + BRAILLE_SPACE.repeat(width - unicodeCells.length);
  }

  window.TSBraille = { preload, isReady, translate, padOrTruncate, LANG_TABLES: Object.keys(LANG_TABLES) };
})();
