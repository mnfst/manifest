/**
 * Manual pricing reference for niche providers not available in OpenRouter.
 * Kept minimal — only providers whose models can't be priced automatically.
 */
export const MANUAL_PRICING: ReadonlyMap<
  string,
  { input: number; output: number; provider: string }
> = new Map([
  // Z.ai (Zhipu)
  ['glm-5', { input: 0.000005, output: 0.000005, provider: 'Z.ai' }],
  ['glm-4.7', { input: 0.000002, output: 0.000002, provider: 'Z.ai' }],
  ['glm-4.7-flash', { input: 0.0000005, output: 0.0000005, provider: 'Z.ai' }],
  ['glm-4.6', { input: 0.000001, output: 0.000001, provider: 'Z.ai' }],
  ['glm-4.6v', { input: 0.000001, output: 0.000001, provider: 'Z.ai' }],
  ['glm-4.5', { input: 0.000001, output: 0.000001, provider: 'Z.ai' }],
  ['glm-4.5-air', { input: 0.0000005, output: 0.0000005, provider: 'Z.ai' }],
  ['glm-4.5-flash', { input: 0.0000001, output: 0.0000001, provider: 'Z.ai' }],

  // Moonshot / Kimi
  ['kimi-k2', { input: 0.000002, output: 0.000006, provider: 'Moonshot' }],
  ['moonshot-v1-128k', { input: 0.00006, output: 0.00006, provider: 'Moonshot' }],
  ['moonshot-v1-32k', { input: 0.000024, output: 0.000024, provider: 'Moonshot' }],
  ['moonshot-v1-8k', { input: 0.000012, output: 0.000012, provider: 'Moonshot' }],

  // MiniMax
  ['MiniMax-M2.5', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],
  ['MiniMax-M2.5-highspeed', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],
  ['MiniMax-M2.1', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],
  ['MiniMax-M2.1-highspeed', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],
  ['MiniMax-M2', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],
  ['MiniMax-M1', { input: 0.000001, output: 0.000004, provider: 'MiniMax' }],

  // Alibaba / Qwen
  ['qwen3-235b-a22b', { input: 0.0000008, output: 0.000002, provider: 'Alibaba' }],
  ['qwen3-32b', { input: 0.0000004, output: 0.0000012, provider: 'Alibaba' }],
  ['qwen3-14b', { input: 0.0000002, output: 0.0000006, provider: 'Alibaba' }],
  ['qwen3-8b', { input: 0.0000002, output: 0.0000006, provider: 'Alibaba' }],
  ['qwen3-4b', { input: 0.0000001, output: 0.0000003, provider: 'Alibaba' }],
  ['qwen3-1.7b', { input: 0.00000005, output: 0.00000015, provider: 'Alibaba' }],
  ['qwen3-0.6b', { input: 0.00000005, output: 0.00000015, provider: 'Alibaba' }],
  ['qwen2.5-72b-instruct', { input: 0.0000008, output: 0.000002, provider: 'Alibaba' }],
  ['qwen2.5-32b-instruct', { input: 0.0000004, output: 0.0000012, provider: 'Alibaba' }],
  ['qwen2.5-coder-32b-instruct', { input: 0.0000004, output: 0.0000012, provider: 'Alibaba' }],
  ['qwq-32b', { input: 0.0000004, output: 0.0000012, provider: 'Alibaba' }],
]);
