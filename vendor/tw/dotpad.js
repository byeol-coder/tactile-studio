(function(){
'use strict';
// 닷패드 연결/출력 — 데모(admin-review)의 검증된 흐름을 그대로 이관한 싱글턴.
//   scan → connectBleDevice → displayGraphicData(hex, device, GraphicMode)
//   hex는 pins.js encodeBits 결과(= 데모 DOT_BITS 인코딩과 동일)를 그대로 사용.
// SDK는 정적 import로 즉시 로드됨(Web Bluetooth 사용자 제스처 제약: 클릭 핸들러 안에서 동적 import 금지).
// (dotpad-sdk.js loaded separately as a <script> before this file)

const DP = {
  sdk: null, btDevice: null, device: null, live: false, busy: false, _vis: false,
  _appKeyHandler: null,

  // 앱이 닷패드 물리 키 입력(PanningLeft/PanningRight/KeyFunction* 등)을 구독하는 통로.
  // DP는 connect()마다 새 sdk 인스턴스를 만들지만 이 핸들러는 DP(싱글턴)에 저장되므로
  // 재연결과 무관하게 한 번만 등록하면 계속 유지된다.
  onKey(fn) { this._appKeyHandler = typeof fn === 'function' ? fn : null; },

  // 실제 SDK + Web Bluetooth 사용 가능 여부
  hasReal() {
    return typeof window !== "undefined"
      && typeof window.DotPadSDK === "function"
      && typeof window.DotPadScanner === "function"
      && !!(typeof navigator !== "undefined" && navigator.bluetooth);
  },

  gattOk() {
    try { return !!(this.btDevice && this.btDevice.gatt && this.btDevice.gatt.connected); }
    catch { return false; }
  },

  isConnected() { return this.live && this.gattOk(); },

  // 연결된 기기 이름(예: "DotPad-320")
  deviceName() {
    try { return (this.btDevice && this.btDevice.name) || "DotPad"; }
    catch { return "DotPad"; }
  },

  // GATT가 끊겼으면 재연결 시도
  async ensure(force) {
    if (!(this.sdk && this.btDevice)) return !!this.device;
    if (!force && this.device && this.gattOk()) return true;
    try { if (this.device && this.sdk.disconnect) await this.sdk.disconnect(this.device); } catch { /* noop */ }
    this.device = null;
    try {
      const t = await this.sdk.connectBleDevice(this.btDevice);
      if (t) { this.device = t; this.live = true; return true; }
    } catch { /* noop */ }
    return false;
  },

  // 기기 스캔 + 연결 (반드시 사용자 클릭 안에서 호출)
  async connect() {
    if (!this.hasReal()) return false;
    const sdk = new window.DotPadSDK();
    const bt = await new window.DotPadScanner().startBleScan();
    if (!bt) return false; // 사용자가 취소
    const dev = await sdk.connectBleDevice(bt);
    try {
      sdk.setCallBack((d, code) => {
        const C = window.DotPadDataCodes || {};
        if (code === C.Disconnected || code === "Disconnected") { DP.live = false; DP.device = null; }
        else if (code === C.Connected || code === "Connected") { DP.live = true; }
      }, (d, code, extra) => {
        if (DP._appKeyHandler) { try { DP._appKeyHandler(code, extra); } catch { /* noop */ } }
      });
    } catch { /* noop */ }
    this.sdk = sdk; this.btDevice = bt; this.device = dev; this.live = !!dev;
    // 탭 복귀 시 GATT 끊김 자동 복구
    if (!this._vis) {
      this._vis = true;
      try {
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && DP.sdk && DP.btDevice && !DP.gattOk()) DP.ensure().catch(() => {});
        });
      } catch { /* noop */ }
    }
    return !!dev;
  },

  // 촉각 그래픽 출력 (hex = encodeBits 결과)
  async output(hex) {
    if (this.busy || !hex) return false;
    this.busy = true;
    try {
      if (!(this.sdk && this.btDevice)) return false;
      const mode = (window.DotPadDisplayMode && window.DotPadDisplayMode.GraphicMode) || undefined;
      if (!this.device || !this.gattOk()) await this.ensure();
      if (!this.device) return false;
      try { await this.sdk.displayGraphicData(hex, this.device, mode); return true; }
      catch {
        try { if (await this.ensure(true)) { await this.sdk.displayGraphicData(hex, this.device, mode); return true; } }
        catch { /* noop */ }
        return false;
      }
    } finally { this.busy = false; }
  },

  // 점자 라인 출력 (hex = 점역된 점자 데이터, brailleToGraphic 인코딩은 SDK가 처리).
  // 호출부는 반드시 실제 점역(text→braille) 결과만 넘겨야 함 — 원문 텍스트를
  // 그대로 넘기면 안 됨(잘못된 점자가 사용자에게 그대로 전달되는 심각한 문제).
  async outputText(hex) {
    if (this.busy || !hex) return false;
    this.busy = true;
    try {
      if (!(this.sdk && this.btDevice)) return false;
      const mode = (window.DotPadDisplayMode && window.DotPadDisplayMode.TextMode) || undefined;
      if (!this.device || !this.gattOk()) await this.ensure();
      if (!this.device) return false;
      try { await this.sdk.displayTextData(hex, this.device, mode); return true; }
      catch {
        try { if (await this.ensure(true)) { await this.sdk.displayTextData(hex, this.device, mode); return true; } }
        catch { /* noop */ }
        return false;
      }
    } finally { this.busy = false; }
  },

  // 연결된 기기가 지원하는 점자 셀 수 (보드 정보로 실기기 값을 받기 전까지는 20 기본값).
  brailleCellCount() {
    try { return (this.device && this.device.numberBrailleCellColumns) || 20; }
    catch { return 20; }
  },

  async disconnect() {
    try { if (this.sdk && this.sdk.disconnect) await this.sdk.disconnect(); } catch { /* noop */ }
    this.sdk = null; this.btDevice = null; this.device = null; this.live = false;
  },
};

DP;


// ── browser-global adapter (tactile-studio static build) ──
window.TW = window.TW || {};
try { window.TW.DP = DP; } catch(e) {}
})();
