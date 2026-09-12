'use client';

// Application mode: 'demo' or 'live'
// - demo: Uses Web Speech API, fallback extraction, seed incidents, polling
// - live: Uses streaming STT, Gemini extraction, real DB, WebSocket (future)
const MODE = process.env.NEXT_PUBLIC_MODE || 'demo';

export const APP_MODE = MODE as 'demo' | 'live';
export const isDemo = APP_MODE === 'demo';
export const isLive = APP_MODE === 'live';

// STT Configuration
export const STT_CONFIG = {
  demo: {
    provider: 'webspeech' as const,
    lang: 'en-US',
  },
  live: {
    provider: 'deepgram' as const, // or 'google', 'whisper'
    lang: 'en-US',
    supportedLanguages: ['en-US', 'fil-PH', 'tl-PH', 'ceb-PH'],
    sampleRate: 16000,
    encoding: 'linear16' as const,
    endpoint: process.env.NEXT_PUBLIC_STT_ENDPOINT || '/api/stt',
  },
} as const;

// Extraction Configuration
export const EXTRACTION_CONFIG = {
  demo: {
    provider: 'fallback' as const, // Always use keyword-based
  },
  live: {
    provider: 'gemini' as const,
    fallbackToKeyword: true,
    confidenceThreshold: 0.5, // Below this, flag for manual review
  },
} as const;

// Polling Configuration
export const POLL_CONFIG = {
  demo: { intervalMs: 5000 },
  live: { intervalMs: 2000 }, // Faster polling until WebSocket is implemented
} as const;
