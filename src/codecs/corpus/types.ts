// src/codecs/corpus/types.ts
//
// Types matching the shipped corpus.js bundle (window.DTMS_CORPUS) exactly.
// Corpus data itself is NOT duplicated here or anywhere in src/ — hosts
// supply the array (e.g. by loading the real corpus.js and reading
// window.DTMS_CORPUS) to the search functions in corpus-search.ts.

export interface CorpusPage {
  page: number;
  label: string;
  desc?: string;
  braille?: string;
  graphic?: string; // DTMS hex
  data?: string;    // legacy fallback field, some records use this instead of `graphic`
  narration?: string;
  audio?: { src: string; mime?: string; bytes?: number; durationSec?: number };
}

export interface CorpusGraphicFeatures {
  dotpadCompatible?: boolean;
  dotpadOptimized?: boolean;
  embossable?: boolean;
}

export interface CorpusRecord {
  id: string;
  title: string;
  spec: string;
  lang: string;
  category: string;
  tags: string[];
  pages: CorpusPage[];
  graphicFeatures?: CorpusGraphicFeatures;
}

export interface CorpusSearchOptions {
  limit?: number;
  minScore?: number;
  features?: string[];
}

export interface CorpusSearchResult {
  id: string;
  title: string;
  category: string;
  lang: string;
  spec: string;
  graphicFeatures: CorpusGraphicFeatures | null;
  matchedTags: string[];
  pageIndex: number;
  pageNumber: number;
  pageCount: number;
  pageLabel: string;
  graphic: string;
  score: number;
  confident: boolean;
  reason: string;
  matchedFields: string[];
}

export interface CorpusFeatureCounts {
  dotpadCompatible: number;
  dotpadOptimized: number;
  embossable: number;
  total: number;
}
