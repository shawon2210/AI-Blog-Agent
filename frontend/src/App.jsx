import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

const FEATURES = [
  { icon: 'bolt', title: 'SEO Optimized', desc: 'Semantic keyword injection for ranking.', color: 'text-primary' },
  { icon: 'record_voice_over', title: 'Brand Voice', desc: 'Consistent tonal alignment engine.', color: 'text-secondary' },
  { icon: 'search_insights', title: 'Instant Research', desc: 'Web-augmented factual accuracy.', color: 'text-tertiary' },
  { icon: 'layers', title: 'Multi-model', desc: 'Ensemble processing for quality.', color: 'text-primary-fixed-dim' },
]

const EXAMPLES = [
  'The Future of AI in Healthcare',
  'How to Build a Micro-SaaS in 2026',
  'Zero-Knowledge Proofs Explained Simply',
  'Why Rust is the Next Big Thing in Web Development',
]

const TOPIC_TAGS = ['#technology', '#lifestyle', '#marketing']

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

function App() {
  const [topic, setTopic] = useState('')
  const [blogPost, setBlogPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)
  const [healthInfo, setHealthInfo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ai_blog_agent_api_key') || '')
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('ai_blog_agent_model') || 'gemini-2.0-flash')
  const [showApiSettings, setShowApiSettings] = useState(false)
  const [keySaved, setKeySaved] = useState(!!localStorage.getItem('ai_blog_agent_api_key'))
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('ai_blog_agent_api_key', apiKey)
    setKeySaved(!!apiKey)
  }, [apiKey])

  useEffect(() => {
    localStorage.setItem('ai_blog_agent_model', selectedModel)
  }, [selectedModel])

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setHealthInfo(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [blogPost])

  useEffect(() => {
    if (!loading) { setLoadingTimeout(false); return }
    const t = setTimeout(() => setLoadingTimeout(true), 15000)
    return () => clearTimeout(t)
  }, [loading])

  const handleGenerate = useCallback(async () => {
    const trimmed = topic.trim()
    if (!trimmed) {
      setError('Please enter a topic')
      return
    }

    setLoading(true)
    setError(null)
    setBlogPost('')
    setModelInfo(null)
    setShowExamples(false)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmed,
          ...(apiKey ? { api_key: apiKey } : {}),
          ...(apiKey ? { model: selectedModel } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Server error (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

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
                fullText += data.text
                setBlogPost(fullText)
                break
              case 'done':
                setModelInfo({ model: data.model_used, cached: data.model_used === 'cache' })
                setLoading(false)
                break
              case 'model_fallback':
                setModelInfo({ fallback: true, from: data.model, to: data.next })
                break
              case 'error':
                throw new Error(data.error)
            }
          } catch (e) {
            if (e.message !== 'error') console.warn('SSE parse:', e)
          }
        }
      }
      setLoading(p => { if (p) return false; return p })
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Failed to connect')
      setLoading(false)
    }
  }, [topic, apiKey, selectedModel])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blogPost)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleExampleClick = useCallback((ex) => {
    setTopic(ex)
    setShowExamples(false)
    inputRef.current?.focus()
  }, [])

  const keysAvail = healthInfo?.keys?.available ?? 0
  const keysTotal = healthInfo?.keys?.total ?? 0
  const wordCount = countWords(blogPost)
  const readTime = estimateReadingTime(wordCount)
  const hasContent = !!blogPost
  const isGenerating = loading && !blogPost

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ─── Ambient Background ─────────────────────────── */}
      <div className="mesh-gradient">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-container rounded-full" />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-tertiary-container rounded-full" />
      </div>
      <div className="fixed inset-0 grid-overlay pointer-events-none z-0" />

      {/* ─── Header ─────────────────────────────────────── */}
      <header className="fixed top-0 w-full h-[56px] z-50 glass-header border-b border-outline-variant/20 flex items-center justify-between px-lg">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-white text-sm font-bold shadow-lg flex-shrink-0">
            B
          </div>
          <span className="hidden sm:inline text-headline-md font-bold text-primary">BlogForge</span>
        </div>
        <nav className="hidden md:flex items-center gap-lg">
          <a className="text-secondary font-bold text-label-md" href="#">Compose</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors px-sm py-1 rounded text-label-md" href="#">History</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors px-sm py-1 rounded text-label-md" href="#">Templates</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors px-sm py-1 rounded text-label-md" href="#">Settings</a>
        </nav>
        <div className="flex items-center gap-md">
          <button className="p-xs text-primary-fixed-dim hover:bg-surface-variant/40 transition-colors rounded-full active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">key</span>
          </button>
          {healthInfo && (
            <div className="flex items-center gap-1.5 text-label-sm text-outline px-2 py-1 rounded-full bg-surface-container-lowest border border-outline-variant/30" title={`${keysAvail}/${keysTotal} keys available`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthInfo.status === 'ok' ? 'bg-secondary shadow-[0_0_8px_rgba(76,215,246,0.35)]' : 'bg-error'}`} />
              <span className="hidden sm:inline">{keysAvail}/{keysTotal} keys</span>
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
          </div>
        </div>
      </header>

      {/* ─── Main Layout ────────────────────────────────── */}
      <main className="pt-[56px] pb-[32px] min-h-screen flex flex-col lg:flex-row relative z-10">
        {/* ─── Left Panel: Compose ──────────────────────── */}
        <aside className="w-full lg:w-[420px] lg:fixed lg:left-0 lg:top-[56px] lg:h-[calc(100vh-56px-32px)] border-r border-outline-variant/15 bg-surface-container-low/60 backdrop-blur-md p-md lg:p-lg flex flex-col gap-lg overflow-y-auto">
          <div className="flex flex-col gap-xs">
            <h2 className="text-primary font-bold text-[0.75rem] uppercase tracking-widest">Compose</h2>
            <p className="text-on-surface-variant text-label-sm opacity-80">AI Writing Suite</p>
          </div>

          <div className="flex flex-col gap-md">
            <div className="relative group">
              <label className="text-label-md text-outline mb-xs block">Topic Ideas</label>
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your blog post topic or paste some rough notes..."
                  disabled={loading}
                  rows={4}
                  className="w-full h-40 bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-md pr-10 text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all resize-none font-body-md disabled:opacity-50"
                />
                <span className="absolute top-3 right-3 material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-[20px]">edit_note</span>
              </div>
            </div>

            {loading ? (
              <button
                onClick={handleCancel}
                className="w-full py-md rounded-xl flex items-center justify-center gap-sm text-on-surface font-bold transition-all bg-surface-container border border-outline-variant/30 hover:border-outline-variant/60 hover:text-white"
              >
                <span className="w-3.5 h-3.5 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!topic.trim()}
                className="primary-gradient-btn w-full py-md rounded-xl flex items-center justify-center gap-sm text-white font-bold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Generate Post
              </button>
            )}
          </div>

          {/* API Settings */}
          <div className="border-t border-outline-variant/15 pt-md">
            <button
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="flex items-center gap-1.5 text-[0.8rem] text-on-surface-variant bg-transparent border-none cursor-pointer px-0 py-1 font-body-md transition-colors hover:text-on-surface w-full"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>API Settings</span>
              {apiKey && <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(76,215,246,0.35)] ml-auto" />}
              <svg className={`w-3 h-3 transition-transform ml-1 ${showApiSettings ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showApiSettings && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Google API key"
                    className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 pr-9 text-label-md text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all font-body-md placeholder:text-outline/60"
                  />
                  {apiKey && (
                    <button
                      onClick={() => setApiKey('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors bg-transparent border-none cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-label-md text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all font-body-md"
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span className={`text-label-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${apiKey ? 'bg-secondary/15 text-secondary' : 'bg-surface-container-high text-outline'}`}>
                    {apiKey && <span className="w-1 h-1 rounded-full bg-secondary" />}
                    {apiKey ? (keySaved ? 'Saved' : 'Unsaved') : 'Server key'}
                  </span>
                </div>
                <p className="text-[10px] text-outline/70 leading-tight">
                  Provide your own Google AI Studio API key. If empty, server-configured keys are used.
                </p>
              </div>
            )}
          </div>

          {/* Example topics */}
          <div>
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center gap-1.5 text-[0.8rem] text-on-surface-variant bg-transparent border-none cursor-pointer px-0 py-1 font-body-md transition-colors hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">lightbulb</span>
              Topic ideas
              <svg className={`w-3 h-3 transition-transform ${showExamples ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showExamples && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(ex)}
                    className="text-[0.78rem] px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant cursor-pointer font-body-md transition-all hover:border-primary hover:text-primary hover:bg-primary/10"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex flex-col gap-1 px-3 py-2 rounded-lg text-[0.8rem] bg-error-container/20 border border-error/20 text-error">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span className="font-bold">Generation failed</span>
              </div>
              <p className="text-label-sm opacity-90 break-words">
                {error.length > 200 ? error.slice(0, 200) + '...' : error}
              </p>
              {error.includes('429') || error.includes('RESOURCE_EXHAUSTED') ? (
                <p className="text-[10px] mt-1 opacity-70">
                  Your API key quota is exhausted. Try a different key, wait for daily reset, or enable billing at aistudio.google.com.
                </p>
              ) : null}
              {error.includes('503') || error.includes('UNAVAILABLE') ? (
                <p className="text-[10px] mt-1 opacity-70">
                  The model is temporarily unavailable due to high demand. Please try again in a few minutes or select a different model.
                </p>
              ) : null}
            </div>
          )}

          {/* Loading/fallback status */}
          {loading && modelInfo?.fallback && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[0.8rem] bg-primary/10 border border-primary/20 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Switching model...
            </div>
          )}

          {/* Features grid (shown when no content yet) */}
          {!hasContent && !loading && !error && (
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-md pt-md border-t border-outline-variant/15">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="bg-surface-container/40 p-md rounded-xl card-hover"
                >
                  <span className={`material-symbols-outlined text-[22px] ${f.color} mb-xs block`}>{f.icon}</span>
                  <h3 className="text-label-md font-bold text-on-surface block mb-1">{f.title}</h3>
                  <p className="text-[11px] text-on-surface-variant leading-tight opacity-90">{f.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Status footer */}
          <div className="mt-auto pt-lg flex flex-col gap-xs">
            <div className="flex items-center gap-xs">
              <div className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse shadow-[0_0_6px_rgba(172,237,255,0.3)]" />
              <span className="text-label-sm text-secondary">Forge AI active</span>
            </div>
            <p className="text-[10px] text-outline opacity-80 uppercase tracking-tighter">v4.2.0 Engine &bull; Ready for prompt</p>
          </div>
        </aside>

        {/* ─── Right Panel: Output ──────────────────────── */}
        <section className="flex-1 lg:ml-[420px] p-md md:p-lg lg:p-2xl min-h-[calc(100vh-56px)] flex flex-col">
          <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
            <header className="flex justify-between items-end mb-xl">
              <div>
                <h1 className="text-[30px] sm:text-[40px] font-bold sm:font-headline-lg text-white mb-2 leading-tight">Output</h1>
                <div className="flex flex-wrap gap-x-md gap-y-1">
                  <span className="text-label-md text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    {wordCount} words
                  </span>
                  <span className="text-label-md text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    {readTime} min read
                  </span>
                </div>
              </div>

              {/* Toolbar (visible when content exists) */}
              {hasContent && (
                <div className="flex gap-sm bg-surface-container-high p-1 rounded-xl border border-outline-variant/30 flex-wrap">
                  <button
                    onClick={handleCopy}
                    className="p-xs hover:bg-surface-variant transition-colors rounded text-on-surface-variant hover:text-white active:scale-[0.98]"
                    title="Copy to clipboard"
                  >
                    <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                  </button>
                  {modelInfo && (
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[0.65rem] font-bold tracking-wide ${
                      modelInfo.cached
                        ? 'bg-secondary-container/15 border border-secondary-container/25 text-secondary'
                        : 'bg-primary/10 border border-primary/20 text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">{modelInfo.cached ? 'cached' : 'model_training'}</span>
                      {modelInfo.cached ? 'Cached' : (modelInfo.model?.split('/').pop() || 'AI')}
                    </span>
                  )}
                </div>
              )}
            </header>

            {/* Editor Canvas */}
            <div className="flex-1 rounded-xl sm:rounded-2xl bg-surface-container-lowest/60 border border-outline-variant/10 backdrop-blur-[8px] relative flex flex-col items-center justify-center overflow-hidden p-lg md:p-xl">
              <div className="absolute inset-0 grid-overlay opacity-30 pointer-events-none" />

              {/* Empty State */}
              {!hasContent && !isGenerating && (
                <div className="text-center flex flex-col items-center gap-md relative z-10">
                  <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-surface-container-high/60 flex items-center justify-center border border-outline-variant/25 mb-md shadow-xl">
                    <span className="material-symbols-outlined text-[30px] sm:text-[40px] text-outline/40">auto_fix_high</span>
                  </div>
                  <h3 className="text-[20px] sm:text-headline-md text-on-surface">Your masterpiece starts here</h3>
                  <p className="text-on-surface-variant max-w-sm font-body-md opacity-90">
                    Fill in your topic ideas on the left and click 'Generate' to forge your next viral blog post with high-precision AI.
                  </p>
                  <div className="mt-xl flex flex-wrap justify-center gap-md">
                    {TOPIC_TAGS.map((tag, i) => (
                      <div key={i} className="px-md py-sm bg-surface-container border border-outline-variant/20 rounded-full text-label-md text-secondary/80">
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state (no content yet) */}
              {isGenerating && (
                <div className="text-center flex flex-col items-center gap-md relative z-10">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="material-symbols-outlined text-[28px] text-primary animate-spin">progress_activity</span>
                  </div>
                  <h3 className="text-headline-md text-primary">Forging content...</h3>
                  <p className="text-on-surface-variant text-sm opacity-80">
                    {loadingTimeout
                      ? 'Still working — AI generation can take up to a minute'
                      : 'Our AI is crafting a publication-ready article'}
                  </p>
                  {loadingTimeout && (
                    <p className="text-label-sm text-primary/60 animate-pulse">
                      If it takes too long, check that your API key has available quota
                    </p>
                  )}
                </div>
              )}

              {/* Output Content */}
              {hasContent && (
                <div className="w-full h-full relative z-10 flex flex-col">
                  <div
                    ref={outputRef}
                    className={`blog-output ${loading ? 'streaming' : ''}`}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(blogPost) }}
                  />
                  {loading && <span className="text-primary text-base animate-pulse ml-1 mt-1">▊</span>}
                </div>
              )}
            </div>

            <div className="mt-lg flex items-center justify-between text-label-sm sm:text-label-md text-outline opacity-80 px-sm sm:px-md">
              <span className="truncate mr-2">Press {navigator.platform?.includes('Mac') ? 'CMD' : 'Ctrl'} + G</span>
              <span className="flex-shrink-0">Auto-save: <span className="text-secondary">Enabled</span></span>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className="fixed bottom-0 w-full h-[32px] z-40 glass-header border-t border-outline-variant/15 flex items-center justify-between px-md lg:px-lg">
        <div className="flex items-center gap-sm lg:gap-md min-w-0">
          <span className="text-[10px] sm:text-label-sm font-bold text-secondary truncate">v1.0.4 - All Systems Operational</span>
        </div>
        <div className="flex gap-sm lg:gap-md flex-shrink-0">
          <a className="text-label-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Status</a>
          <a className="text-label-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Documentation</a>
          <a className="text-label-sm text-on-surface-variant hover:text-primary transition-colors" href="#">API</a>
        </div>
      </footer>
    </div>
  )
}

export default App
