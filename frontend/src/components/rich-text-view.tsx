import DOMPurify from 'dompurify'
import 'react-quill-new/dist/quill.snow.css'
import { cn } from '@/lib/utils'

/** Read-only render of HTML produced by RichTextEditor (Quill). Reuses Quill's own `.ql-editor` styles for headings/lists/etc, sanitized to strip any script/event-handler content before injecting. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return <div className={cn('ql-editor !p-0', className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}
