import { useState } from 'react'
import './App.css'

function App() {
  const [topic, setTopic] = useState('')
  const [blogPost, setBlogPost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setLoading(true)
    setError(null)
    setBlogPost('')

    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() })
      })

      const data = await response.json()

      if (data.status === 'success') {
        setBlogPost(data.blog_post)
      } else {
        setError(data.error || 'An unknown error occurred')
      }
    } catch (err) {
      setError('Failed to connect to the server. Make sure the backend is running on port 8080.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGenerate()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Blog Agent</h1>
        <p className="subtitle">Generate blog posts with AI</p>
      </header>

      <div className="input-section">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a blog topic..."
          className="topic-input"
          disabled={loading}
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="generate-btn"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {blogPost && (
        <div className="output-section">
          <h2>Generated Blog Post</h2>
          <pre className="blog-output">{blogPost}</pre>
        </div>
      )}
    </div>
  )
}

export default App
