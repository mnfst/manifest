import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Tier } from '../types';
import { SmartRouterModel, type ModelJson } from './inference';
import type { ChatRequest } from './serialize';

/**
 * Below this difficulty confidence the classifier abstains: the caller routes
 * to the default tier instead of committing to a tier the model is unsure of.
 */
export const MIN_DIFFICULTY_CONFIDENCE = 0.6;

/**
 * A `hard` request is promoted to the reasoning tier only when the (separate)
 * reasoning head is near-certain. Reasoning models are the expensive end of the
 * ladder, so the bar sits well above the difficulty gate.
 */
export const MIN_REASONING_CONFIDENCE = 0.9;

/** Gzipped model asset, copied next to the compiled service by nest-cli assets. */
const MODEL_FILENAME = 'model.v3.json.gz';

const DIFFICULTY_TO_TIER: Record<string, Tier> = {
  simple: 'simple',
  standard: 'standard',
  hard: 'complex',
};

export interface ClassifierInput {
  messages: unknown[];
  tools?: unknown[];
  tool_choice?: unknown;
  max_tokens?: number;
}

export interface ClassifiedTier {
  tier: Tier;
  confidence: number;
}

/**
 * Trained request classifier (TF-IDF + logistic heads) behind
 * `SMART_CLASSIFIER_ENABLED`. Off by default: the flag has to be set for the
 * 3.4 MB model to be read at all, so an unset env is zero cost and zero
 * behavior change.
 */
@Injectable()
export class ClassifierService implements OnModuleInit {
  private readonly logger = new Logger(ClassifierService.name);
  private model: SmartRouterModel | null = null;

  isEnabled(): boolean {
    const flag = process.env.SMART_CLASSIFIER_ENABLED;
    return flag === '1' || flag === 'true';
  }

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('Smart classifier disabled (SMART_CLASSIFIER_ENABLED) — model not loaded');
      return;
    }
    const startedAt = Date.now();
    this.loadModel(readFileSync(join(__dirname, MODEL_FILENAME)));
    this.logger.log(`Smart classifier model loaded in ${Date.now() - startedAt}ms`);
  }

  loadModel(buffer: Buffer): void {
    const json = JSON.parse(gunzipSync(buffer).toString('utf8')) as ModelJson;
    this.model = new SmartRouterModel(json);
  }

  /**
   * Classify a request into a routing tier. Returns null when the classifier
   * has nothing to say — no model loaded, difficulty below the confidence
   * gate, or a label outside the trained set — and the caller should fall back
   * to default routing.
   */
  classifyTier(input: ClassifierInput): ClassifiedTier | null {
    if (!this.model) return null;

    const { difficulty, reasoning } = this.model.classify({
      model: 'auto',
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.tool_choice,
      max_tokens: input.max_tokens,
    } as ChatRequest);

    if (difficulty.confidence < MIN_DIFFICULTY_CONFIDENCE) return null;

    if (
      difficulty.label === 'hard' &&
      reasoning.label === 'True' &&
      reasoning.confidence >= MIN_REASONING_CONFIDENCE
    ) {
      return { tier: 'reasoning', confidence: difficulty.confidence };
    }

    const tier = DIFFICULTY_TO_TIER[difficulty.label];
    return tier ? { tier, confidence: difficulty.confidence } : null;
  }
}
