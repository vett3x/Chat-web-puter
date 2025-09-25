// Define unified part types
export interface TextPart { type: 'text'; text: string; }
export interface ImagePart { type: 'image_url'; image_url: { url: string }; }
export interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; }
export type MessageContentPart = TextPart | ImagePart | CodePart;

export interface Message {
  id: string;
  conversation_id?: string;
  content: string | MessageContentPart[];
  role: 'user' | 'assistant';
  model?: string;
  timestamp: Date;
  isNew?: boolean;
  isTyping?: boolean;
  type?: 'text' | 'multimodal';
  isConstructionPlan?: boolean;
  planApproved?: boolean;
  isCorrectionPlan?: boolean;
  correctionApproved?: boolean;
}

export type AutoFixStatus = 'idle' | 'analyzing' | 'plan_ready' | 'fixing' | 'failed';