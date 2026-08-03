import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, X, Send, Mic, MicOff, Sparkles, Bot, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useChat } from '@/context/chat-context'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Only the last N messages are sent as conversational context, to keep the request payload small.
const HISTORY_LIMIT = 10

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

export function AiChatWidget() {
  const { t } = useTranslation('aiChat')
  const { isOpen, toggleChat, closeChat } = useChat()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('greeting') },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isOpen])

  // Voice input via the Web Speech API — not available in every browser, so the mic button no-ops with a toast if unsupported.
  useEffect(() => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
      .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new (SpeechRecognition as any)()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
  }, [])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error(t('toast.voiceUnsupported'))
      return
    }
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInput('')
      recognitionRef.current.start()
      setIsListening(true)
      toast.info(t('toast.listening'))
    }
  }, [isListening, t])

  async function handleSend() {
    const message = input.trim()
    if (!message || isLoading) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }

    const history = messages.slice(-HISTORY_LIMIT)
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setInput('')
    setIsLoading(true)

    try {
      const { data } = await api.post<{ response: string }>('/api/ai-chat', { message, history })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      const isOutOfCredits = (err as { response?: { status?: number } })?.response?.status === 402
      const errorMessage = apiError(err, t('errors.requestFailed'))
      toast.error(errorMessage)
      setMessages((prev) => [...prev, { role: 'assistant', content: isOutOfCredits ? errorMessage : t('errors.chatFallback') }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleChat}
        aria-label={t('header.toggleAriaLabel')}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeChat}
      />

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{t('header.title')}</h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('header.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={closeChat}
            aria-label={t('common:close')}
            title={t('common:close')}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn('flex items-start gap-4', msg.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-md',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary ring-1 ring-primary/20',
                )}
              >
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl border px-4 py-3.5 text-sm leading-relaxed',
                  msg.role === 'user' ? 'rounded-tr-sm bg-primary/10 border-primary/10' : 'rounded-tl-sm bg-muted/60 border-transparent',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border bg-muted/60 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '-0.3s' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '-0.15s' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t p-6">
          <div className="flex items-center rounded-2xl border bg-muted/40 p-2 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={isListening ? t('input.placeholderListening') : t('input.placeholder')}
              className="flex-1 border-none bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2 pr-1">
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading}
                title={t('input.micTitle')}
                aria-label={t('input.micTitle')}
                className={cn(
                  'rounded-xl p-2 transition-all active:scale-95',
                  isListening ? 'animate-pulse bg-destructive/20 text-destructive hover:bg-destructive/30' : 'text-muted-foreground hover:bg-muted hover:text-primary',
                )}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                aria-label={t('input.sendAriaLabel')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-all active:scale-95',
                  isLoading || !input.trim() ? 'cursor-not-allowed bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
