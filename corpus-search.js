// Rule-based corpus search for the vanilla tactile-studio (backendless, no ML).
//
// Loaded via <script src="./corpus-search.js"> AFTER corpus.js. Reads the static
// bundle at window.DTMS_CORPUS and exposes:
//
//   window.searchCorpus(query, options?)   → ranked direct hits
//   window.nearMatches(query, options?)    → looser suggestions (miss path)
//   window.normalizeCorpusQuery(value)     → shared query normalizer
//
// A query is normalized (KO/EN, lowercased, punctuation folded, whitespace
// collapsed) and matched against each graphic's title, tags, category (with a
// few bilingual synonyms), and — at lower weight — its page labels/desc/braille.
// Ranking is deterministic: same query → same order, no Date/random, no fetch.
// Corpus data is only ever read, never mutated. Stage 3 wires the result into
// runCommand; this module does not touch the UI.
(function () {
  'use strict';

  var DEFAULT_LIMIT = 8;
  var NEAR_LIMIT = 4;

  // ── query normalization ───────────────────────────────────────────────
  // lowercase (English only; Korean is case-invariant), fold common
  // separators/punctuation to spaces, collapse + trim whitespace.
  function normalizeCorpusQuery(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[·.,/\\_()\[\]{}!?"'“”‘’:;]+/g, ' ')
      .replace(/[-–—−]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  var norm = normalizeCorpusQuery;

  // Split a normalized query into tokens, dropping 1-char noise.
  function tokenize(q) {
    if (!q) return [];
    return q.split(' ').map(function (t) { return t.trim(); }).filter(function (t) { return t.length >= 2; });
  }

  // Bilingual keyword hints that point at a category (recall aid, not ML).
  var CATEGORY_SYNONYMS = {
    science: ['science', '과학', '생물', '천문', '인체', 'biology', 'astronomy'],
    language: ['language', '언어', '국어', '영어', '한글', '점자', 'korean', 'english'],
    geography: ['geography', '지리', '지도', '역사', 'history', 'map'],
    basic: ['basic', '기타', '게임', 'game', 'etc'],
  };

  // Curated bilingual alias layer (recall aid, NOT ML). Maps a normalized query
  // term/phrase to canonical tokens that already exist in the corpus (titles/tags/
  // synonyms), so common KO/EN wordings resolve to the right record without
  // touching corpus.js. Keys and targets must be pre-normalized (lowercase, no
  // punctuation; '-' folds to a space, so 'pac-man' is keyed as 'pac man').
  var QUERY_ALIASES = {
    '팩맨': ['pacman'], 'pac man': ['pacman'],
    'planet': ['행성'], 'planets': ['행성'],
    'space': ['천문'], '우주': ['천문'],
    'alphabet': ['영어', '발음기호'], 'abc': ['영어', '발음기호'], '알파벳': ['영어', '발음기호'],
  };

  // Expand a normalized query into an augmented, de-duped token list: the query's
  // own tokens plus any alias targets whose key appears as a whole word/phrase.
  // Deterministic (static data, fixed key order).
  function expandQuery(q, tokens) {
    var out = tokens.slice();
    var seen = {};
    out.forEach(function (t) { seen[t] = 1; });
    var padded = ' ' + q + ' ';
    var keys = Object.keys(QUERY_ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (padded.indexOf(' ' + key + ' ') === -1) continue;
      var targets = QUERY_ALIASES[key];
      for (var j = 0; j < targets.length; j++) {
        var tk = targets[j];
        if (!seen[tk]) { seen[tk] = 1; out.push(tk); }
      }
    }
    return out;
  }

  function getCorpus() {
    return (typeof window !== 'undefined' && Array.isArray(window.DTMS_CORPUS)) ? window.DTMS_CORPUS : [];
  }

  function includesEither(a, b) {
    if (!a || !b) return false;
    return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  // Priority order for the reported primary matched field (strongest first).
  var FIELD_RANK = ['title-exact', 'tag-exact', 'category', 'title', 'tag', 'page-label', 'desc', 'braille'];
  function primaryField(fields) {
    for (var i = 0; i < FIELD_RANK.length; i++) {
      if (fields.indexOf(FIELD_RANK[i]) !== -1) return FIELD_RANK[i];
    }
    return fields[0] || 'none';
  }

  // A hit is "confident" when it matched a primary field (title/tag/category),
  // not merely page content (label/desc/braille). Stage 3 seeds the editor on
  // confident hits and falls back (with nearMatches suggestions) otherwise.
  var CONFIDENT_FIELDS = ['title-exact', 'tag-exact', 'category', 'title', 'tag'];
  function isConfident(fields) {
    for (var i = 0; i < fields.length; i++) if (CONFIDENT_FIELDS.indexOf(fields[i]) !== -1) return true;
    return false;
  }

  // ── per-page scoring (lower weight; also selects which page to seed) ─────
  function scorePage(page, q, tokens) {
    var label = norm(page && page.label);
    var desc = norm(page && page.desc);
    var brailleRaw = String((page && page.braille) || '');
    var brailleText = norm(brailleRaw);
    var brailleHex = brailleRaw.toLowerCase();
    var score = 0;
    var fields = [];
    if (q && label && label.indexOf(q) !== -1) { score += 20; fields.push('page-label'); }
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (label && label.indexOf(t) !== -1) { score += 12; if (fields.indexOf('page-label') === -1) fields.push('page-label'); }
      if (desc && desc.indexOf(t) !== -1) { score += 6; if (fields.indexOf('desc') === -1) fields.push('desc'); }
      if (brailleText && brailleText.indexOf(t) !== -1) {
        score += 3; if (fields.indexOf('braille') === -1) fields.push('braille');
      } else if (brailleHex && t.length >= 3 && /^[0-9a-f]+$/.test(t) && brailleHex.indexOf(t) !== -1) {
        score += 1; if (fields.indexOf('braille') === -1) fields.push('braille');
      }
    }
    return { score: score, fields: fields };
  }

  // Pick the highest-scoring page; ties resolve to the lowest page index
  // (deterministic). Returns page-level score + fields for the chosen page.
  function bestPage(graphic, q, tokens) {
    var pages = (graphic && graphic.pages) || [];
    var bestIdx = 0, best = { score: 0, fields: [] };
    for (var i = 0; i < pages.length; i++) {
      var ps = scorePage(pages[i], q, tokens);
      if (ps.score > best.score) { best = ps; bestIdx = i; }
    }
    return { index: bestIdx, score: best.score, fields: best.fields };
  }

  // ── strict record scoring (title / tags / category + best page) ─────────
  function scoreRecord(graphic, q, tokens) {
    var title = norm(graphic.title);
    var tags = (graphic.tags || []).map(norm);
    var syn = (CATEGORY_SYNONYMS[graphic.category] || []).map(norm);
    var category = norm(graphic.category);
    var score = 0;
    var fields = [];
    var matchedTags = [];

    // whole-query, exact-first record matches
    if (q && title === q) { score += 200; fields.push('title-exact'); }
    else if (q && title.indexOf(q) !== -1) { score += 100; fields.push('title'); }
    if (q && tags.indexOf(q) !== -1) { score += 120; fields.push('tag-exact'); }
    if (q && (category === q || syn.indexOf(q) !== -1)) { score += 90; fields.push('category'); }
    else if (q && (includesEither(category, q) || syn.some(function (s) { return includesEither(s, q); }))) {
      score += 80; fields.push('category');
    }

    // token-level
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (title.indexOf(t) !== -1) { score += 25; if (fields.indexOf('title') === -1 && fields.indexOf('title-exact') === -1) fields.push('title'); }
      for (var j = 0; j < tags.length; j++) {
        var tag = tags[j];
        if (tag === t) { score += 40; matchedTags.push(graphic.tags[j]); if (fields.indexOf('tag') === -1 && fields.indexOf('tag-exact') === -1) fields.push('tag'); }
        else if (includesEither(tag, t)) { score += 18; matchedTags.push(graphic.tags[j]); if (fields.indexOf('tag') === -1 && fields.indexOf('tag-exact') === -1) fields.push('tag'); }
      }
      for (var k = 0; k < syn.length; k++) {
        if (includesEither(syn[k], t)) { score += 8; if (fields.indexOf('category') === -1) fields.push('category'); break; }
      }
    }

    // whole-query exact tag → make sure it's reported in matchedTags
    if (q && tags.indexOf(q) !== -1) {
      var qi = tags.indexOf(q);
      if (matchedTags.indexOf(graphic.tags[qi]) === -1) matchedTags.push(graphic.tags[qi]);
    }

    // page-level (lower weight); also determines which page to seed
    var bp = bestPage(graphic, q, tokens);
    score += bp.score;
    for (var f = 0; f < bp.fields.length; f++) if (fields.indexOf(bp.fields[f]) === -1) fields.push(bp.fields[f]);

    // de-dup matchedTags preserving order
    var seen = {}, uniqTags = [];
    for (var m = 0; m < matchedTags.length; m++) { if (!seen[matchedTags[m]]) { seen[matchedTags[m]] = 1; uniqTags.push(matchedTags[m]); } }

    return { score: score, fields: fields, matchedTags: uniqTags, pageIndex: bp.index };
  }

  // Build the clean, Stage-3-friendly result object for one hit.
  function toResult(graphic, s) {
    var pages = graphic.pages || [];
    var page = pages[s.pageIndex] || pages[0] || {};
    var graphicHex = page.graphic || page.data || ''; // `graphic` is the page HEX field; `data` kept as a fallback
    return {
      id: graphic.id,
      title: graphic.title,
      category: graphic.category,
      lang: graphic.lang,
      spec: graphic.spec,
      matchedTags: s.matchedTags,
      pageIndex: s.pageIndex,
      pageNumber: typeof page.page === 'number' ? page.page : s.pageIndex + 1,
      pageCount: pages.length,
      pageLabel: page.label || '',
      graphic: graphicHex,
      score: s.score,
      confident: isConfident(s.fields),
      reason: primaryField(s.fields),
      matchedFields: s.fields,
    };
  }

  // ── public: strict search ───────────────────────────────────────────────
  function searchCorpus(query, options) {
    options = options || {};
    var limit = typeof options.limit === 'number' ? options.limit : DEFAULT_LIMIT;
    var minScore = typeof options.minScore === 'number' ? options.minScore : 1;
    var q = norm(query);
    if (!q) return [];
    var tokens = expandQuery(q, tokenize(q));
    var corpus = getCorpus();
    var scored = [];
    for (var i = 0; i < corpus.length; i++) {
      var s = scoreRecord(corpus[i], q, tokens);
      if (s.score >= minScore) scored.push({ order: i, result: toResult(corpus[i], s) });
    }
    // deterministic: score desc, then original corpus order asc
    scored.sort(function (a, b) {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      return a.order - b.order;
    });
    return scored.slice(0, limit).map(function (x) { return x.result; });
  }

  // ── public: near-match suggestions (miss path) ──────────────────────────
  // Looser bidirectional token match across title/tags/synonyms/labels/desc,
  // excluding anything already returned as a strict hit. Feeds Stage 3's "no
  // confident match" branch so the UI never shows a bare empty state.
  // Light, deterministic fuzzy token match for the miss path only: equal, or a
  // shared prefix of ≥3 chars (e.g. "행성"/"행성계", "planet"/"planets"). No edit
  // distance / no ML — just enough to surface near suggestions.
  function isNearToken(a, b) {
    if (!a || !b || a.length < 3 || b.length < 3) return false;
    if (a === b) return true;
    var n = Math.min(a.length, b.length), pre = 0;
    while (pre < n && a.charAt(pre) === b.charAt(pre)) pre++;
    return pre >= 3;
  }

  // Tokenized haystack for the near/miss path. Tokenizing (vs. matching raw
  // strings) avoids incidental substring hits inside long desc text — e.g. a
  // short query token landing inside an unrelated sentence. `braille` is excluded
  // (opaque HEX → pure noise). De-duped for determinism.
  function looseHaystackTokens(graphic) {
    var strings = [norm(graphic.title)]
      .concat((graphic.tags || []).map(norm))
      .concat((CATEGORY_SYNONYMS[graphic.category] || []).map(norm))
      .concat((graphic.pages || []).map(function (p) { return norm(p.label); }))
      .concat((graphic.pages || []).map(function (p) { return norm(p.desc); }))
      .filter(Boolean);
    var seen = {}, out = [];
    for (var i = 0; i < strings.length; i++) {
      var parts = tokenize(strings[i]);
      for (var j = 0; j < parts.length; j++) if (!seen[parts[j]]) { seen[parts[j]] = 1; out.push(parts[j]); }
    }
    return out;
  }

  function scoreLoose(graphic, tokens) {
    var hay = looseHaystackTokens(graphic);
    var score = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.length < 2) continue;
      for (var j = 0; j < hay.length; j++) {
        var h = hay[j];
        if (h === t) { score += 4; break; }                       // whole-token hit
        if (h.length >= 2 && includesEither(h, t)) { score += 3; break; } // token/substring overlap (both ≥2)
        if (isNearToken(t, h)) { score += 2; break; }             // light fuzzy
      }
    }
    return score;
  }

  function nearMatches(query, options) {
    options = options || {};
    var limit = typeof options.limit === 'number' ? options.limit : NEAR_LIMIT;
    var q = norm(query);
    if (!q) return [];
    var tokens = expandQuery(q, tokenize(q));
    // Exclude only CONFIDENT strict hits (title/tag/category). Weak hits that
    // matched page desc/label/braille alone are NOT confident, so they remain
    // eligible as near suggestions — this is the "no confident match" branch.
    var confident = {};
    searchCorpus(query, { limit: 100 }).forEach(function (r) { if (r.confident) confident[r.id] = true; });
    var corpus = getCorpus();
    var scored = [];
    for (var i = 0; i < corpus.length; i++) {
      if (confident[corpus[i].id]) continue;
      var sc = scoreLoose(corpus[i], tokens);
      if (sc > 0) {
        var bp = bestPage(corpus[i], q, tokens);
        scored.push({ order: i, result: toResult(corpus[i], { score: sc, fields: ['near'], matchedTags: [], pageIndex: bp.index }) });
      }
    }
    scored.sort(function (a, b) {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      return a.order - b.order;
    });
    return scored.slice(0, limit).map(function (x) { return x.result; });
  }

  if (typeof window !== 'undefined') {
    window.normalizeCorpusQuery = normalizeCorpusQuery;
    window.searchCorpus = searchCorpus;
    window.nearMatches = nearMatches;
  }
})();
