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
    <div className="w-full max-w-2xl mx-auto mt-8 animate-fade-in">
      <Card className="bg-[#111827] border-[#374151]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isProcessing ? "bg-[#EAB308] animate-pulse" : "bg-[#22C55E]"
            )} />
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">
              {isProcessing ? 'Processing with AI...' : 'Live Transcript'}
            </span>
          </div>
          <div className="min-h-[60px]">
            <p className="text-lg leading-relaxed">
              {transcript}
              <span className="text-[#6B7280] italic">
                {interimTranscript.replace(transcript, '')}
              </span>
              {isProcessing && <span className="animate-pulse ml-1 text-[#EAB308]">|</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
