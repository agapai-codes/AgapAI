'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { Zap, Mic, Bot, ArrowRight, RotateCcw, ChevronRight, X, Send, CheckCircle2 } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { extractEmergencyInfo } from '../lib/gemini';
import type { IncidentType } from '../types/incident';

interface Submission {
  incident_type: string;
  condition: string;
  location_description: string;
  people_affected: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgency_reason: string;
}

const FIRST_AID: Record<string, string> = {
  headache: 'For severe headache: Rest in a quiet, dark room. Apply a cold pack to the forehead. Take OTC pain relievers if safe.',
  chest_pain: 'For chest pain: Help the person sit upright. Loosen tight clothing. If prescribed nitroglycerin, help them take it. Call emergency services immediately.',
  bleeding: 'For severe bleeding: Apply firm direct pressure with a clean cloth. Do NOT remove the cloth. Keep the person lying down.',
  fracture: 'For suspected fracture: Do NOT move the injured area. Immobilize the limb if possible. Apply ice wrapped in cloth.',
  burn: 'For burns: Cool under running water for 20 minutes. Do NOT use ice. Cover loosely with a clean dressing.',
  default: 'Keep the person calm and still. Do not give food or water. Monitor their condition. Stay with them until help arrives.',
};

function getFirstAid(symptoms: string): string {
  const l = symptoms.toLowerCase();
  if (l.includes('head') || l.includes('migraine')) return FIRST_AID.headache;
  if (l.includes('chest') || l.includes('heart')) return FIRST_AID.chest_pain;
  if (l.includes('bleed') || l.includes('cut') || l.includes('wound')) return FIRST_AID.bleeding;
  if (l.includes('fall') || l.includes('break') || l.includes('fracture') || l.includes('bone')) return FIRST_AID.fracture;
  if (l.includes('burn') || l.includes('scald')) return FIRST_AID.burn;
  return FIRST_AID.default;
}

function toIncidentType(value: string): IncidentType {
  const upper = value.toUpperCase();
  if (upper === 'FIRE' || upper === 'ACCIDENT' || upper === 'MEDICAL' || upper === 'DISASTER') {
    return upper;
  }
  return 'MEDICAL';
}

export default function CitizenView() {
  const { createIncident } = useIncidents();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0));

  React.useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!showVoiceModal) return;
    const interval = setInterval(() => {
      setWaveformBars(prev => prev.map(() => Math.random() * 100));
    }, 100);
    return () => clearInterval(interval);
  }, [showVoiceModal]);

  const handleSOS = useCallback(async () => {
    setIsRecording(!isRecording);
    if (isRecording) return;

    const submit = (lng: number, lat: number, location: string) =>
      createIncident({
        type: 'MEDICAL',
        location,
        description: 'Emergency beacon activated',
        reporter: 'System (SOS)',
        coordinates: { lng, lat },
      });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          submit(pos.coords.longitude, pos.coords.latitude, 'Current Location (GPS)');
          toast.success('Emergency beacon activated');
        },
        () => {
          submit(124.2452, 8.2280, 'Iligan City, Philippines');
          toast.success('Emergency beacon activated (default location)');
        }
      );
    } else {
      await submit(124.2452, 8.2280, 'Iligan City, Philippines');
      toast.success('Emergency beacon activated');
    }
  }, [isRecording, createIncident]);

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setShowVoiceModal(false);
    try {
      const extracted = await extractEmergencyInfo(text);
      const sub: Submission = {
        incident_type: extracted.incident_type,
        condition: extracted.condition,
        location_description: extracted.location_description,
        people_affected: extracted.people_affected,
        urgency: extracted.urgency,
        urgency_reason: extracted.urgency_reason,
      };
      setSubmission(sub);

      await createIncident({
        type: toIncidentType(extracted.incident_type),
        location: extracted.location_description || 'Iligan City, Philippines',
        description: extracted.condition || text,
        reporter: 'Citizen',
        coordinates: { lng: 124.2452, lat: 8.2280 },
      });

      setReportSubmitted(true);
      toast.success('Report submitted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process report. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [createIncident]);

  const handleVoiceSubmit = useCallback(() => processText(transcript), [transcript, processText]);

  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'ai', text: getFirstAid(userMsg) }]);
    }, 600);
  }, [chatInput]);

  const handleTryDemo = () => {
    setTranscript('My friend fell from the stairs. He is unconscious and bleeding from his head. We are inside the engineering building, third floor.');
    setReportSubmitted(false);
  };
  const handleReset = () => { setTranscript(''); setReportSubmitted(false); setSubmission(null); setIsRecording(false); };

  const firstAid = submission ? getFirstAid(submission.condition) : '';

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
          <div style={{ background: 'rgba(24,24,27,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(39,39,42,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { l: 'TYPE', v: submission.incident_type.toUpperCase() },
                { l: 'PEOPLE', v: String(submission.people_affected) },
                { l: 'LOCATION', v: submission.location_description },
                { l: 'URGENCY', v: submission.urgency.toUpperCase(), c: submission.urgency === 'critical' ? '#ef4444' : submission.urgency === 'high' ? '#f97316' : submission.urgency === 'medium' ? '#eab308' : '#22c55e' },
              ].map(i => (
                <div key={i.l} style={{ background: 'rgba(9,9,11,0.8)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(39,39,42,0.6)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase', marginBottom: '4px' }}>{i.l}</p>
                  <p style={{ fontWeight: 500, color: (i as { c?: string }).c || '#fafafa', textTransform: 'capitalize' }}>{i.v}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '16px', fontSize: '12px', color: '#71717a' }}>{submission.urgency_reason}</p>
          </div>
          <div style={{ background: 'rgba(24,24,27,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(39,39,42,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
            <h3 style={{ color: '#fafafa', fontWeight: 600, marginBottom: '12px' }}>First-Aid Guidance</h3>
            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: 1.6 }}>{firstAid}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/dashboard" style={{ flex: 1 }}><button style={{ width: '100%', background: '#fafafa', color: '#09090b', height: '48px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Dispatcher Dashboard <ArrowRight size={16} /></button></a>
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

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
          <div style={{ position: 'absolute', width: '224px', height: '224px', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.1)', animation: 'ping 4s cubic-bezier(0, 0, 0.2, 1) infinite', zIndex: 10 }} />
          <div style={{ position: 'absolute', width: '192px', height: '192px', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.3)', animation: 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite', zIndex: 10 }} />
          <button
            onClick={handleSOS}
            style={{ position: 'relative', width: '144px', height: '144px', borderRadius: '50%', background: 'linear-gradient(to bottom, #ef4444, #dc2626)', color: '#fafafa', fontSize: '24px', fontWeight: 900, letterSpacing: '0.1em', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(239,68,68,0.3)', zIndex: 30, transition: 'transform 0.15s' }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isRecording ? 'STOP' : 'SOS'}
          </button>
        </div>

        <p style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', color: '#a1a1aa', marginTop: '24px' }}>
          {isRecording ? 'Recording... Speak now' : 'Tap to activate emergency mode'}
        </p>

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

        {transcript && (
          <div style={{ width: '100%', maxWidth: '512px', marginTop: '24px' }}>
            <div style={{ background: 'rgba(24,24,27,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(39,39,42,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase', marginBottom: '8px' }}>Transcript</p>
              <p style={{ color: '#d4d4d8', fontSize: '14px', lineHeight: 1.6 }}>{transcript}</p>
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
            <span style={{ fontSize: '14px' }}>Processing report...</span>
          </div>
        )}
      </div>

      {!transcript && !isRecording && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%', maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px', position: 'relative', zIndex: 20 }}>
          {[
            { icon: <Zap size={20} />, title: 'Tap SOS', desc: 'Instant emergency activation with one touch', status: 'READY', color: '#ef4444', onClick: handleSOS },
            { icon: <Mic size={20} />, title: 'Voice Report', desc: 'Describe your emergency naturally — no forms needed', status: 'READY', color: '#3b82f6', onClick: () => setShowVoiceModal(true) },
            { icon: <Bot size={20} />, title: 'AI Triage', desc: 'Instant triage, first-aid guidance, and structured reports', status: 'READY', color: '#22c55e', onClick: () => setShowChatSidebar(true) },
          ].map((f) => (
            <div key={f.title} onClick={f.onClick} style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(39,39,42,0.4)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
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

      {/* VOICE MODAL */}
      {showVoiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setShowVoiceModal(false)}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fafafa' }}>Voice Report</h2>
              <button onClick={() => setShowVoiceModal(false)} style={{ color: '#71717a', cursor: 'pointer', background: 'none', border: 'none' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '80px', marginBottom: '24px', background: '#09090b', borderRadius: '12px', padding: '16px' }}>
              {waveformBars.map((height, i) => (
                <div key={i} style={{ width: '8px', background: '#ef4444', borderRadius: '4px', transition: 'height 0.1s', height: `${Math.max(4, height * 0.6)}px` }} />
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#a1a1aa', fontSize: '14px', marginBottom: '16px' }}>
              {isRecording ? 'Listening... Describe your emergency' : 'Use the demo transcript or type below'}
            </p>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Describe your emergency..."
              rows={3}
              style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', color: '#fafafa', outline: 'none', resize: 'vertical', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsRecording(!isRecording)} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', background: isRecording ? '#dc2626' : '#27272a', color: isRecording ? '#fff' : '#d4d4d8', transition: 'all 0.2s' }}>
                <Mic size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {isRecording ? 'Stop' : 'Start'}
              </button>
              <button onClick={() => { setShowVoiceModal(false); handleVoiceSubmit(); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', background: '#fafafa', color: '#09090b', transition: 'all 0.2s' }}>
                <Send size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI TRIAGE SIDEBAR */}
      {showChatSidebar && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '100%', maxWidth: '400px', background: '#18181b', borderLeft: '1px solid #27272a', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-25px 0 50px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #27272a' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fafafa' }}>AI Triage</h2>
            <button onClick={() => setShowChatSidebar(false)} style={{ color: '#71717a', cursor: 'pointer', background: 'none', border: 'none' }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#71717a', padding: '32px 0' }}>
                <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px' }}>Describe your symptoms</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                <div style={{ maxWidth: '80%', padding: '12px', borderRadius: '12px', background: msg.role === 'user' ? '#dc2626' : '#27272a', color: msg.role === 'user' ? '#fff' : '#d4d4d8' }}>
                  <p style={{ fontSize: '14px', margin: 0 }}>{msg.text}</p>
                </div>
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
                style={{ flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', color: '#fafafa', outline: 'none' }}
              />
              <button onClick={handleChatSubmit} style={{ padding: '10px 16px', background: '#dc2626', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
