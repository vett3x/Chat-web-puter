"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';
import GoogleGeminiLogo from '@/components/google-gemini-logo';

export const AI_PROVIDERS = [
  {
    company: 'Google',
    logo: GoogleGeminiLogo,
    source: 'user_key', // This provider requires a user-provided API key
    models: [
      { value: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Experimental)' },
    ],
  },
  {
    company: 'Anthropic (Puter.js)',
    logo: ClaudeAILogo,
    source: 'puter', // This provider uses the integrated Puter.js service
    models: [
      { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
    ],
  },
];

export const getModelLabel = (modelValue?: string): string => {
    if (!modelValue) return '';
    for (const provider of AI_PROVIDERS) {
        const model = provider.models.find(m => m.value === modelValue);
        if (model) return model.label;
    }
    return modelValue;
};