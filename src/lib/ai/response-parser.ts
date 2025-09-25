import { MessageContentPart } from '@/types/chat';

export type RenderablePart = Extract<MessageContentPart, { type: 'text' | 'code' }>;

const codeBlockRegex = /```(\w+)?(?::([\w./-]+))?\s*\n([\s\S]*?)\s*```/g;

export function parseAiResponseToRenderableParts(content: string): RenderablePart[] {
  const parts: RenderablePart[] = [];
  let lastIndex = 0;
  let match;
  codeBlockRegex.lastIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textPart = content.substring(lastIndex, match.index).trim();
      if (textPart) parts.push({ type: 'text', text: textPart });
    }
    
    const part: RenderablePart = {
      type: 'code',
      language: match[1] || '',
      filename: match[2],
      code: (match[3] || '').trim(),
    };

    if (!part.filename && part.code) {
      const lines = part.code.split('\n');
      const firstLine = lines[0].trim();
      const pathRegex = /^(?:\/\/|#|\/\*|\*)\s*([\w./-]+\.[a-zA-Z]+)\s*\*?\/?$/;
      const pathMatch = firstLine.match(pathRegex);
      if (pathMatch && pathMatch[1]) {
        part.filename = pathMatch[1];
        part.code = lines.slice(1).join('\n').trim();
      }
    }

    parts.push(part);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textPart = content.substring(lastIndex).trim();
    if (textPart) parts.push({ type: 'text', text: textPart });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
}