import type { SyntheticEvent } from 'react'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { api } from '@/lib/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Fetches a data: URL from a "get one document" endpoint and triggers a browser download —
 * used for every base64-stored upload (cohort documents, section-form attachments). */
export async function downloadFile(fetchUrl: string, fileName: string) {
  const { data } = await api.get<{ fileData: string }>(fetchUrl)
  const link = window.document.createElement('a')
  link.href = data.fileData
  link.download = fileName
  link.click()
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
