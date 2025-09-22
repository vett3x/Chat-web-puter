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