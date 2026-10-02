'use client';

import { Card, CardContent } from '@/components/ui/card';

interface TranscriptViewProps {
  transcript: string;
  interimTranscript: string;
  isProcessing: boolean;
}

export default function TranscriptView({ transcript, interimTranscript, isProcessing }: TranscriptViewProps) {
  if (!transcript && !interimTranscript) return null;

  const sentenceCount = transcript.split('. ').filter(Boolean).length;
  const wordCount = transcript.split(' ').filter(Boolean).length;

  return (
    <div className="mx-auto mt-6 w-full max-w-2xl animate-fade-in">
      <Card className="panel overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <span className="data-label">Transcript Log</span>
            <span className={`chip ${isProcessing ? 'chip-warning' : 'chip-success'}`}>
              <span className={`status-dot ${isProcessing ? 'status-dot-warn' : 'status-dot-ok'}`} aria-hidden />
              {isProcessing ? 'Processing' : 'Complete'}
            </span>
          </div>

          {/* Content */}
          <div className="min-h-[80px] bg-[var(--surface-inset)] p-4">
            <div className="mono text-[13px] leading-relaxed">
              {transcript.split('. ').map((sentence, i) =>
                sentence ? (
                  <div key={i} className="mb-1 flex gap-2">
                    <span className="select-none text-[var(--info)]" aria-hidden>&gt;</span>
                    <span className="text-ink-1">{sentence}{i < sentenceCount - 1 ? '.' : ''}</span>
                  </div>
                ) : null
              )}
              {interimTranscript.replace(transcript, '') && (
                <div className="flex gap-2">
                  <span className="select-none text-[var(--info)]" aria-hidden>&gt;</span>
                  <span className="italic text-ink-3">{interimTranscript.replace(transcript, '')}</span>
                </div>
              )}
              {isProcessing && (
                <div className="flex gap-2" aria-hidden>
                  <span className="select-none text-[var(--info)]">&gt;</span>
                  <span className="animate-pulse text-[var(--warning)]">|</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
            <div className="flex gap-4">
              <span className="data-label data-label-tight">
                Words <span className="mono ml-1 text-ink-1">{wordCount}</span>
              </span>
              <span className="data-label data-label-tight">
                Chars <span className="mono ml-1 text-ink-1">{transcript.length}</span>
              </span>
            </div>
            <span className="data-label data-label-tight">
              Status{' '}
              <span
                className="mono ml-1"
                style={{ color: isProcessing ? 'var(--warning)' : 'var(--success)' }}
              >
                {isProcessing ? 'ACTIVE' : 'COMPLETE'}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
