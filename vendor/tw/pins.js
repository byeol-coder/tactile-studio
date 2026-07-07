(function(){
'use strict';
// ============================================================
// 촉각 핀 공용 유틸 (데모 인코딩 기준과 1:1) — 모듈화로 화면 간 재사용
//   디코딩은 PinGraphic.decodePins가 담당. 여기선 규격 파싱 + 다운로드 생성.
//   ★셀 매핑은 데모 EA 순서(열 우선)로 고정 — RENDER_DATA_SPEC.md 참조.
// ============================================================

// 데모 EA 셀 매핑 (bit → 셀 내 dx,dy). 디코드/인코드 공용.
const CELL = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]];
const CW = 2, CH = 4;

function parseSpec(spec) {
  const m = String(spec || "").match(/(\d+)\s*[×xX]\s*(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [60, 40];
}

// 2차원 bits(행우선) → hex 문자열 (셀 행우선, EA 매핑). data 라운드트립·다운로드용.
function encodeBits(bits, cols, rows) {
  const ccols = Math.floor(cols / CW), crows = Math.floor(rows / CH);
  let out = "";
  for (let cr = 0; cr < crows; cr++) {
    for (let cc = 0; cc < ccols; cc++) {
      let byte = 0;
      CELL.forEach(([dx, dy], b) => {
        const x = cc * CW + dx, y = cr * CH + dy;
        if (y < rows && x < cols && bits[y] && bits[y][x]) byte |= (1 << b);
      });
      out += byte.toString(16).padStart(2, "0");
    }
  }
  return out;
}

// 브라우저 파일 다운로드 트리거
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(title, ext) {
  return (title || "tactile").replace(/[\\/:*?"<>|]+/g, "_") + "." + ext;
}

// bits → SVG 문자열 (편집용 벡터). ON 점만 원으로.
function bitsToSVG(bits, cols, rows, { cell = 10, dotR = 4.2, title = "" } = {}) {
  const W = cols * cell, H = rows * cell;
  let dots = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (bits[y] && bits[y][x]) {
        dots += `<circle cx="${x * cell + cell / 2}" cy="${y * cell + cell / 2}" r="${dotR}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}"><rect width="${W}" height="${H}" fill="#ffffff"/><g fill="#16150F">${dots}</g></svg>`;
}

// .dtms(멀티페이지 JSON) 생성 — 데모 vh 형식과 동일 구조.
function buildDtms(title, spec, items) {
  const [c] = parseSpec(spec);
  return JSON.stringify({
    title: title || "tactile",
    lang: "korean",
    lang_option: "1",
    device: c >= 96 ? "dotpad768" : "dotpad320",
    audioPath: "",
    items: (items || []).map((s, n) => ({
      page: n + 1,
      title: s.label || title,
      graphic: { name: `${n + 1}.dtm`, data: s.data || "" },
      text: { name: `${n + 1}.txt`, data: "", plain: s.label || "" },
      audio: { fileName: "" },
    })),
  }, null, 2);
}

// ===== 핀 격자 후처리 (선 굵기 / 노이즈 제거) =====
// 선 굵기: level<0 얇게(침식) · 0 보통(그대로) · >0 굵게(팽창, 횟수=level). 4-이웃 기준.
function thickenBits(grid, cols, rows, level) {
  if (!grid || !level) return grid;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let g = grid.map((r) => r.slice());
  const grow = level > 0, passes = Math.abs(level);
  for (let p = 0; p < passes; p++) {
    const src = g.map((r) => r.slice());
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let anyOn = false, anyOff = false;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        const v = (nx >= 0 && nx < cols && ny >= 0 && ny < rows) ? src[ny][nx] : false;
        if (v) anyOn = true; else anyOff = true;
      }
      if (grow) { if (anyOn) g[y][x] = true; }              // 팽창(굵게)
      else if (src[y][x] && anyOff) g[y][x] = false;        // 침식(얇게)
    }
  }
  return g;
}

// 노이즈 제거: 켜진 핀 중 8-이웃에 켜진 핀이 하나도 없는 '고립점'을 제거.
function denoiseBits(grid, cols, rows) {
  if (!grid) return grid;
  const g = grid.map((r) => r.slice());
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!grid[y][x]) continue;
    let neigh = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx]) neigh++;
    }
    if (neigh === 0) g[y][x] = false;
  }
  return g;
}


// ── browser-global adapter (tactile-studio static build) ──
window.TW = window.TW || {};
try { window.TW.CELL = CELL; } catch(e) {}
try { window.TW.parseSpec = parseSpec; } catch(e) {}
try { window.TW.encodeBits = encodeBits; } catch(e) {}
try { window.TW.downloadBlob = downloadBlob; } catch(e) {}
try { window.TW.safeName = safeName; } catch(e) {}
try { window.TW.bitsToSVG = bitsToSVG; } catch(e) {}
try { window.TW.buildDtms = buildDtms; } catch(e) {}
try { window.TW.thickenBits = thickenBits; } catch(e) {}
try { window.TW.denoiseBits = denoiseBits; } catch(e) {}
})();
