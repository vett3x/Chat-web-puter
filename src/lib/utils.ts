import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a memory string (e.g., "239Mi", "4.0Gi") into its value in MiB.
 * @param memString The memory string to parse.
 * @returns The memory value in MiB, or 0 if parsing fails.
 */
export function parseMemoryString(memString: string): number {
  const match = memString.match(/^([0-9.]+)([KMGT]?iB|[KMGT]?B)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'KiB':
    case 'KB': return value / 1024; // Convert to MiB
    case 'MiB':
    case 'MB': return value;
    case 'GiB':
    case 'GB': return value * 1024; // Convert to MiB
    case 'TiB':
    case 'TB': return value * 1024 * 1024; // Convert to MiB
    default: return value; // Assume MiB if no unit or unknown
  }
}

/**
 * Parses a data size string (e.g., "1.23kB", "5.6MiB") into its value in bytes.
 * Handles binary prefixes (KiB, MiB) and decimal-like prefixes (KB, MB).
 * @param sizeString The data size string to parse.
 * @returns The data size value in bytes, or 0 if parsing fails.
 */
export function parseDataSizeToBytes(sizeString: string): number {
  if (!sizeString || typeof sizeString !== 'string') return 0;
  const match = sizeString.trim().match(/^([0-9.]+)\s*([KMGT]?i?B)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  if (unit.includes('K')) return value * 1024;
  if (unit.includes('M')) return value * 1024 * 1024;
  if (unit.includes('G')) return value * 1024 * 1024 * 1024;
  if (unit.includes('T')) return value * 1024 * 1024 * 1024 * 1024;
  
  return value; // Assumes bytes if no unit or unknown
}


/**
 * Formats a memory value in MiB to a human-readable string (e.g., "1024 MiB" or "1.0 GiB").
 * @param mib The memory value in MiB.
 * @returns Formatted string.
 */
export function formatMemory(mib: number): string {
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  return `${(mib / 1024).toFixed(1)} GiB`;
}

/**
 * Generates a random port number in the IANA registered ephemeral port range (49152-65535).
 * @returns A random port number.
 */
export function generateRandomPort(): number {
  const minPort = 49152;
  const maxPort = 65535;
  return Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
}

// Define unified part types for internal API handling
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image_url'; image_url: { url: string }; }
interface CodePart { type: 'code'; language?: string; filename?: string; code?: string; }
export type RenderablePart = TextPart | ImagePart | CodePart;

// New, more robust regex to capture the entire info line after ```
const codeBlockRegex = /```(\w+)?(?::([\w./-]+))?\n([\s\S]*?)\n```/g;

export function parseAiResponseToRenderableParts(content: string, isAppChat: boolean): RenderablePart[] {
  const parts: RenderablePart[] = [];
  let lastIndex = 0;
  let match;
  codeBlockRegex.lastIndex = 0; // Reset regex lastIndex for repeated calls

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Capture text before the code block
    if (match.index > lastIndex) {
      const textPart = content.substring(lastIndex, match.index).trim();
      if (textPart) parts.push({ type: 'text', text: textPart });
    }
    
    const infoLine = (match[1] || '').trim(); // Language part
    const filenameFromRegex = (match[2] || '').trim(); // Filename part from regex
    const codeContent = (match[3] || '').trim();
    let language = infoLine;
    let filename = filenameFromRegex;

    const part: RenderablePart = {
      type: 'code',
      language: language,
      filename: filename,
      code: codeContent,
    };

    // Only attempt to extract filename from code content if it's an app chat
    // and filename wasn't already explicitly provided in the ```info:filename``` format
    if (isAppChat && !part.filename && part.code) {
      const lines = part.code.split('\n');
      const firstLine = lines[0].trim();
      // Regex to find common file path comments like //path/to/file.js or #path/to/file.py
      const pathRegex = /^(?:\/\/|#|\/\*|\*)\s*([\w./-]+\.[a-zA-Z]+)\s*\*?\/?$/;
      const pathMatch = firstLine.match(pathRegex);
      if (pathMatch && pathMatch[1]) {
        part.filename = pathMatch[1];
        part.code = lines.slice(1).join('\n').trim(); // Remove the first line from code content
      }
    }

    parts.push(part);
    lastIndex = match.index + match[0].length;
  }

  // Capture any remaining text after the last code block
  if (lastIndex < content.length) {
    const textPart = content.substring(lastIndex).trim();
    if (textPart) parts.push({ type: 'text', text: textPart });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
}