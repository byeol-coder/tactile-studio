(function(){
'use strict';
// ============================================================
// 이미지 → 촉각 핀 변환 (데모 dg/ug/rs 1:1 이식)
//   - 캔버스에 비율 맞춤(contain) 후 그레이스케일 → 정규화 → 임계값
//   - mode "edge"(윤곽선): Sobel 엣지 + 상위 비율 임계
//   - mode "shade"(채움): Otsu 자동 임계 + 민감도 보정
//   - invert: 켜짐/꺼짐 반전
//   브라우저 전용(서버 업로드 없음). 결과는 bits[row][col] → encodeBits로 hex.
// ============================================================

// rs(cols, rows): rows×cols false 그리드
function makeGrid(cols, rows) {
  return Array.from({ length: rows }, () => new Array(cols).fill(false));
}

// ug(gray, cols, rows, opts): 그레이스케일(Float32, 0..255) → bits[row][col]
function grayToBits(gray, cols, rows, opts) {
  const total = cols * rows;
  const grid = makeGrid(cols, rows);
  const s = (opts.thr ?? 50) / 100;

  if (opts.mode === "edge") {
    // Sobel 엣지 크기
    const mag = new Float32Array(total);
    let max = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const gx = -gray[(y - 1) * cols + x - 1] - 2 * gray[y * cols + x - 1] - gray[(y + 1) * cols + x - 1]
          + gray[(y - 1) * cols + x + 1] + 2 * gray[y * cols + x + 1] + gray[(y + 1) * cols + x + 1];
        const gy = -gray[(y - 1) * cols + x - 1] - 2 * gray[(y - 1) * cols + x] - gray[(y - 1) * cols + x + 1]
          + gray[(y + 1) * cols + x - 1] + 2 * gray[(y + 1) * cols + x] + gray[(y + 1) * cols + x + 1];
        const v = Math.hypot(gx, gy);
        mag[y * cols + x] = v;
        if (v > max) max = v;
      }
    }
    if (max <= 0) return opts.invert ? grid.map((r) => r.map(() => true)) : grid;
    // 상위 (0.05 ~ 0.45) 비율만 엣지로 채택 (민감도↑ → 더 많이)
    const keep = 0.05 + s * 0.4;
    const scale = 256 / max;
    const hist = new Int32Array(258);
    for (let i = 0; i < total; i++) if (mag[i] > 0) hist[Math.min(256, Math.floor(mag[i] * scale))]++;
    let nonzero = 0;
    for (let i = 1; i <= 256; i++) nonzero += hist[i];
    let acc = 0, cut = 1;
    for (let i = 256; i >= 1; i--) { acc += hist[i]; if (acc >= nonzero * keep) { cut = i; break; } }
    const thr = cut / scale;
    for (let y = 1; y < rows - 1; y++)
      for (let x = 1; x < cols - 1; x++)
        if (mag[y * cols + x] > 0 && mag[y * cols + x] >= thr) grid[y][x] = true;
  } else {
    // Otsu 자동 임계 + 민감도 보정 (어두운 픽셀 = 켜짐)
    const hist = new Int32Array(256);
    for (let i = 0; i < total; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let wB = 0, sumB = 0, maxVar = -1, otsu = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; otsu = i; }
    }
    const cut = Math.max(8, Math.min(247, otsu + (s - 0.5) * 120));
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (gray[y * cols + x] < cut) grid[y][x] = true;
  }

  if (opts.invert)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) grid[y][x] = !grid[y][x];
  return grid;
}

// dg(img, cols, rows, opts): 이미지 → bits[row][col]
function imageToBits(img, cols, rows, opts) {
  const cv = document.createElement("canvas");
  cv.width = cols; cv.height = rows;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cols, rows);
  // 비율 유지(contain), 가운데 정렬
  const s = Math.min(cols / img.width, rows / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const total = cols * rows;
  const gray = new Float32Array(total);
  let min = 255, max = 0;
  for (let i = 0; i < total; i++) {
    // 투명 픽셀은 흰색(255)으로 취급
    const lum = data[i * 4 + 3] < 128 ? 255 : 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = lum;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  // 명암 정규화(대비 스트레치)
  const range = Math.max(1, max - min);
  for (let i = 0; i < total; i++) gray[i] = (gray[i] - min) / range * 255;
  return grayToBits(gray, cols, rows, opts);
}

// 파일 → HTMLImageElement (data URL 경유, 서버 업로드 없음)
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("이미지 파일을 선택해 주세요.")); return; }
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    rd.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
      img.onload = () => resolve(img);
      img.src = e.target.result;
    };
    rd.readAsDataURL(file);
  });
}


// ── browser-global adapter (tactile-studio static build) ──
window.TW = window.TW || {};
try { window.TW.grayToBits = grayToBits; } catch(e) {}
try { window.TW.imageToBits = imageToBits; } catch(e) {}
try { window.TW.fileToImage = fileToImage; } catch(e) {}
})();
