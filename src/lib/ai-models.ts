"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';
import GoogleGeminiLogo from '@/components/google-gemini-logo';
import { KeyRound } from 'lucide-react';

export const AI_PROVIDERS = [
  {
    company: 'Google',
    providerKey: 'google_gemini',
    logo: GoogleGeminiLogo,
    source: 'user_key',
    models: [
      { value: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Experimental)' },
    ],
  },
  {
    company: 'Custom OpenAI API',
    providerKey: 'custom_openai',
    logo: KeyRound,
    source: 'user_key',
    models: [], // Models are defined by the user in the key config
  },
  {
    company: 'Anthropic (Puter.js)',
    providerKey: 'puter_claude',
    logo: ClaudeAILogo,
    source: 'puter',
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