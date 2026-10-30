import { useRef, useState } from 'react'
import { Mic } from 'lucide-react'

type SpeechRecognitionCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Text field with a mic button that appends speech-to-text into the value.
 * Transcript stays fully editable afterwards. Uses the browser Web Speech API
 * (Chrome/Edge/Safari); the button is hidden where unsupported.
 */
export function DictationField({ value, onChange, placeholder, rows, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null)
  const supported = typeof window !== 'undefined' && getRecognitionCtor() !== null

  const toggle = () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new Ctor()
    recognitionRef.current = rec
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? '').join(' ').trim()
      if (transcript) onChange(value ? `${value} ${transcript}` : transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }

  const micButton = supported && (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Stop dictation' : 'Dictate'}
      className={`absolute right-2 ${rows && rows > 1 ? 'top-2' : 'top-1/2 -translate-y-1/2'} p-1.5 rounded-md transition-colors ${
        listening ? 'text-clinical-error bg-clinical-error/10 animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Mic className="w-4 h-4" />
    </button>
  )

  return (
    <div className="relative">
      {rows && rows > 1 ? (
        <textarea
          className={`form-input pr-9 ${className ?? ''}`}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={`form-input pr-9 ${className ?? ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {micButton}
    </div>
  )
}
