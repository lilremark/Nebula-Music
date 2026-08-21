export interface CatalogModel {
  id: string;
  label: string;
}

export interface ProviderCatalogEntry {
  id: string;
  label: string;
  baseUrl: string;
  models: CatalogModel[];
}

/**
 * Curated LLM provider catalog for the AI DJ. Every entry speaks OpenAI-compatible
 * chat/completions. Local providers (Ollama, LM Studio) and Custom allow any
 * base URL. 2-3 models per provider keep the picker focused without hiding
 * flagship/value/small options.
 */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (cheap, default)' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (fast)' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheap)' },
      { id: 'gpt-4o', label: 'GPT-4o (flagship)' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (fast)' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite (cheap)' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini via OpenRouter' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet via OpenRouter' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash via OpenRouter' },
    ],
  },
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-2-1212', label: 'Grok 2' },
      { id: 'grok-2-mini', label: 'Grok 2 mini' },
      { id: 'grok-beta', label: 'Grok Beta' },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral-small-latest', label: 'Mistral Small (cheap)' },
      { id: 'open-mistral-nemo', label: 'Mistral Nemo' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
      { id: 'deepseek-coder', label: 'DeepSeek Coder' },
    ],
  },
  {
    id: 'together',
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Instruct Turbo' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Instruct Turbo' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B Instruct' },
    ],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    models: [
      { id: 'command-r-plus', label: 'Command R+ (flagship)' },
      { id: 'command-r', label: 'Command R' },
      { id: 'command-light', label: 'Command Light (fast)' },
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', label: 'Llama 3.1 70B Instruct' },
      { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
      { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', label: 'Mixtral 8x7B Instruct' },
    ],
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: [
      { id: 'llama3.1-70b', label: 'Llama 3.1 70B' },
      { id: 'llama3.1-8b', label: 'Llama 3.1 8B (fast)' },
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B Instruct' },
      { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
      { id: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B Instruct' },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3.2', label: 'Llama 3.2 (local)' },
      { id: 'mistral', label: 'Mistral (local)' },
      { id: 'gemma2', label: 'Gemma 2 (local)' },
    ],
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    models: [
      { id: 'local-model', label: 'Local Model (LM Studio)' },
      { id: 'llama-3.2-3b', label: 'Llama 3.2 3B' },
      { id: 'mistral-7b', label: 'Mistral 7B' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    models: [],
  },
];

export const DEFAULT_AI_PROVIDER = 'groq';
export const DEFAULT_AI_MODEL = 'openai/gpt-oss-20b';
export const DEFAULT_AI_BASE_URL = 'https://api.groq.com/openai/v1';

export const getProviderById = (id: string): ProviderCatalogEntry | undefined =>
  PROVIDER_CATALOG.find((p) => p.id === id);

export const getModelsForProvider = (id: string): CatalogModel[] =>
  getProviderById(id)?.models ?? [];

export const getBaseUrlForProvider = (id: string): string | undefined =>
  getProviderById(id)?.baseUrl;

export const isCustomProvider = (id: string): boolean => id === 'custom';
