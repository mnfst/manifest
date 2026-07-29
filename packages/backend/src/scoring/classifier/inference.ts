/**
 * Smart-router classifier runtime — zero-dependency TypeScript reimplementation
 * of the trained sklearn model:
 *   shared FeatureUnion(word TF-IDF 1-2gram, char_wb TF-IDF 3-5gram)
 *   -> three LogisticRegression heads (difficulty, reasoning, category)
 *
 * The text is vectorized ONCE per request; each head is a sparse dot product.
 * Loads `model.v3.json` (see export-model-v3.py). Numeric parity with sklearn
 * is pinned by fixtures.json / parity.test.ts.
 */
import { type ChatRequest, serializeRequest } from './serialize';

interface VectorizerJson {
  ngram: [number, number];
  vocab: Record<string, number>;
  idf: number[];
}

interface HeadJson {
  classes?: string[];
  binary?: boolean;
  regression?: boolean;
  transform?: 'log1p';
  intercept: number[];
  coef: Array<Array<[number, number]>>;
}

export interface ModelJson {
  version: string;
  nWord: number;
  word: VectorizerJson;
  char: VectorizerJson;
  heads: Record<string, HeadJson>;
}

export interface HeadResult {
  label: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface Classification {
  difficulty: HeadResult;
  reasoning: HeadResult;
  category: HeadResult;
  /** Predicted output tokens for this request (log-space Ridge head). */
  expectedOutputTokens: number;
}

const WORD_TOKEN = /[\p{L}\p{N}_]{2,}/gu;

/** sklearn TfidfVectorizer word analyzer: lowercase + \b\w\w+\b + n-grams. */
function wordTerms(text: string, [minN, maxN]: [number, number]): string[] {
  const tokens = text.toLowerCase().match(WORD_TOKEN) ?? [];
  const out: string[] = [];
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      out.push(n === 1 ? tokens[i] : tokens.slice(i, i + n).join(' '));
    }
  }
  return out;
}

/** sklearn char_wb analyzer: per-word " w " padding, sliding char n-grams. */
function charWbTerms(text: string, [minN, maxN]: [number, number]): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const raw of words) {
    const w = ' ' + raw + ' ';
    const wLen = w.length;
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      out.push(w.slice(offset, offset + n));
      while (offset + n < wLen) {
        offset += 1;
        out.push(w.slice(offset, offset + n));
      }
      if (offset === 0) break; // word shorter than n: count once, skip larger n
    }
  }
  return out;
}

/** tf (sublinear) * idf, l2-normalized per block; appends to sparse vec. */
function vectorize(
  terms: string[],
  vec: VectorizerJson,
  indexOffset: number,
  outIdx: number[],
  outVal: number[],
): void {
  const counts = new Map<number, number>();
  for (const t of terms) {
    const idx = vec.vocab[t];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  if (!counts.size) return;
  const start = outVal.length;
  let sumSq = 0;
  for (const [idx, c] of counts) {
    const v = (1 + Math.log(c)) * vec.idf[idx];
    outIdx.push(indexOffset + idx);
    outVal.push(v);
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = start; i < outVal.length; i++) outVal[i] /= norm;
}

class Head {
  private readonly json: HeadJson;
  private readonly dense: Float64Array[];

  constructor(json: HeadJson, nFeatures: number) {
    this.json = json;
    this.dense = json.coef.map((entries) => {
      const row = new Float64Array(nFeatures);
      for (const [idx, w] of entries) row[idx] = w;
      return row;
    });
  }

  /** Raw linear scores per output row (logits, or the regression value). */
  linear(featIdx: number[], featVal: number[]): number[] {
    const z = this.json.intercept.slice();
    for (let c = 0; c < this.dense.length; c++) {
      const row = this.dense[c];
      let s = z[c];
      for (let i = 0; i < featIdx.length; i++) s += row[featIdx[i]] * featVal[i];
      z[c] = s;
    }
    return z;
  }

  predictValue(featIdx: number[], featVal: number[]): number {
    const v = this.linear(featIdx, featVal)[0];
    return this.json.transform === 'log1p' ? Math.expm1(v) : v;
  }

  score(featIdx: number[], featVal: number[]): HeadResult {
    const { json } = this;
    const z = this.linear(featIdx, featVal);

    let probs: number[];
    if (json.binary) {
      const p1 = 1 / (1 + Math.exp(-z[0]));
      probs = [1 - p1, p1];
    } else {
      const m = Math.max(...z);
      const exps = z.map((x) => Math.exp(x - m));
      const s = exps.reduce((a, b) => a + b, 0);
      probs = exps.map((e) => e / s);
    }

    const classes = json.classes ?? [];
    let best = 0;
    const scores: Record<string, number> = {};
    for (let i = 0; i < classes.length; i++) {
      scores[classes[i]] = probs[i];
      if (probs[i] > probs[best]) best = i;
    }
    return { label: classes[best], confidence: probs[best], scores };
  }
}

export class SmartRouterModel {
  private readonly model: ModelJson;
  private readonly heads: Record<string, Head> = {};

  constructor(model: ModelJson) {
    this.model = model;
    const nFeatures = model.nWord + model.char.idf.length;
    for (const [name, json] of Object.entries(model.heads)) {
      this.heads[name] = new Head(json, nFeatures);
    }
  }

  /** Classify a pre-serialized text (see serializeRequest). */
  classifySerialized(serialized: string): Classification {
    const { model } = this;
    const featIdx: number[] = [];
    const featVal: number[] = [];
    vectorize(wordTerms(serialized, model.word.ngram), model.word, 0, featIdx, featVal);
    vectorize(charWbTerms(serialized, model.char.ngram), model.char, model.nWord, featIdx, featVal);
    return {
      difficulty: this.heads.difficulty.score(featIdx, featVal),
      reasoning: this.heads.reasoning.score(featIdx, featVal),
      category: this.heads.category.score(featIdx, featVal),
      expectedOutputTokens: this.heads.output_tokens
        ? this.heads.output_tokens.predictValue(featIdx, featVal)
        : 0,
    } as Classification;
  }

  /** Classify a raw OpenAI-style chat request. */
  classify(request: ChatRequest): Classification {
    return this.classifySerialized(serializeRequest(request));
  }

  /**
   * Confidence gate: returns the label when confidence clears the threshold,
   * null otherwise (caller falls back to the default route and should log the
   * request for dataset enrichment).
   */
  static gate(result: HeadResult, threshold: number): string | null {
    return result.confidence >= threshold ? result.label : null;
  }
}
