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
  const onTranscriptRef = useRef(onTranscript);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  const onStopRef = useRef(onStop);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  // Keep refs up to date
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

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
          onTranscriptRef.current(finalTranscript.trim());
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        onInterimTranscriptRef.current(finalTranscript + interimTranscript);
      }

      setAudioLevel(Math.random() * 40 + 60);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setError('No speech detected. Speak louder.');
      } else if (event.error === 'audio-capture') {
        setError('No microphone found.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied.');
      } else {
        setError(`Error: ${event.error}`);
      }
      onStopRef.current();
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
      try {
        recognitionRef.current.start();
        setError(null);
        setDuration(0);
      } catch (e) {}
    } else {
      recognitionRef.current.stop();
      setAudioLevel(0);
    }
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (!isSupported) {
    return (
      <div className="max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400 font-bold text-sm font-mono">SPEECH RECOGNITION UNAVAILABLE</p>
        <p className="text-zinc-400 text-xs mt-1">Use Google Chrome on desktop or Android.</p>
      </div>
    );
  }

  if (!isRecording && !error) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-mono">{error}</p>
        </div>
      )}

      {isRecording && (
        <div className="bg-zinc-900/60 border border-zinc-800/50 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">STATUS</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-sm font-bold font-mono">RECORDING</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">DURATION</p>
              <p className="text-zinc-100 text-sm font-mono">{formatDuration(duration)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">AUDIO LEVEL</p>
              <div className="flex gap-0.5 h-4 items-end">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 transition-all duration-100 ${
                      i < audioLevel / 5
                        ? i < 12 ? 'bg-emerald-500' : i < 16 ? 'bg-amber-500' : 'bg-red-500'
                        : 'bg-zinc-800'
                    }`}
                    style={{ height: `${Math.max(20, (i + 1) * 5)}%` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">LANGUAGE</p>
              <p className="text-zinc-400 text-sm font-mono">en-US</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
