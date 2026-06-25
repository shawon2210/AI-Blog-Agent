# BlogForge — Design System & Architecture

## 1. Pages Overview

Single-page application (SPA). No routing — everything lives in `App.jsx` with state-driven views.

### States
| State | Trigger | What renders |
|---|---|---|
| **Empty** | `!blogPost && !loading && !error` | Empty state illustration + feature cards grid |
| **Loading** | `loading === true` | Streaming indicator, pulsing dot, shimmer border on output |
| **Streaming** | `loading && blogPost.length > 0` | Blog output rendered incrementally with blinking cursor |
| **Model Fallback** | `modelInfo?.fallback` | Orange warning banner, model label updates |
| **Error** | `error !== null` | Red error box with message |
| **Success** | `blogPost.length > 0 && !loading` | Full rendered markdown + meta bar (word count, reading time, model badge, copy) |
| **Cached** | `modelInfo?.cached === true` | Green "⚡ Cached" badge (served from LRU, no API call) |

---

## 2. Layout Architecture

```
┌─────────────────────────────────────────────────────┐
│  Header (56px)                                       │
│  ├── Brand Icon + "BlogForge"                        │
│  └── Status Badge (keys available / total)           │
├────────────────────────┬────────────────────────────┤
│                        │                             │
│  Panel: Input          │  Panel: Output              │
│  (420px fixed)         │  (fluid, 1fr)               │
│                        │                             │
│  ┌─────────────────┐   │  ┌────────────────────────┐ │
│  │ Panel Header     │   │  │ Panel Header + Meta    │ │
│  │ "Compose"        │   │  │ (word count, read time)│ │
│  └─────────────────┘   │  └────────────────────────┘ │
│  ┌─────────────────┐   │  ┌────────────────────────┐ │
│  │ Textarea + icon  │   │  │ Toolbar (model badge,  │ │
│  │ Generate button  │   │  │  copy button)          │ │
│  └─────────────────┘   │  └────────────────────────┘ │
│  ┌─────────────────┐   │  ┌────────────────────────┐ │
│  │ Topic ideas      │   │  │ Blog Output (markdown) │ │
│  │ (collapsible)    │   │  │ - scrollable (65vh)   │ │
│  └─────────────────┘   │  │ - rendered HTML        │ │
│  ┌─────────────────┐   │  └────────────────────────┘ │
│  │ Message/Error    │   │                             │
│  └─────────────────┘   │                             │
│  ┌─────────────────┐   │                             │
│  │ Features Grid   │   │                             │
│  │ (empty state)   │   │                             │
│  └─────────────────┘   │                             │
├────────────────────────┴────────────────────────────┤
│  Footer (center, small text)                        │
└─────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Layout | Changes |
|---|---|---|
| **> 900px** | Side-by-side grid | Input 420px, output 1fr |
| **≤ 900px** (tablet) | Single column stack | Input on top, output below. Divider between them. Paddings reduce 24→16px. Output max-height 50vh. |
| **≤ 480px** (mobile) | Compact single column | Paddings 12px. Smaller font sizes. Smaller buttons. Output max-height 45vh. Footer wraps. |

---

## 3. Color System

### Design Tokens (`:root` in App.css)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#08090b` | Page background (near-black) |
| `--bg-elevated` | `#0e1015` | Card / input / output surface |
| `--bg-card` | `#13161e` | Feature cards, badges |
| `--border` | `#1e2230` | Default borders |
| `--border-hover` | `#2a3040` | Hover state borders |
| `--text` | `#e8edf5` | Primary text (off-white) |
| `--text-secondary` | `#8b95a8` | Secondary text, labels |
| `--text-muted` | `#5b6478` | Muted / placeholder text |
| `--accent` | `#6c5ce7` | Purple — primary brand color |
| `--accent-light` | `#a29bfe` | Lighter purple — h2, badges |
| `--accent-glow` | `rgba(108,92,231,0.15)` | Glow/shadow effects |
| `--green` | `#00cec9` | Success / online state |
| `--green-glow` | `rgba(0,206,201,0.12)` | Green glow |
| `--red` | `#ff6b6b` | Errors |
| `--radius` | `12px` | Default border-radius |
| `--radius-sm` | `8px` | Small border-radius |

### Background Effects (layered)
1. **Mesh gradient glow** — 3 radial gradients at fixed positions (20% 30%, 80% 20%, 50% 80%) with low opacity purple/teal
2. **Grid overlay** — 60px × 60px grid lines in `--border` color, masked with radial gradient fade from center
3. **Blurred header** — `rgba(8,9,11,0.8)` with `backdrop-filter: blur(16px)`
4. **Blurred footer** — `rgba(8,9,11,0.6)` with `backdrop-filter: blur(8px)`

---

## 4. Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Body | `Inter` | `0.9rem` (14.4px) | 400 |
| Brand name | `Inter` | `1rem` | 700 |
| Panel title | `Inter` | `0.75rem` uppercase | 600 |
| h1 (output) | `Inter` | `1.5rem` | 700 |
| h2 (output) | `Inter` | `1.2rem` | 600 |
| h3 (output) | `Inter` | `1.05rem` | 600 |
| Code | `JetBrains Mono` | `0.82em` | — |
| Button | `Inter` | `0.85rem` | 600 |
| Feature title | `Inter` | `0.82rem` | 600 |
| Feature desc | `Inter` | `0.75rem` | 400 |
| Badges | `Inter` | `0.7rem` | 600 |
| Footer | `Inter` | `0.72rem` | 400 |
| Topic ideas | `Inter` | `0.78rem` | 400 |
| Messages | `Inter` | `0.8rem` | 400 |

Loaded from Google Fonts: `Inter:300..700` + `JetBrains Mono:400..600`

---

## 5. Component Tree

```
<App>
├── .bg-glow (fixed background layer)
├── .bg-grid (fixed background layer)
├── .header
│   ├── .brand
│   │   ├── .brand-icon ✦
│   │   └── .brand-name "BlogForge"
│   └── .header-right
│       └── .status-badge
│           ├── .status-dot (online/offline)
│           └── "{keysAvail}/{keysTotal} keys"
├── .main-layout (grid 2-col / 1-col mobile)
│   ├── .panel.panel-input
│   │   ├── .panel-header
│   │   │   ├── .panel-title "Compose"
│   │   │   └── .panel-subtitle
│   │   ├── .input-area
│   │   │   ├── .input-wrapper
│   │   │   │   ├── .input-icon ✍️
│   │   │   │   └── textarea.topic-input
│   │   │   └── .input-actions
│   │   │       └── button.btn (.btn-primary | .btn-cancel)
│   │   │           ├── .btn-glow (hover effect)
│   │   │           ├── .btn-ring (loading spinner)
│   │   │           └── .btn-content
│   │   │               └── svg.btn-arrow
│   │   ├── .examples-section
│   │   │   ├── .examples-toggle
│   │   │   │   ├── "💡 Topic ideas"
│   │   │   │   └── svg.chevron
│   │   │   └── .examples-list
│   │   │       └── button.example-chip × N
│   │   ├── .message-area
│   │   │   ├── .msg.msg-info (loading)
│   │   │   │   └── .msg-dot
│   │   │   └── .msg.msg-error
│   │   └── .features-grid (empty state only)
│   │       └── .feature-card × 4
│   │           ├── .feature-icon
│   │           └── div
│   │               ├── .feature-title
│   │               └── .feature-desc
│   └── .panel.panel-output
│       ├── .panel-header
│       │   ├── .panel-title "Output"
│       │   └── .output-meta (when blogPost)
│       │       ├── .meta-item "{wordCount} words"
│       │       ├── .meta-divider
│       │       └── .meta-item "{readTime} min read"
│       └── .output-area
│           ├── .empty-state (when no content)
│           │   ├── .empty-icon 📄
│           │   ├── .empty-title
│           │   └── .empty-desc
│           ├── .output-toolbar (when blogPost)
│           │   ├── .model-badge (.cached variant)
│           │   └── .toolbar-actions
│           │       └── .toolbar-btn (Copy)
│           ├── .blog-output (.streaming variant)
│           │   └── (rendered HTML from parseMarkdown)
│           └── .cursor-blink (when loading)
└── .footer
    ├── "BlogForge — AI Blog Agent"
    ├── .footer-divider
    ├── "v1.1.0"
    ├── .footer-divider
    └── .footer-status "{keysAvail}/{keysTotal} keys online"
```

---

## 6. Styling Patterns

### Glassmorphism
- Header: `background: rgba(8,9,11,0.8) + backdrop-filter: blur(16px)`
- Footer: `background: rgba(8,9,11,0.6) + backdrop-filter: blur(8px)`

### Gradient Elements
- Brand icon: `linear-gradient(135deg, var(--accent), var(--accent-light))`
- Primary button: `linear-gradient(135deg, var(--accent), #8b5cf6)` + box-shadow glow
- Button glow sweep: pseudo-element that translates X on hover

### Card Style
- Background: `var(--bg-card)` or `var(--bg-elevated)`
- Border: `1px solid var(--border)` → `var(--border-hover)` on hover
- Border-radius: `var(--radius)` (12px) or `var(--radius-sm)` (8px)
- Subtle hover transitions on border-color

### Interactive States
| Element | Rest | Hover | Active | Disabled |
|---|---|---|---|---|
| Primary btn | Gradient + shadow | `translateY(-1px)`, stronger shadow | `translateY(0)` | `opacity: 0.35` |
| Cancel btn | `--bg-card` + `--border` | Border + text lighten | — | — |
| Topic chip | `--bg-card` + `--border` | Purple border + glow bg | — | — |
| Input | `--bg-elevated` + `--border` | — | Focus: purple ring | `opacity: 0.5` |

### Loading Animation
- Button spinner: 14px ring with `border-top-color: accent-light`, `animation: spin 0.7s`
- Info dot: 6px dot with `animation: pulse 1.5s ease-in-out` (opacity 1→0.3→1)
- Blinking cursor: `▊` with `animation: blink 1s step-end infinite`
- Output border: pulses with `border-color: var(--accent)` + `box-shadow`

### Markdown Rendering
- Custom `parseMarkdown()` function using regex replacements
- Proper heading hierarchy (h1→h3) with distinct sizing
- Blockquotes: left purple border + italic + card background
- Code: monospace font, subtle background/border
- Lists: proper indentation with `padding-left: 1.4em`

---

## 7. Data Flow

```
User types topic → state.topic
User clicks "Generate Post" → handleGenerate()
  ├── Sets loading=true, clears error/blogPost
  ├── Creates AbortController (for cancel)
  ├── POST /generate/stream with { topic }
  ├── Reads response.body via ReadableStream
  │   └── For each SSE chunk:
  │       ├── "chunk" → append to blogPost (live render)
  │       ├── "done" → set modelInfo, loading=false
  │       ├── "model_fallback" → set modelInfo.fallback
  │       └── "error" → throw
  ├── On AbortError → silently return
  └── On error → set error state
```

### State Dependencies
```
topic → generate button enabled/disabled
loading → input disabled, button toggles (Generate ↔ Cancel)
blogPost → output visibility + word count + reading time
modelInfo → badge display + fallback warning
healthInfo → status badge + footer key count
error → error message box
showExamples → topic ideas collapsible
copied → copy button text toggles "📋 Copy" / "✅ Copied"
```

---

## 8. Responsive Strategy

### Grid Breakpoints
```css
/* Desktop (>900px) */
.main-layout { grid-template-columns: 420px 1fr; }

/* Tablet (≤900px) */
.main-layout { grid-template-columns: 1fr; }

/* Mobile (≤480px) */
/* Reduced paddings, font sizes, output height */
```

### Key Responsive Behaviors
1. **Input panel** shifts from fixed 420px sidebar to full-width top section
2. **Border** moves from right-side to bottom between panels
3. **Output max-height** reduces: 65vh → 50vh → 45vh
4. **Typography** scales down at 480px (h1: 1.5→1.3rem, h2: 1.2→1.05rem)
5. **Footer** wraps to multi-line on mobile
6. **Feature grid** stays 1 column (already responsive)

---

## 9. Enhancement Opportunities

### Suggested Next Improvements
| Area | Suggestion |
|---|---|
| **Dark/Light mode** | Add theme toggle using CSS custom properties swap |
| **History** | Save past generations in localStorage with timestamps |
| **Export** | Download as .md file, or copy as HTML |
| **Settings panel** | Model preference, temperature, max tokens, tone selector |
| **Skeleton loader** | Replace pulsing dot with content-aware skeleton |
| **Toast system** | Add toast notifications for copy success, errors |
| **Keyboard shortcuts** | Cmd+Enter to generate, Cmd+C to copy |
| **Accessibility** | Add focus trap, proper aria-labels, skip-to-content |
| **Animations** | Entry animations via framer-motion for output appearance |
| **Multi-language** | i18n for topic suggestions and UI text |
| **Image generation** | Add cover image via DALL-E / Stable Diffusion |
| **SEO preview** | Show how the post looks in search results (meta title/desc) |

### Performance Notes
- No external dependencies beyond React (no router, no animation lib)
- Custom markdown parser (no `react-markdown` dependency — keeps bundle small)
- SSE streaming prevents blocking while generating
- AbortController allows clean cancellation
- Backend LRU cache means repeated topics skip API entirely
