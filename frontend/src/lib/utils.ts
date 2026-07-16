import type { SyntheticEvent } from 'react'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Native date/time inputs normally only open their picker when you hit the
 * small calendar icon — this opens it on any click/focus anywhere in the field. */
export function openPicker(e: SyntheticEvent<HTMLInputElement>) {
  const input = e.currentTarget
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    } catch {
      // ignore — e.g. browser blocks it outside a user gesture
    }
  }
}
