'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TranscriptViewProps {
  transcript: string;
  interimTranscript: string;
  isProcessing: boolean;
}

export default function TranscriptView({ transcript, interimTranscript, isProcessing }: TranscriptViewProps) {
  if (!transcript && !interimTranscript) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 animate-fade-in">
      <Card className="bg-[#0F1520] border-[#1E3A5F] rounded-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-4 py-2 border-b border-[#1E3A5F] flex items-center justify-between">
            <span className="data-label">TRANSCRIPT LOG</span>
            <div className="flex items-center gap-3">
              {isProcessing && (
                <span className="text-[10px] mono text-[#F59E0B] px-2 py-0.5 bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                  PROCESSING
                </span>
              )}
              {!isProcessing && (
                <span className="text-[10px] mono text-[#10B981] px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30">
                  COMPLETE
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 min-h-[80px] bg-[#080C14]">
            <div className="font-mono text-sm leading-relaxed">
              {transcript.split('. ').map((sentence, i) => (
                sentence && (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-[#3B82F6] select-none">&gt;</span>
                    <span className="text-[#F9FAFB]">{sentence}{i < transcript.split('. ').length - 1 ? '.' : ''}</span>
                  </div>
                )
              ))}
              {interimTranscript.replace(transcript, '') && (
                <div className="flex gap-2">
                  <span className="text-[#3B82F6] select-none">&gt;</span>
                  <span className="text-[#6B7280] italic">{interimTranscript.replace(transcript, '')}</span>
                </div>
              )}
              {isProcessing && (
                <div className="flex gap-2">
                  <span className="text-[#3B82F6] select-none">&gt;</span>
                  <span className="text-[#F59E0B] animate-pulse">|</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="data-label">WORDS: <span className="text-[#F9FAFB]">{transcript.split(' ').filter(w => w).length}</span></span>
              <span className="data-label">CHARS: <span className="text-[#F9FAFB]">{transcript.length}</span></span>
            </div>
            <span className="data-label">STATUS: <span className={isProcessing ? 'text-[#F59E0B]' : 'text-[#10B981]'}>{isProcessing ? 'ACTIVE' : 'COMPLETE'}</span></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
