"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';
import GoogleGeminiLogo from '@/components/google-gemini-logo';

export const AI_PROVIDERS = [
  {
    company: 'Google',
    logo: GoogleGeminiLogo,
    source: 'user_key', // This provider requires a user-provided API key
    value: 'google_gemini', // Added value for provider identification
    models: [ // These are fallback/example models, actual models will come from user keys
      // Removed Gemini 1.5 models as requested
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      // Add public API models for Gemini here
      { value: 'gemini-pro', label: 'Gemini Pro (API Pública)' },
      { value: 'gemini-pro-vision', label: 'Gemini Pro Vision (API Pública)' },
    ],
  },
  {
    company: 'Anthropic (Puter.js)',
    logo: ClaudeAILogo,
    source: 'puter', // This provider uses the integrated Puter.js service
    value: 'anthropic_claude', // Added value for provider identification
    models: [
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4', label: 'Claude Opus 4' },
      { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet' },
      { value: 'claude-3-7-opus', label: 'Claude 3.7 Opus' },
    ],
  },
];

export const getModelLabel = (modelValue?: string): string => {
    if (!modelValue) return '';

    // Handle new format: puter:model-name or user_key:key-id
    let actualModelValue = modelValue;
    if (modelValue.startsWith('puter:')) {
      actualModelValue = modelValue.substring(6);
    } else if (modelValue.startsWith('user_key:')) {
      // For user_key, we can't get the exact model label without fetching the key details.
      // For now, return a generic label or the key ID.
      return `Clave de Usuario (${modelValue.substring(9, 17)}...)`;
    }

    for (const provider of AI_PROVIDERS) {
        const model = provider.models.find(m => m.value === actualModelValue);
        if (model) return model.label;
    }
    return actualModelValue;
};