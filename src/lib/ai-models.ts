"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';
import GoogleGeminiLogo from '@/components/google-gemini-logo';

export const AI_PROVIDERS = [
  {
    company: 'Google',
    logo: GoogleGeminiLogo,
    source: 'user_key', // This provider requires a user-provided API key
    value: 'google_gemini', // Added value for provider identification
    models: [
      // Vertex AI Models
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', apiType: 'vertex' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', apiType: 'vertex' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', apiType: 'vertex' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', apiType: 'vertex' },
      // Public API Models
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', apiType: 'public' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', apiType: 'public' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', apiType: 'public' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', apiType: 'public' },
    ],
  },
  {
    company: 'Anthropic (Puter.js)',
    logo: ClaudeAILogo,
    source: 'puter', // This provider uses the integrated Puter.js service
    value: 'anthropic_claude', // Added value for provider identification
    models: [
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', apiType: 'puter' },
      { value: 'claude-opus-4', label: 'Claude Opus 4', apiType: 'puter' },
      { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet', apiType: 'puter' },
      { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus', apiType: 'puter' },
    ],
  },
];

export const getModelLabel = (modelValue?: string, userApiKeys: { id: string; provider: string; model_name: string | null }[] = []): string => {
    if (!modelValue) return '';

    if (modelValue.startsWith('user_key:')) {
        const keyId = modelValue.substring(9);
        const key = userApiKeys.find(k => k.id === keyId);
        if (key && key.model_name) {
            for (const provider of AI_PROVIDERS) {
                if (provider.value === key.provider) {
                    const model = provider.models.find(m => m.value === key.model_name);
                    if (model) return model.label;
                }
            }
            return key.model_name; // Fallback to raw model name if no label found
        }
        return `Clave de Usuario (${keyId.substring(0, 8)}...)`;
    }

    const actualModelValue = modelValue.startsWith('puter:') ? modelValue.substring(6) : modelValue;

    for (const provider of AI_PROVIDERS) {
        const model = provider.models.find(m => m.value === actualModelValue);
        if (model) return model.label;
    }
    return actualModelValue;
};