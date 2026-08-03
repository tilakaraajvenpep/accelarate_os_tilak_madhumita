import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

const TOOLBAR_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  return <ReactQuill theme="snow" value={value} onChange={onChange} placeholder={placeholder} modules={TOOLBAR_MODULES} />
}
