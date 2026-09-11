'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
  isRecording: boolean;
  onStop: () => void;
}

export default function VoiceRecorder({
  onTranscript,
  onInterimTranscript,
  isRecording,
  onStop
}: VoiceRecorderProps) {
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          onTranscript(finalTranscript.trim());
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        onInterimTranscript(finalTranscript + interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try speaking louder.');
      } else if (event.error === 'audio-capture') {
        setError('No microphone found. Please connect a microphone.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => { recognition.abort(); };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      try { recognitionRef.current.start(); setError(null); } catch (e) {}
    } else {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  if (!isSupported) {
    return (
      <div className="text-center p-8 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/30">
        <p className="text-[#EF4444] text-lg font-semibold">Speech Recognition Not Supported</p>
        <p className="text-[#9CA3AF] mt-2">Please use Google Chrome on desktop or Android.</p>
        <p className="text-[#9CA3AF]">Safari and Firefox have limited support.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      {error && (
        <div className="mb-4 p-4 bg-[#EF4444]/20 rounded-lg border border-[#EF4444]/40">
          <p className="text-[#EF4444]">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-center gap-3 text-[#9CA3AF]">
        <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-[#EF4444] animate-pulse' : 'bg-[#6B7280]'}`} />
        <span className="text-sm">
          {isRecording ? 'Listening... Speak now' : 'Press SOS to start'}
        </span>
      </div>
    </div>
  );
}
