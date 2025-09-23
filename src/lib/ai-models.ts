"use client";

import ClaudeAILogo from '@/components/claude-ai-logo';

export const AI_PROVIDERS = [
  {
    company: 'Anthropic',
    logo: ClaudeAILogo,
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
    for (const provider of AI_PROVIDERS) {
        const model = provider.models.find(m => m.value === modelValue);
        if (model) return model.label;
    }
    return modelValue;
};