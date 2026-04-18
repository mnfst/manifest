export interface ProviderMetadata {
  /** Path to self-hosted icon, e.g. '/icons/cohere.svg' */
  logo: string;
  /** Override the display name from GitHub data.json */
  displayName?: string;
  /** Bullet-point tags shown under the provider name */
  tags: string[];
  /** Yellow warning banner text */
  warning: string;
}

/**
 * UI-specific metadata keyed by the exact `name` from GitHub data.json.
 * baseUrl and model IDs come from GitHub — this map only holds
 * display/UX fields that don't belong in the shared data source.
 */
export const PROVIDER_METADATA: Readonly<Record<string, ProviderMetadata>> = {
  Cerebras: {
    logo: '/icons/cerebras.svg',
    tags: ['Fast inference', 'No credit card required'],
    warning: '',
  },
  'Cloudflare Workers AI': {
    logo: '/icons/workersai.svg',
    tags: ['10,000 neurons/day free', 'No credit card required'],
    warning: '',
  },
  Cohere: {
    logo: '/icons/cohere.svg',
    tags: ['Up to 1,000 calls/month', 'No credit card required'],
    warning:
      'Trial keys cannot be used for production or commercial workloads. Data may be used for training.',
  },
  'GitHub Models': {
    logo: '/icons/github.svg',
    tags: ['Rate-limited free tier', 'No credit card required'],
    warning: '',
  },
  'Google Gemini': {
    logo: '/icons/gemini.svg',
    tags: ['250K TPM (Tokens / Minute) shared across models', 'No credit card required'],
    warning:
      'Rate limits apply per Google Cloud project, not per API key. On the free tier, prompts and responses may be used to improve Google products.',
  },
  Groq: {
    logo: '/icons/groq.svg',
    tags: ['Fast inference', 'No credit card required'],
    warning: '',
  },
  'Hugging Face': {
    logo: '/icons/huggingface.svg',
    tags: ['Serverless Inference API', 'No credit card required'],
    warning: '',
  },
  'Kilo Code': {
    logo: '/icons/kilocode.jpg',
    tags: ['No credit card required'],
    warning: 'Prompts and outputs are logged on free models to improve provider products.',
  },
  'LLM7.io': {
    logo: '',
    tags: ['No credit card required'],
    warning: '',
  },
  'Mistral AI': {
    logo: '/icons/providers/mistral.svg',
    tags: ['No credit card required'],
    warning: '',
  },
  'NVIDIA NIM': {
    logo: '/icons/nvidia.svg',
    tags: ['1,000 free credits', 'No credit card required'],
    warning: '',
  },
  'Ollama Cloud': {
    logo: '/icons/ollama.svg',
    tags: ['No credit card required'],
    warning: '',
  },
  OpenRouter: {
    logo: '/icons/openrouter.svg',
    tags: ['Free tier models available', 'No credit card required'],
    warning: '',
  },
  SiliconFlow: {
    logo: '/icons/siliconflow.svg',
    tags: ['No credit card required'],
    warning: '',
  },
  'Z AI (Zhipu AI)': {
    logo: '/icons/zai.svg',
    displayName: 'Z AI',
    tags: ['No credit card required'],
    warning: '',
  },
};
