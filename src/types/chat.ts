import { RenderablePart } from '@/lib/utils';

// The format Puter.js API expects for content arrays
export interface TextPart { type: 'text'; text: string; }
export interface ImagePart { type: 'image_url'; image_url: { url: string }; }
export type PuterContentPart = TextPart | ImagePart;

export interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | PuterContentPart[];
}

export interface Message {
  id: string;
  conversation_id?: string | null;
  content: string | RenderablePart[];
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew: boolean;
  isTyping: boolean;
  type?: 'text' | 'multimodal';
  isConstructionPlan: boolean;
  planApproved: boolean;
  isCorrectionPlan: boolean;
  correctionApproved: boolean;
  isAnimated: boolean;
}

export type AutoFixStatus = 'idle' | 'analyzing' | 'plan_ready' | 'fixing' | 'failed';