/**
 * Core Utility Functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MutableRefObject, RefCallback } from 'react';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type RefType<T> = MutableRefObject<T | null> | RefCallback<T> | null | undefined;

/**
 * Merge multiple refs into one (for forwardRef + local ref)
 */
export function mergeRefs<T>(...refs: RefType<T>[]): RefCallback<T> {
  return (value: T | null): void => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        ref.current = value;
      }
    });
  };
}
