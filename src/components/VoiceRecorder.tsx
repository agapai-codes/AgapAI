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
      <div className="well mb-4 border-[rgba(239,68,68,0.35)] p-4" role="alert">
        <p className="mono text-[13px] font-bold uppercase tracking-wide text-[var(--critical)]">
          Speech recognition unavailable
        </p>
        <p className="mt-1 text-[13px] text-ink-2">Use Google Chrome on desktop or Android.</p>
      </div>
    );
  }

  if (!isRecording && !error) return null;

  return (
    <div className="w-full">
      {error && (
        <div className="well mb-4 border-[rgba(239,68,68,0.35)] p-3" role="alert">
          <p className="mono text-[13px] text-[var(--critical)]">{error}</p>
        </div>
      )}

      {isRecording && (
        <div className="well mb-4 p-4" role="status" aria-label="Recording status">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="data-label mb-1.5">Status</p>
              <div className="flex items-center gap-2">
                <span className="status-dot status-dot-off live-dot" aria-hidden />
                <span className="mono text-[13px] font-bold text-[var(--critical)]">RECORDING</span>
              </div>
            </div>
            <div>
              <p className="data-label mb-1.5">Duration</p>
              <p className="mono text-[13px] text-ink-1">{formatDuration(duration)}</p>
            </div>
            <div>
              <p className="data-label mb-1.5">
                Audio level{isDemo && <span className="ml-1 normal-case">(simulated)</span>}
              </p>
              <div className="flex h-4 items-end gap-0.5" aria-hidden>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 transition-all duration-100 ${
                      i < audioLevel / 5
                        ? i < 12
                          ? 'bg-[var(--success)]'
                          : i < 16
                            ? 'bg-[var(--warning)]'
                            : 'bg-[var(--critical)]'
                        : 'bg-white/10'
                    }`}
                    style={{ height: `${Math.max(20, (i + 1) * 5)}%` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="data-label mb-1.5">Language</p>
              <p className="mono text-[13px] text-ink-2">{language}</p>
            </div>
          </div>
          {/* Mode indicator */}
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <span className={`chip ${isLive ? 'chip-success' : 'chip-warning'}`}>
              {isLive ? 'Live mode — server STT ready' : 'Demo mode — browser STT'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
