'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { Zap, Mic, Bot, ArrowRight, RotateCcw, ChevronRight, X, Send, CheckCircle2, MapPin, Users, AlertTriangle } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { extractEmergencyInfo } from '../lib/gemini';
import { getFirstAid, type FirstAidProtocol } from '../lib/firstAid';
import { useAuth } from '../hooks/useAuth';
import type { IncidentType, UrgencyLevel } from '../types/incident';

interface Submission {
  incident_type: string;
  condition: string;
  location_description: string;
  people_affected: number;
  urgency: UrgencyLevel;
  urgency_reason: string;
  hazards: string[];
  gps?: { lng: number; lat: number };
}

function toIncidentType(value: string): IncidentType {
  const upper = value.toUpperCase();
  const valid: IncidentType[] = ['FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER', 'VIOLENCE', 'HAZARDOUS', 'MISSING_PERSON'];
  if (valid.includes(upper as IncidentType)) return upper as IncidentType;
  return 'MEDICAL';
}

export default function CitizenView() {
  const { createIncident } = useIncidents();
  const { user } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [firstAidProtocol, setFirstAidProtocol] = useState<FirstAidProtocol | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string; protocol?: FirstAidProtocol }>>([]);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Web Speech API
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
          setTranscript(finalTranscript.trim());
        } else {
          interim += t;
        }
      }
      setInterimTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      if (recognitionRef.current?._shouldRecord) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    return () => { recognition.abort(); };
  }, []);

  // GPS acquisition
  const acquireGPS = useCallback((): Promise<{ lng: number; lat: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lng: 124.2452, lat: 8.2280 });
        return;
      }
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lng: pos.coords.longitude, lat: pos.coords.latitude };
          setGpsCoords(coords);
          setGpsStatus('ready');
          resolve(coords);
        },
        () => {
          const fallback = { lng: 124.2452, lat: 8.2280 };
          setGpsCoords(fallback);
          setGpsStatus('error');
          resolve(fallback);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  }, []);

  // Start/Stop recording
  const toggleRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    if (isRecording) {
      recognitionRef.current._shouldRecord = false;
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript('');
    } else {
      // Acquire GPS first
      await acquireGPS();
      recognitionRef.current._shouldRecord = true;
      recognitionRef.current.start();
      setIsRecording(true);
      setTranscript('');
      setInterimTranscript('');
      toast.info('Listening... Describe your emergency');
    }
  }, [isRecording, acquireGPS]);

  // SOS handler — captures GPS + sends beacon
  const handleSOS = useCallback(async () => {
    const coords = await acquireGPS();
    await createIncident({
      type: 'MEDICAL',
      location: 'Current Location (GPS)',
      description: 'Emergency beacon activated',
      reporter: user?.name || user?.email || 'System (SOS)',
      reporter_email: user?.email,
      coordinates: coords,
      urgency: 'critical',
      urgency_reason: 'One-tap SOS activated',
    });
    toast.success('Emergency beacon activated');
  }, [acquireGPS, createIncident, user]);

  // Submit transcript for processing
  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setShowVoiceModal(false);
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current._shouldRecord = false;
      try { recognitionRef.current.stop(); } catch {}
    }

    const coords = gpsCoords || await acquireGPS();

    try {
      const extracted = await extractEmergencyInfo(text);
      const sub: Submission = {
        incident_type: extracted.incident_type,
        condition: extracted.condition,
        location_description: extracted.location_description,
        people_affected: extracted.people_affected,
        urgency: extracted.urgency as UrgencyLevel,
        urgency_reason: extracted.urgency_reason,
        hazards: extracted.hazards || [],
        gps: coords,
      };
      setSubmission(sub);
      setFirstAidProtocol(getFirstAid(sub.condition + ' ' + sub.incident_type));

      await createIncident({
        type: toIncidentType(extracted.incident_type),
        location: extracted.location_description || 'Iligan City, Philippines',
        description: extracted.condition || text,
        reporter: user?.name || user?.email || 'Citizen',
        reporter_email: user?.email,
        coordinates: coords,
        urgency: extracted.urgency as UrgencyLevel,
        urgency_reason: extracted.urgency_reason,
        people_affected: extracted.people_affected,
        condition: extracted.condition,
        hazards: extracted.hazards,
        transcript: text,
        confidence: extracted.confidence,
        consciousness: extracted.consciousness,
        breathing: extracted.breathing,
        bleeding: extracted.bleeding,
      });

      setReportSubmitted(true);
      toast.success('Report submitted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process report. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [gpsCoords, acquireGPS, createIncident]);

  const handleVoiceSubmit = useCallback(() => processText(transcript), [transcript, processText]);

  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    const protocol = getFirstAid(userMsg);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'ai', text: protocol.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), protocol }]);
    }, 600);
  }, [chatInput]);

  const handleTryDemo = () => {
    setTranscript('My friend fell from the stairs. He is unconscious and bleeding from his head. We are inside the engineering building, third floor.');
    setReportSubmitted(false);
  };

  const handleReset = () => {
    setTranscript('');
    setInterimTranscript('');
    setReportSubmitted(false);
    setSubmission(null);
    setFirstAidProtocol(null);
    setIsRecording(false);
    setGpsCoords(null);
    setGpsStatus('idle');
  };

  const urgencyColor = (u: string) =>
    u === 'critical' ? '#ef4444' : u === 'high' ? '#f97316' : u === 'medium' ? '#eab308' : '#22c55e';

  // ─── REPORT SUBMITTED VIEW ────────────────────────────────────────
  if (reportSubmitted && submission) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <header style={{ height: '64px', borderBottom: '1px solid rgba(39,39,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} style={{ borderRadius: '8px' }} />
            <span style={{ fontWeight: 700, fontSize: '18px', color: '#fafafa' }}>Agap<span style={{ color: '#ef4444' }}>AI</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ position: 'relative', display: 'inline-flex', height: '8px', width: '8px' }}><span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: '#4ade80', opacity: 0.75 }} /><span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', background: '#22c55e' }} /></span>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>ONLINE</span>
          </div>
        </header>
        <div style={{ maxWidth: '512px', margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(34,197,94,0.15)' }}><CheckCircle2 style={{ width: '32px', height: '32px', color: '#22c55e' }} /></div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fafafa', marginBottom: '8px' }}>Report Submitted</h1>
            <p style={{ color: '#a1a1aa' }}>Emergency services have been notified</p>
          </div>

          {/* Structured Report Card */}
          <div style={{ background: 'rgba(24,24,27,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(39,39,42,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { l: 'TYPE', v: submission.incident_type.replace('_', ' ') },
                { l: 'URGENCY', v: submission.urgency.toUpperCase(), c: urgencyColor(submission.urgency) },
                { l: 'CONDITION', v: submission.condition },
                { l: 'PEOPLE', v: String(submission.people_affected) },
                { l: 'LOCATION', v: submission.location_description },
                { l: 'GPS', v: submission.gps ? `${submission.gps.lat.toFixed(4)}, ${submission.gps.lng.toFixed(4)}` : 'N/A' },
              ].map(i => (
                <div key={i.l} style={{ background: 'rgba(9,9,11,0.8)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(39,39,42,0.6)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase', marginBottom: '4px' }}>{i.l}</p>
                  <p style={{ fontWeight: 500, color: (i as any).c || '#fafafa', textTransform: 'capitalize', fontSize: '13px' }}>{i.v}</p>
                </div>
              ))}
            </div>
            {submission.hazards.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase', marginBottom: '6px' }}>HAZARDS</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {submission.hazards.map((h, i) => (
                    <span key={i} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{h.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            )}
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#71717a', fontStyle: 'italic' }}>{submission.urgency_reason}</p>
          </div>

          {/* First-Aid Guidance — Red Cross Sourced */}
          {firstAidProtocol && (
            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '16px' }}>🏥</span></div>
                <div>
                  <h3 style={{ color: '#10b981', fontWeight: 700, fontSize: '14px' }}>FIRST-AID: {firstAidProtocol.title.toUpperCase()}</h3>
                  <p style={{ color: '#6b7280', fontSize: '10px', fontFamily: 'monospace' }}>{firstAidProtocol.source}</p>
                </div>
              </div>
              <ol style={{ margin: '0 0 12px 0', padding: '0 0 0 20px', listStyleType: 'decimal' }}>
                {firstAidProtocol.steps.map((step, i) => (
                  <li key={i} style={{ color: '#d4d4d8', fontSize: '13px', lineHeight: 1.6, marginBottom: '6px' }}>{step}</li>
                ))}
              </ol>
              {firstAidProtocol.warnings.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '6px' }}>⚠ WARNINGS</p>
                  {firstAidProtocol.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>• {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/dispatcher" style={{ flex: 1 }}><button style={{ width: '100%', background: '#fafafa', color: '#09090b', height: '48px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Dispatcher Dashboard <ArrowRight size={16} /></button></a>
            <button onClick={handleReset} style={{ height: '48px', border: '1px solid #3f3f46', color: '#d4d4d8', borderRadius: '8px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}><RotateCcw size={16} /> New</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN LANDING VIEW ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflowX: 'hidden' }}>
      <Toaster position="top-center" theme="dark" />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(220,38,38,0.12) 0%, rgba(9,9,11,0) 50%)', pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ height: '64px', borderBottom: '1px solid rgba(39,39,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} style={{ borderRadius: '8px' }} />
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#fafafa' }}>Agap<span style={{ color: '#ef4444' }}>AI</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ position: 'relative', display: 'inline-flex', height: '8px', width: '8px' }}><span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: '#4ade80', opacity: 0.75 }} /><span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', background: '#22c55e' }} /></span>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>ONLINE</span>
          </div>
          {mounted && <span style={{ color: '#71717a', fontSize: '14px', fontFamily: 'monospace' }}>{currentTime}</span>}
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', width: '100%', maxWidth: '640px', margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 20 }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, color: '#fafafa', marginBottom: '12px', letterSpacing: '-0.02em' }}>Agap<span style={{ color: '#ef4444' }}>AI</span></h1>
          <p style={{ color: '#a1a1aa', fontSize: '18px' }}>Emergency Response Command Center</p>
          <p style={{ color: '#52525b', fontSize: '14px', marginTop: '8px' }}>IEEE SumpAI 2026 — MSU-IIT</p>
        </div>

        {/* SOS Button */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
          <div style={{ position: 'absolute', width: '224px', height: '224px', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.1)', animation: 'ping 4s cubic-bezier(0, 0, 0.2, 1) infinite', zIndex: 10 }} />
          <div style={{ position: 'absolute', width: '192px', height: '192px', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.3)', animation: 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite', zIndex: 10 }} />
          <button
            onClick={handleSOS}
            aria-label="Emergency SOS - Tap to activate emergency beacon"
            style={{ position: 'relative', width: '144px', height: '144px', borderRadius: '50%', background: 'linear-gradient(to bottom, #ef4444, #dc2626)', color: '#fafafa', fontSize: '24px', fontWeight: 900, letterSpacing: '0.1em', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(239,68,68,0.3)', zIndex: 30, transition: 'transform 0.15s' }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            SOS
          </button>
        </div>

        <p style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', color: '#a1a1aa', marginTop: '24px' }}>
          {isRecording ? 'Listening... Speak now' : 'Tap SOS for instant beacon, or use Voice Report below'}
        </p>

        {/* GPS Status */}
        {gpsStatus !== 'idle' && (
          <p style={{ fontSize: '11px', color: gpsStatus === 'ready' ? '#22c55e' : gpsStatus === 'loading' ? '#eab308' : '#f87171', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} />
            {gpsStatus === 'loading' ? 'Acquiring GPS...' : gpsStatus === 'ready' ? 'GPS ready' : 'GPS unavailable — using default location'}
          </p>
        )}

        {!transcript && !isRecording && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={handleTryDemo}
              style={{ padding: '8px 16px', background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(39,39,42,0.8)', color: '#71717a', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', backdropFilter: 'blur(12px)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', transition: 'all 0.2s' }}
            >
              <ChevronRight size={14} /> Launch Simulator
            </button>
            <p style={{ fontSize: '11px', color: '#3f3f46', marginTop: '8px', fontWeight: 300 }}>Pre-filled emergency report for demonstration</p>
          </div>
        )}

        {/* Transcript display */}
        {transcript && (
          <div style={{ width: '100%', maxWidth: '512px', marginTop: '24px' }}>
            <div style={{ background: 'rgba(24,24,27,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(39,39,42,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase', marginBottom: '8px' }}>Transcript</p>
              <p style={{ color: '#d4d4d8', fontSize: '14px', lineHeight: 1.6 }}>{transcript}</p>
              {interimTranscript && (
                <p style={{ color: '#52525b', fontSize: '13px', lineHeight: 1.6, marginTop: '4px', fontStyle: 'italic' }}>{interimTranscript.replace(transcript, '')}</p>
              )}
            </div>
          </div>
        )}

        {transcript && !isProcessing && (
          <button onClick={handleVoiceSubmit} style={{ marginTop: '24px', padding: '12px 32px', background: '#fafafa', color: '#09090b', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.25)' }}>
            <Bot size={16} /> Submit Report
          </button>
        )}

        {isProcessing && (
          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#a1a1aa' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #52525b', borderTopColor: '#fafafa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Processing report with AI...</span>
          </div>
        )}
      </div>

      {/* Feature cards */}
      {!transcript && !isRecording && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%', maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px', position: 'relative', zIndex: 20 }}>
          {[
            { icon: <Zap size={20} />, title: 'Tap SOS', desc: 'Instant emergency activation with one touch', status: 'READY', color: '#ef4444', onClick: handleSOS },
            { icon: <Mic size={20} />, title: 'Voice Report', desc: 'Speak naturally — AI converts your words into a structured report', status: 'READY', color: '#3b82f6', onClick: () => setShowVoiceModal(true) },
            { icon: <Bot size={20} />, title: 'AI Triage', desc: 'Get first-aid guidance based on validated protocols', status: 'READY', color: '#22c55e', onClick: () => setShowChatSidebar(true) },
          ].map((f) => (
            <div key={f.title} onClick={f.onClick} role="button" tabIndex={0} aria-label={f.title}
              onKeyDown={e => e.key === 'Enter' && f.onClick()}
              style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(39,39,42,0.4)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(34,197,94,0.2)' }}>{f.status}</span>
              <div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(39,39,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: f.color }}>{f.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5', marginBottom: '4px' }}>{f.title}</h3>
                <p style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VOICE MODAL — with real speech-to-text */}
      {showVoiceModal && (
        <div role="dialog" aria-modal="true" aria-label="Voice Report"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setShowVoiceModal(false)}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fafafa' }}>Voice Report</h2>
              <button onClick={() => { setShowVoiceModal(false); if (isRecording) { setIsRecording(false); if (recognitionRef.current) { recognitionRef.current._shouldRecord = false; try { recognitionRef.current.stop(); } catch {} } } }} style={{ color: '#71717a', cursor: 'pointer', background: 'none', border: 'none' }} aria-label="Close"><X size={20} /></button>
            </div>

            {/* Recording indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '80px', marginBottom: '16px', background: '#09090b', borderRadius: '12px', padding: '16px', border: isRecording ? '1px solid rgba(239,68,68,0.3)' : '1px solid #27272a' }}>
              {isRecording ? (
                <>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }} />
                  <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>RECORDING</span>
                </>
              ) : (
                <Mic size={32} style={{ color: '#52525b' }} />
              )}
            </div>

            <p style={{ textAlign: 'center', color: '#a1a1aa', fontSize: '14px', marginBottom: '16px' }}>
              {isRecording ? 'Listening... Describe your emergency clearly' : 'Tap Start to begin recording, or type below'}
            </p>

            {/* Interim transcript display */}
            {isRecording && interimTranscript && (
              <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px', marginBottom: '16px', maxHeight: '80px', overflowY: 'auto' }}>
                <p style={{ color: '#a1a1aa', fontSize: '13px', lineHeight: 1.5, fontStyle: 'italic' }}>{interimTranscript}</p>
              </div>
            )}

            {/* Manual textarea fallback */}
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Or type your emergency description here..."
              rows={3}
              style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', color: '#fafafa', outline: 'none', resize: 'vertical', marginBottom: '16px' }}
              aria-label="Emergency description"
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={toggleRecording} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', background: isRecording ? '#dc2626' : '#27272a', color: isRecording ? '#fff' : '#d4d4d8', transition: 'all 0.2s' }}>
                <Mic size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {isRecording ? 'Stop' : 'Start'}
              </button>
              <button onClick={() => { setShowVoiceModal(false); handleVoiceSubmit(); }} disabled={!transcript.trim()} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: transcript.trim() ? 'pointer' : 'not-allowed', background: transcript.trim() ? '#fafafa' : '#27272a', color: transcript.trim() ? '#09090b' : '#52525b', transition: 'all 0.2s' }}>
                <Send size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI TRIAGE SIDEBAR */}
      {showChatSidebar && (
        <div role="complementary" aria-label="AI Triage Assistant"
          style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '100%', maxWidth: '400px', background: '#18181b', borderLeft: '1px solid #27272a', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-25px 0 50px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #27272a' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fafafa' }}>AI First-Aid Triage</h2>
            <button onClick={() => setShowChatSidebar(false)} style={{ color: '#71717a', cursor: 'pointer', background: 'none', border: 'none' }} aria-label="Close"><X size={20} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#71717a', padding: '32px 0' }}>
                <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px' }}>Describe symptoms or an emergency</p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: '#52525b' }}>Based on Red Cross first-aid protocols</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
                  <div style={{ maxWidth: '80%', padding: '12px', borderRadius: '12px', background: msg.role === 'user' ? '#dc2626' : '#27272a', color: msg.role === 'user' ? '#fff' : '#d4d4d8' }}>
                    <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-line' }}>{msg.text}</p>
                  </div>
                </div>
                {msg.protocol && (
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Protocol: {msg.protocol.title}</p>
                    <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>{msg.protocol.source}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', borderTop: '1px solid #27272a' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Describe symptoms..."
                aria-label="Symptom description"
                style={{ flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }}
              />
              <button onClick={handleChatSubmit} style={{ padding: '10px 16px', background: '#dc2626', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }} aria-label="Send">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
