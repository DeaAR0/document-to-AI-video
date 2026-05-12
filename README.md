# Document to AI Video

An AI-powered platform that converts documents (PDF, DOCX, PPTX) into narrated video walkthroughs with an interactive Q&A panel and engagement analytics — powered by Google Gemini.

> **Documentation:** See `Document.docx` for the full documentation report.

---

## Features

- **Document Upload** — supports PDF, DOCX, and PPTX files
- **AI Video Generation** — Gemini parses your document and generates a structured, professor-style video lecture with narration scripts
- **Text-to-Speech Narration** — each section is read aloud using the Web Speech API
- **Interactive Q&A** — ask questions about the document and get grounded, cited answers from Gemini
- **Engagement Analytics** — tracks session stats, section completion rates, and Q&A hotspots
- **History Sidebar** — revisit previously processed documents

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Animation | Framer Motion |
| Charts | Recharts |
| State | Zustand |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Document Parsing | mammoth (DOCX), pdf-parse (PDF), officeparser (PPTX) |
| TTS | Web Speech API |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/DeaAR0/document-to-AI-video.git
cd document-to-AI-video
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your free Gemini API key at [aistudio.google.com](https://aistudio.google.com).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
app/
  page.tsx              # Upload landing page
  studio/page.tsx       # Video player with narration and Q&A
  analytics/page.tsx    # Engagement dashboard
  api/
    process/route.ts    # Parse document + generate Gemini scripts
    ask/route.ts        # Document-grounded Q&A
    analytics/route.ts  # Event recording and retrieval
components/             # Reusable UI components
lib/
  gemini.ts             # Gemini API integration
  document-parser.ts    # PDF / DOCX / PPTX parsing
  types.ts              # Shared TypeScript types
  store.ts              # Zustand state management
```

---

## How It Works

1. Upload a PDF, DOCX, or PPTX file
2. The document is parsed and sent to Gemini, which generates section-by-section narration scripts and slide layouts
3. The Studio page plays the video with TTS narration, animated slides, and a live Q&A chat
4. The Analytics page shows how users engaged with the content
