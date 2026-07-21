// iframe embed bridge for the vanilla tactile-studio (backendless, additive).
//
// Loaded via <script src="./embed-bridge.js"> AFTER support.js/corpus. It is a
// SIBLING module in the same style as corpus-search.js: it only reads, adds a
// class + a <style>, and talks to the parent over a validated postMessage
// channel. It does NOT touch the editor's internals, routing, auth, or the
// language channel (the app owns locale via its own 'locale-change' handler).
//
// Contract (see docs/IFRAME-EMBED.md — the component-embed contract in
// INTEGRATION.md is a SEPARATE path and is not affected by this file):
//
//   studio → parent  {source:'tactile-studio', type:'ready'}
//   studio → parent  {source:'tactile-studio', type:'graphic',
//                     payload:{title, spec:'60x40'|'96x64', data:<hex>}}
//   parent → studio  {source:'tactile-world',  type:'request-graphic'}
//   parent → studio  {source:'tactile-world',  type:'locale-change', ...}  (handled by the app, not here)
//
// Pull model: the parent renders its own "publish" button in its chrome
// (outside the iframe). On click it sends 'request-graphic'; the studio replies
// with the current page's title/spec/hex. Login + publish stay in the parent.
//
// The only in-app hook this needs is a read-only facade the app exposes:
//   window.__tsStudioGraphic = () => ({ title, spec, data })   // see index.html
//
// Structure: the whole message-decision is a PURE function (decideResponse) so
// it is unit-testable without a real parent frame; the browser section is thin
// wiring that resolves the real context and posts the result.
(function (root, factory) {
  'use strict';
  var api = factory();
  // Dual surface: unit tests import the pure core; the browser gets the wiring.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') api._wireBrowser(window, document);
})(this, function () {
  'use strict';

  var STUDIO_SOURCE = 'tactile-studio';
  var PARENT_SOURCE = 'tactile-world';

  // ── pure helpers ──────────────────────────────────────────────────────
  function validHex(data, spec) {
    var need = spec === '96x64' ? 1536 : 600;
    return typeof data === 'string' && data.length === need && /^[0-9a-f]+$/i.test(data);
  }

  // Pure decision: given a resolved context, return the message to post back to
  // the parent, or null to ignore. No DOM, no globals — fully testable.
  //   ctx = { fromParentWindow:boolean, eventOrigin:string,
  //           parentOrigin:string|null, data:any, getGraphic?:function }
  function decideResponse(ctx) {
    if (!ctx || !ctx.fromParentWindow) return null;                 // not the embedding frame (or standalone)
    if (ctx.parentOrigin && ctx.eventOrigin !== ctx.parentOrigin) return null;
    var d = ctx.data;
    if (!d || d.source !== PARENT_SOURCE) return null;              // our channel only
    if (d.type !== 'request-graphic') return null;                 // locale-change is the app's job
    var getter = ctx.getGraphic;
    if (typeof getter !== 'function') return { type: 'graphic-error', payload: { reason: 'no-facade' } };
    var g;
    try { g = getter(); } catch (e) { return { type: 'graphic-error', payload: { reason: 'facade-threw' } }; }
    if (!g || !validHex(g.data, g.spec)) return { type: 'graphic-error', payload: { reason: 'empty-or-invalid' } };
    return {
      type: 'graphic',
      payload: { title: String(g.title == null ? '' : g.title).slice(0, 60), spec: g.spec, data: g.data },
    };
  }

  // ── browser wiring (thin) ─────────────────────────────────────────────
  function _wireBrowser(win, doc) {
    function isEmbedded() {
      try {
        var p = new URLSearchParams(win.location.search).get('embed') === '1';
        return p || (win.parent && win.parent !== win);
      } catch (e) { return false; }
    }
    function parentOrigin() {
      try {
        var ao = win.location.ancestorOrigins;
        if (ao && ao.length) return ao[0];
        if (doc.referrer) return new URL(doc.referrer).origin;
      } catch (e) { /* noop */ }
      return null;
    }
    var PARENT_ORIGIN = parentOrigin();

    function post(type, payload) {
      if (!win.parent || win.parent === win) return;
      win.parent.postMessage({ source: STUDIO_SOURCE, type: type, payload: payload }, PARENT_ORIGIN || '*');
    }

    function injectEmbedStyle() {
      if (doc.getElementById('ts-embed-style')) return;
      var s = doc.createElement('style');
      s.id = 'ts-embed-style';
      s.textContent =
        '.ts-embed .ts-brand-logo,.ts-embed .ts-left-divider{display:none!important}' +
        '.ts-embed{--ts-embed:1}';
      (doc.head || doc.documentElement).appendChild(s);
    }

    function onMessage(e) {
      var res = decideResponse({
        fromParentWindow: e.source === win.parent && win.parent !== win,
        eventOrigin: e.origin,
        parentOrigin: PARENT_ORIGIN,
        data: e.data,
        getGraphic: win.__tsStudioGraphic,
      });
      if (res) post(res.type, res.payload);
    }

    if (isEmbedded()) {
      var rootEl = doc.documentElement;
      if (rootEl && rootEl.classList) rootEl.classList.add('ts-embed');
      injectEmbedStyle();
      win.addEventListener('message', onMessage);
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { post('ready'); });
      else post('ready');
    }

    win.__tsEmbed = {
      isEmbedded: isEmbedded,
      parentOrigin: function () { return PARENT_ORIGIN; },
      notifyExit: function () { post('exit'); },
    };
  }

  return {
    STUDIO_SOURCE: STUDIO_SOURCE,
    PARENT_SOURCE: PARENT_SOURCE,
    validHex: validHex,
    decideResponse: decideResponse,
    _wireBrowser: _wireBrowser,
  };
});
