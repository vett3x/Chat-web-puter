"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';
import GoogleGeminiLogo from '@/components/google-gemini-logo';
import { KeyRound } from 'lucide-react'; // Import a generic icon for custom endpoint

export const AI_PROVIDERS = [
  {
    company: 'Google',
    logo: GoogleGeminiLogo,
    source: 'user_key',
    value: 'google_gemini',
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
    source: 'puter',
    value: 'anthropic_claude',
    models: [
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', apiType: 'puter' },
      { value: 'claude-opus-4', label: 'Claude Opus 4', apiType: 'puter' },
      { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet', apiType: 'puter' },
      { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus', apiType: 'puter' },
    ],
  },
  {
    company: 'Endpoint Personalizado', // New provider
    logo: KeyRound, // Generic icon
    source: 'user_key',
    value: 'custom_endpoint',
    models: [], // User defines model_name
  },
];

export const getModelLabel = (modelValue?: string, userApiKeys: { id: string; provider: string; model_name: string | null; nickname: string | null }[] = []): string => {
    if (!modelValue) return '';

    if (modelValue.startsWith('user_key:')) {
        const keyId = modelValue.substring(9);
        const key = userApiKeys.find(k => k.id === keyId);
        if (key) {
            if (key.provider === 'custom_endpoint') {
                return key.nickname || `Endpoint Personalizado (${keyId.substring(0, 8)}...)`;
            }
            // For other user_key providers, use model_name if available, else nickname
            if (key.model_name) {
                for (const provider of AI_PROVIDERS) {
                    if (provider.value === key.provider) {
                        const model = provider.models.find(m => m.value === key.model_name);
                        if (model) return model.label;
                    }
                }
                return key.model_name; // Fallback to raw model name
            }
            return key.nickname || `Clave de Usuario (${keyId.substring(0, 8)}...)`;
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