import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — shadcn-style className utility.
 * Merges Tailwind classes with full conflict resolution (twMerge)
 * and conditional/array/object class support (clsx).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
