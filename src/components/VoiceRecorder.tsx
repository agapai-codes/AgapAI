'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { isDemo, isLive } from '../lib/config';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
  isRecording: boolean;
  onStop: () => void;
  language?: string;
  onAudioChunk?: (chunk: Blob) => void;
}

export default function VoiceRecorder({
  onTranscript,
  onInterimTranscript,
  isRecording,
  onStop,
  language = 'en-US',
  onAudioChunk,
}: VoiceRecorderProps) {
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  const onStopRef = useRef(onStop);
  const isRecordingRef = useRef(isRecording);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // VU meter update loop
  const updateVUMeter = useCallback(() => {
    if (!analyserRef.current) {
      setAudioLevel(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);

    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(updateVUMeter);
  }, []);

  // Start audio capture and VU meter (live mode only)
  const startAudioCapture = useCallback(async () => {
    if (!isLive || mediaRecorderRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && onAudioChunk) {
          onAudioChunk(event.data);
        }
      };

      mediaRecorder.start(1000);

      // Start VU meter loop after analyser is ready
      animationFrameRef.current = requestAnimationFrame(updateVUMeter);
    } catch (err) {
      console.error('Failed to start audio capture:', err);
    }
  }, [isLive, onAudioChunk, updateVUMeter]);

  const stopAudioCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Speech Recognition setup (demo mode uses Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
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

      // Simulated audio level in demo mode (no real mic analysis)
      if (isDemo) {
        setAudioLevel(Math.random() * 40 + 60);
      }
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
      if (isRecordingRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => { recognition.abort(); };
  }, [language]);

  // Start/stop recording
  useEffect(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      try {
        recognitionRef.current.start();
        setError(null);
        setDuration(0);
        // Start audio capture in live mode
        if (isLive) {
          startAudioCapture();
        }
      } catch (e) {}
    } else {
      recognitionRef.current.stop();
      setAudioLevel(0);
      stopAudioCapture();
    }
  }, [isRecording, isLive, startAudioCapture, stopAudioCapture]);

  // Duration timer
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
              <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
                AUDIO LEVEL {isDemo && <span className="text-zinc-600">(simulated)</span>}
              </p>
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
              <p className="text-zinc-400 text-sm font-mono">{language}</p>
            </div>
          </div>
          {/* Mode indicator */}
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded border font-mono ${
              isLive 
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' 
                : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
            }`}>
              {isLive ? 'LIVE MODE — Server STT Ready' : 'DEMO MODE — Browser STT'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
