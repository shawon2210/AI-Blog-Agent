import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

const FEATURES = [
  { icon: 'bolt', title: 'SEO', desc: 'Semantic keyword injection', color: 'text-primary' },
  { icon: 'record_voice_over', title: 'Voice', desc: 'Consistent tonal alignment', color: 'text-secondary' },
  { icon: 'search_insights', title: 'Research', desc: 'Web-augmented accuracy', color: 'text-tertiary' },
  { icon: 'layers', title: 'Multi-model', desc: 'Ensemble quality processing', color: 'text-primary-fixed-dim' },
]

const EXAMPLES = [
  'The Future of AI in Healthcare',
  'How to Build a Micro-SaaS in 2026',
  'Zero-Knowledge Proofs Explained Simply',
  'Why Rust is the Next Big Thing in Web Development',
]

function parseMarkdown(text) {
  if (!text) return ''
  let html = text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d\. (.+)$/gm, '<li>$1</li>')
    .replace(/^```(\w*)\n([\s\S]*?)```$/gm, (_, lang, code) => `<pre><code class="lang-${lang || 'none'}">${code.trim()}</code></pre>`)
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')
  return `<p>${html}</p>`
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function estimateReadingTime(words) {
  return Math.max(1, Math.round(words / 200))
}

export default function App() {
  const [topic, setTopic] = useState('')
  const [blogPost, setBlogPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showApi, setShowApi] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ak') || '')
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('am') || 'gemini-2.0-flash')
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [mobileTab, setMobileTab] = useState('compose')
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const hasContent = !!blogPost
  const isGenerating = loading && !blogPost

  useEffect(() => { localStorage.setItem('ak', apiKey) }, [apiKey])
  useEffect(() => { localStorage.setItem('am', selectedModel) }, [selectedModel])
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [blogPost])
  useEffect(() => {
    if (!loading) { setLoadingTimeout(false); return }
    const t = setTimeout(() => setLoadingTimeout(true), 15000)
    return () => clearTimeout(t)
  }, [loading])

  const handleGenerate = useCallback(async () => {
    const trimmed = topic.trim()
    if (!trimmed) { setError('Please enter a topic'); return }
    setLoading(true); setError(null); setBlogPost(''); setModelInfo(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch('/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmed,
          ...(apiKey ? { api_key: apiKey, model: selectedModel } : {}),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Server error (${response.status})`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            switch (data.type) {
              case 'chunk':
                fullText += data.text; setBlogPost(fullText)
                break
              case 'done':
                setModelInfo({ model: data.model_used, cached: data.model_used === 'cache' })
                setLoading(false)
                break
              case 'error':
                throw new Error(data.error)
            }
          } catch (e) { if (e.message !== 'error') console.warn('SSE:', e) }
        }
      }
      setLoading(p => { if (p) return false; return p })
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Failed to connect')
      setLoading(false)
    }
  }, [topic, apiKey, selectedModel])

  const handleCancel = useCallback(() => { abortRef.current?.abort(); abortRef.current = null; setLoading(false) }, [])
  const handleKeyDown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) { e.preventDefault(); handleGenerate() } }
  const handleCopy = async () => { try { await navigator.clipboard.writeText(blogPost); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }

  const wordCount = countWords(blogPost)
  const readTime = estimateReadingTime(wordCount)

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="mesh-gradient">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-container rounded-full" />
      </div>
      <div className="fixed inset-0 grid-overlay pointer-events-none z-0" />

      {/* ─── Slim Header ─────────────────────────────────── */}
      <header className="fixed top-0 w-full h-[44px] z-50 glass-header border-b border-outline-variant/15 flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-white text-xs font-bold shadow-lg flex-shrink-0">
            B
          </div>
          <span className="text-sm font-bold text-primary hidden sm:inline">BlogForge</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowApi(!showApi)}
            className={`p-1.5 rounded-lg transition-all ${showApi ? 'bg-surface-container-high text-secondary' : 'text-outline hover:text-on-surface hover:bg-surface-container-high/50'}`}
            title="API Settings"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
          </button>
          {hasContent && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high/50 transition-all"
              title="Copy"
            >
              <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Mobile Tab Bar ──────────────────────────────── */}
      <div className="lg:hidden fixed top-[44px] w-full z-40 flex border-b border-outline-variant/15 bg-surface-container-low/90 backdrop-blur-md">
        <button
          onClick={() => setMobileTab('compose')}
          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${mobileTab === 'compose' ? 'text-secondary border-b-2 border-secondary' : 'text-outline'}`}
        >Compose</button>
        <button
          onClick={() => setMobileTab('output')}
          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${mobileTab === 'output' ? 'text-secondary border-b-2 border-secondary' : 'text-outline'}`}
        >Output {hasContent ? `(${wordCount}w)` : ''}</button>
      </div>

      {/* ─── Main ────────────────────────────────────────── */}
      <main className={`pt-[44px] ${hasContent ? 'pb-0' : 'pb-[28px]'} min-h-screen flex relative z-10`}>
        {/* ─── Compose Panel ────────────────────────────── */}
        <aside className={`
          w-full lg:w-[340px] lg:fixed lg:top-[44px] lg:bottom-0
          lg:border-r border-outline-variant/15 lg:bg-surface-container-low/40 lg:backdrop-blur-md
          flex flex-col
          ${mobileTab === 'compose' ? 'flex' : 'hidden'} lg:flex
          ${hasContent ? '' : 'pb-0'}
        `}>
          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 flex flex-col gap-3">
            {/* Topic Input */}
            <div className="relative group">
              <label className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1.5 block">Topic</label>
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your blog post topic..."
                  disabled={loading}
                  rows={3}
                  className="w-full h-28 bg-surface-container-lowest border border-outline-variant/30 rounded-[10px] px-3 py-2.5 pr-9 text-sm text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all resize-none disabled:opacity-50"
                />
                <span className="absolute top-2.5 right-3 material-symbols-outlined text-outline/50 group-focus-within:text-primary/60 transition-colors text-[18px]">edit_note</span>
              </div>
            </div>

            {/* Generate Button */}
            {loading ? (
              <button
                onClick={handleCancel}
                className="w-full py-2.5 rounded-[10px] flex items-center justify-center gap-2 text-sm font-bold transition-all bg-surface-container border border-outline-variant/20 hover:border-outline-variant/40 hover:text-white"
              >
                <span className="w-3 h-3 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!topic.trim()}
                className="primary-gradient-btn w-full py-2.5 rounded-[10px] flex items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Generate
              </button>
            )}

            {/* Example Topics */}
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setTopic(ex); setMobileTab('output') }}
                  className="text-[11px] px-2 py-1 rounded-full bg-surface-container border border-outline-variant/15 text-outline hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* API Settings (expandable inline) */}
            {showApi && (
              <div className="border border-outline-variant/15 rounded-[10px] p-3 bg-surface-container-lowest/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-outline uppercase tracking-widest">API Key</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${apiKey ? 'bg-secondary/15 text-secondary' : 'text-outline'}`}>
                    {apiKey ? 'Saved' : 'None'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Google API key"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2.5 py-1.5 pr-8 text-xs text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  />
                  {apiKey && (
                    <button onClick={() => setApiKey('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors bg-transparent border-none cursor-pointer">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                >
                  {MODELS.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <p className="text-[9px] text-outline/60 leading-tight">Leave empty to use server keys. Saved in browser.</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-[10px] px-3 py-2 text-xs bg-error-container/15 border border-error/15 text-error space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[14px]">error</span> Generation failed
                </div>
                <p className="opacity-80 break-words">{error.length > 180 ? error.slice(0, 180) + '...' : error}</p>
                {(error.includes('429') || error.includes('RESOURCE_EXHAUSTED')) && (
                  <p className="opacity-60 text-[10px]">Key quota exhausted. Try a different key or wait for reset.</p>
                )}
                {(error.includes('503') || error.includes('UNAVAILABLE')) && (
                  <p className="opacity-60 text-[10px]">Model temporarily unavailable. Try again or pick a different model.</p>
                )}
              </div>
            )}

            {/* Features */}
            {!hasContent && !loading && !error && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {FEATURES.map((f, i) => (
                  <div key={i} className="bg-surface-container/30 rounded-[10px] p-2.5 card-hover">
                    <span className={`material-symbols-outlined text-[16px] ${f.color} block mb-0.5`}>{f.icon}</span>
                    <div className="text-[11px] font-bold text-on-surface">{f.title}</div>
                    <div className="text-[9px] text-outline leading-tight">{f.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading status */}
            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-primary/70">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(208,188,255,0.3)]" />
                {loadingTimeout ? 'Still working...' : 'Generating...'}
              </div>
            )}
          </div>

          {/* Slim Status */}
          <div className="hidden lg:flex h-[28px] items-center px-4 border-t border-outline-variant/10 text-[9px] text-outline/50">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse shadow-[0_0_4px_rgba(172,237,255,0.2)]" />
              Ready
            </span>
            <span className="ml-auto">{apiKey ? 'Custom key' : 'Server key'}</span>
          </div>
        </aside>

        {/* ─── Output Panel ─────────────────────────────── */}
        <section className={`
          flex-1 lg:ml-[340px] min-h-[calc(100vh-44px)] flex flex-col
          ${mobileTab === 'output' ? 'flex' : 'hidden'} lg:flex
        `}>
          <div className="flex-1 flex flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5 max-w-4xl mx-auto w-full">
            {/* Output Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-white">Output</h1>
                {hasContent && (
                  <>
                    <span className="text-[10px] text-outline/60 font-mono">{wordCount}w · {readTime}m</span>
                    {modelInfo && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${modelInfo.cached ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                        {modelInfo.cached ? 'Cached' : (modelInfo.model?.split('/').pop() || 'AI')}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/10 backdrop-blur-[6px] relative flex flex-col overflow-hidden">
              <div className="absolute inset-0 grid-overlay opacity-20 pointer-events-none" />

              {!hasContent && !isGenerating && (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high/50 flex items-center justify-center border border-outline-variant/15 mb-3">
                    <span className="material-symbols-outlined text-[22px] text-outline/30">auto_fix_high</span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface mb-1">Your masterpiece starts here</h3>
                  <p className="text-[11px] text-outline/60 max-w-xs">Enter a topic on the left and hit Generate to forge your next blog post.</p>
                </div>
              )}

              {isGenerating && (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/15 mb-3">
                    <span className="material-symbols-outlined text-[22px] text-primary animate-spin">progress_activity</span>
                  </div>
                  <h3 className="text-sm font-bold text-primary mb-1">Forging content...</h3>
                  <p className="text-[11px] text-on-surface-variant/70">
                    {loadingTimeout ? 'Still working — this can take up to a minute' : 'AI is crafting your article'}
                  </p>
                </div>
              )}

              {hasContent && (
                <div className="w-full h-full relative z-10 flex flex-col">
                  <div
                    ref={outputRef}
                    className={`blog-output ${loading ? 'streaming' : ''}`}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(blogPost) }}
                  />
                  {loading && <span className="text-primary text-sm animate-pulse ml-3 mt-1">▊</span>}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="mt-2 text-[9px] text-outline/40 text-center hidden lg:block">
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+G to generate
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
