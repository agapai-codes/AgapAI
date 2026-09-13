'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { Zap, Mic, ArrowRight, RotateCcw, ChevronRight, X, Send, CheckCircle2, MapPin } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { extractEmergencyInfo } from '../lib/gemini';
import { getFirstAid, type FirstAidProtocol } from '../lib/firstAid';
import { useAuth } from '../hooks/useAuth';
import VoiceRecorder from '../components/VoiceRecorder';
import { isDemo, isLive, APP_MODE } from '../lib/config';
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

type ExtractionStepKey = 'capturing-location' | 'analyzing-transcript' | 'creating-report';
type ExtractionStep = ExtractionStepKey | null;

function toIncidentType(value: string): IncidentType {
  const upper = value.toUpperCase();
  const valid: IncidentType[] = ['FIRE', 'ACCIDENT', 'MEDICAL', 'VIOLENCE', 'NATURAL_DISASTER'];
  if (valid.includes(upper as IncidentType)) return upper as IncidentType;
  return 'MEDICAL';
}

export default function CitizenView() {
  const { createIncident } = useIncidents();
  const { user } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [firstAidProtocol, setFirstAidProtocol] = useState<FirstAidProtocol | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const acquireGPS = useCallback((): Promise<{ lng: number; lat: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
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
          setGpsCoords(null);
          setGpsStatus('error');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const handleSOS = useCallback(async () => {
    try {
      const coords = await acquireGPS();
      if (!coords) {
        toast.error('GPS location required for emergency beacon');
        return;
      }
      const result = await createIncident({
        type: 'MEDICAL',
        location: 'Current Location (GPS)',
        description: 'Emergency beacon activated',
        reporter: user?.name || user?.email || 'System (SOS)',
        reporter_email: user?.email,
        coordinates: coords,
        urgency: 'critical',
        urgency_reason: 'One-tap SOS activated',
      });
      if (result) {
        toast.success('Emergency beacon activated');
      } else {
        toast.error('Failed to send beacon. Please try again.');
      }
    } catch (err) {
      console.error('SOS failed:', err);
      toast.error('Emergency beacon failed. Check your connection.');
    }
  }, [acquireGPS, createIncident, user]);

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setShowVoiceModal(false);
    setIsRecording(false);

    setExtractionStep('capturing-location');
    const coords = gpsCoords || await acquireGPS();
    if (!coords) {
      setIsProcessing(false);
      setExtractionStep(null);
      toast.error('GPS location required for report submission');
      return;
    }

    setExtractionStep('analyzing-transcript');
    try {
      const extracted = await extractEmergencyInfo(text);
      if (!extracted) {
        throw new Error('Failed to extract emergency information');
      }
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
      const conditionText = (sub.condition || sub.incident_type || 'general emergency').trim();
      setFirstAidProtocol(getFirstAid(conditionText));

      setExtractionStep('creating-report');
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
      setExtractionStep(null);
    }
  }, [gpsCoords, acquireGPS, createIncident, user]);

  const handleVoiceSubmit = useCallback(() => processText(transcript), [transcript, processText]);

  const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      const coords = await acquireGPS();
      if (!coords) {
        toast.error('GPS required to start recording');
        return;
      }
    }
    setIsRecording(prev => !prev);
  }, [isRecording, acquireGPS]);

  const handleVoiceModalClose = useCallback(() => {
    setShowVoiceModal(false);
    setIsRecording(false);
  }, []);

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
    setExtractionStep(null);
    setGpsCoords(null);
    setGpsStatus('idle');
  };

  const urgencyColor = (u: string) =>
    u === 'critical' ? '#ef4444' : u === 'high' ? '#f97316' : u === 'medium' ? '#eab308' : '#22c55e';

  const extractionStepLabel: Record<ExtractionStepKey, string> = {
    'capturing-location': 'Capturing location...',
    'analyzing-transcript': 'Analyzing transcript with AI...',
    'creating-report': 'Creating incident report...',
  };

  // ─── REPORT SUBMITTED VIEW ────────────────────────────────────────
  if (reportSubmitted && submission) {
    return (
      <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col justify-between">
        <header className="h-16 border-b border-zinc-800/60 flex items-center justify-between px-6 bg-[#09090b]/80 backdrop-blur-xl relative z-20">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg text-[#fafafa]">Agap<span className="text-[#ef4444]">AI</span></span>
            <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full border ${isDemo ? 'bg-zinc-800/60 text-[#a1a1aa] border-zinc-700/40' : 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'}`}>
              {APP_MODE.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
            </span>
            <span className="text-[#22c55e] text-xs font-semibold">ONLINE</span>
          </div>
        </header>

        <div className="max-w-md mx-auto py-16 px-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
              <CheckCircle2 className="w-8 h-8 text-[#22c55e]" />
            </div>
            <h1 className="text-2xl font-bold text-[#fafafa] mb-2">Report Submitted</h1>
            <p className="text-[#a1a1aa]">Emergency services have been notified</p>
          </div>

          <div className="bg-[#18181b]/60 backdrop-blur-xl border border-zinc-800/40 shadow-2xl rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'TYPE', v: submission.incident_type.replace('_', ' ') },
                { l: 'URGENCY', v: submission.urgency.toUpperCase(), c: urgencyColor(submission.urgency) },
                { l: 'CONDITION', v: submission.condition },
                { l: 'PEOPLE', v: String(submission.people_affected) },
                { l: 'LOCATION', v: submission.location_description },
                { l: 'GPS', v: submission.gps ? `${submission.gps.lat.toFixed(4)}, ${submission.gps.lng.toFixed(4)}` : 'N/A' },
              ].map(i => (
                <div key={i.l} className="bg-[#09090b]/80 rounded-lg p-3 border border-zinc-800/60">
                  <p className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase mb-1">{i.l}</p>
                  <p className="font-medium text-[#fafafa] capitalize text-[13px]" style={{ color: (i as any).c || undefined }}>{i.v}</p>
                </div>
              ))}
            </div>
            {submission.hazards.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase mb-1.5">HAZARDS</p>
                <div className="flex flex-wrap gap-1.5">
                  {submission.hazards.map((h, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">{h.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-[#71717a] italic">{submission.urgency_reason}</p>
          </div>

          {firstAidProtocol && (
            <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 flex items-center justify-center">
                  <span className="text-base">🏥</span>
                </div>
                <div>
                  <h3 className="text-[#10b981] font-bold text-sm">FIRST-AID: {firstAidProtocol.title.toUpperCase()}</h3>
                  <p className="text-[#6b7280] text-[10px] font-mono">{firstAidProtocol.source}</p>
                </div>
              </div>
              <ol className="m-0 mb-3 pl-5 list-decimal">
                {firstAidProtocol.steps.map((step, i) => (
                  <li key={i} className="text-[#d4d4d8] text-[13px] leading-relaxed mb-1.5">{step}</li>
                ))}
              </ol>
              {firstAidProtocol.warnings.length > 0 && (
                <div className="bg-[#ef4444]/5 border border-[#ef4444]/15 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-[#ef4444] mb-1.5">⚠ WARNINGS</p>
                  {firstAidProtocol.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-[#a1a1aa] leading-relaxed">• {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <a href="/dispatcher" className="flex-1"><button className="w-full bg-[#fafafa] text-[#09090b] h-12 font-medium rounded-lg border-none cursor-pointer text-sm flex items-center justify-center gap-2">Dispatcher Dashboard <ArrowRight size={16} /></button></a>
            <button onClick={handleReset} className="h-12 border border-[#3f3f46] text-[#d4d4d8] rounded-lg bg-transparent cursor-pointer flex items-center gap-2 px-4"><RotateCcw size={16} /> New</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN LANDING VIEW ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col justify-between relative overflow-x-hidden">
      <Toaster position="top-center" theme="dark" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.12)_0%,rgba(9,9,11,0)_50%)] pointer-events-none z-0" />

      <header className="h-16 border-b border-zinc-800/60 flex items-center justify-between px-6 bg-[#09090b]/80 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg text-[#fafafa]">Agap<span className="text-[#ef4444]">AI</span></span>
          <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full border ${isDemo ? 'bg-zinc-800/60 text-[#a1a1aa] border-zinc-700/40' : 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'}`}>
            {APP_MODE.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
            </span>
            <span className="text-[#22c55e] text-xs font-semibold">ONLINE</span>
          </div>
          {mounted && <span className="text-[#71717a] text-sm font-mono">{currentTime}</span>}
        </div>
      </header>

      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center w-full max-w-xl mx-auto px-4 relative z-20">
        <div className="mb-10">
          <h1 className="text-5xl font-bold text-[#fafafa] mb-3 tracking-tight">Agap<span className="text-[#ef4444]">AI</span></h1>
          <p className="text-[#a1a1aa] text-lg">Emergency Response Command Center</p>
          <p className="text-[#52525b] text-sm mt-2">IEEE SumpAI 2026 — MSU-IIT</p>
        </div>

        {/* SOS Button */}
        <div className="relative flex flex-col items-center justify-center my-6">
          <div className="absolute w-56 h-56 rounded-full border border-[#ef4444]/10 animate-ping" style={{ animationDuration: '4s' }} />
          <div className="absolute w-48 h-48 rounded-full border border-[#ef4444]/30 animate-ping" style={{ animationDuration: '2.5s' }} />
          <button
            onClick={handleSOS}
            aria-label="Emergency SOS - Tap to activate emergency beacon"
            className="relative w-36 h-36 rounded-full bg-gradient-to-b from-[#ef4444] to-[#dc2626] text-[#fafafa] text-2xl font-black tracking-widest border-none cursor-pointer flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)] z-30 transition-transform active:scale-95"
          >
            SOS
          </button>
        </div>

        <p className="text-sm font-semibold tracking-wide text-[#a1a1aa] mt-6">
          {isRecording ? 'Listening... Speak now' : 'Tap SOS for instant beacon, or use Voice Report below'}
        </p>

        {gpsStatus !== 'idle' && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 ${gpsStatus === 'ready' ? 'text-[#22c55e]' : gpsStatus === 'loading' ? 'text-[#eab308]' : 'text-[#f87171]'}`}>
            <MapPin size={12} />
            {gpsStatus === 'loading' ? 'Acquiring GPS...' : gpsStatus === 'ready' ? 'GPS ready' : 'GPS unavailable — location required'}
          </p>
        )}

        {!transcript && !isRecording && (
          <div className="mt-4 flex flex-col items-center">
            <button
              onClick={handleTryDemo}
              className="px-4 py-2 bg-zinc-900/40 border border-zinc-800/80 text-[#71717a] rounded-full text-xs font-semibold tracking-widest uppercase backdrop-blur-xl cursor-pointer flex items-center gap-1.5 shadow-md transition-all hover:bg-zinc-800/40"
            >
              <ChevronRight size={14} /> Launch Simulator
            </button>
            <p className="text-[11px] text-[#3f3f46] mt-2 font-light">
              {isDemo
                ? 'Demo mode uses browser speech recognition and keyword-based extraction'
                : 'Pre-filled emergency report for demonstration'}
            </p>
          </div>
        )}

        {transcript && (
          <div className="w-full max-w-md mt-6">
            <div className="bg-[#18181b]/60 backdrop-blur-xl border border-zinc-800/40 shadow-2xl rounded-xl p-4">
              <p className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase mb-2">Transcript</p>
              <p className="text-[#d4d4d8] text-sm leading-relaxed">{transcript}</p>
              {interimTranscript && (
                <p className="text-[#52525b] text-[13px] leading-relaxed mt-1 italic">{interimTranscript.replace(transcript, '')}</p>
              )}
            </div>

            {/* Preview card — extracted fields before submission */}
            {!isProcessing && (
              <div className="bg-[#18181b]/60 backdrop-blur-xl border border-[#3b82f6]/20 shadow-2xl rounded-xl p-4 mt-3">
                <p className="text-[10px] font-bold tracking-widest text-[#3b82f6] uppercase mb-2">Preview — What the AI will extract</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#09090b]/80 rounded-lg p-2 border border-zinc-800/60">
                    <p className="text-[9px] font-bold tracking-widest text-[#71717a] uppercase">Type</p>
                    <p className="text-xs text-[#fafafa] capitalize">{isDemo ? 'Keyword-detected' : 'Gemini-classified'}</p>
                  </div>
                  <div className="bg-[#09090b]/80 rounded-lg p-2 border border-zinc-800/60">
                    <p className="text-[9px] font-bold tracking-widest text-[#71717a] uppercase">Urgency</p>
                    <p className="text-xs text-[#fafafa] capitalize">{isDemo ? 'Rule-based' : 'AI-assessed'}</p>
                  </div>
                  <div className="bg-[#09090b]/80 rounded-lg p-2 border border-zinc-800/60">
                    <p className="text-[9px] font-bold tracking-widest text-[#71717a] uppercase">Location</p>
                    <p className="text-xs text-[#fafafa]">{gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'Acquiring...'}</p>
                  </div>
                  <div className="bg-[#09090b]/80 rounded-lg p-2 border border-zinc-800/60">
                    <p className="text-[9px] font-bold tracking-widest text-[#71717a] uppercase">Confidence</p>
                    <p className="text-xs text-[#fafafa]">{isDemo ? 'Keyword match' : 'AI confidence score'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {transcript && !isProcessing && (
          <button onClick={handleVoiceSubmit} className="mt-6 px-8 py-3 bg-[#fafafa] text-[#09090b] font-semibold rounded-lg border-none cursor-pointer flex items-center gap-2 shadow-lg">
            <Send size={16} /> Submit Report
          </button>
        )}

        {isProcessing && (
          <div className="mt-6 flex flex-col items-center gap-3 text-[#a1a1aa]">
            <div className="w-5 h-5 border-2 border-[#52525b] border-t-[#fafafa] rounded-full animate-spin" />
            {extractionStep && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-[#fafafa]">{extractionStepLabel[extractionStep]}</span>
                <div className="flex gap-1.5 mt-1">
                  {(['capturing-location', 'analyzing-transcript', 'creating-report'] as ExtractionStepKey[]).map((step) => {
                    const steps: ExtractionStepKey[] = ['capturing-location', 'analyzing-transcript', 'creating-report'];
                    const currentIdx = steps.indexOf(extractionStep);
                    const stepIdx = steps.indexOf(step);
                    return (
                      <div
                        key={step}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          stepIdx <= currentIdx ? 'bg-[#fafafa]' : 'bg-[#3f3f46]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature cards */}
      {!transcript && !isRecording && (
        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl mx-auto px-6 pb-12 relative z-20">
          {[
            { icon: <Zap size={20} />, title: 'Tap SOS', desc: 'Instant emergency activation with one touch', status: 'READY', color: '#ef4444', onClick: handleSOS },
            { icon: <Mic size={20} />, title: 'Voice Report', desc: 'Speak naturally — AI converts your words into a structured report', status: 'READY', color: '#3b82f6', onClick: () => setShowVoiceModal(true) },
          ].map((f) => (
            <div key={f.title} onClick={f.onClick} role="button" tabIndex={0} aria-label={f.title}
              onKeyDown={e => e.key === 'Enter' && f.onClick()}
              className="bg-[#18181b]/60 border border-zinc-800/40 rounded-xl p-5 flex flex-col justify-between min-h-[130px] text-left cursor-pointer transition-all relative hover:border-zinc-700/40">
              <span className="absolute top-4 right-4 text-[10px] font-bold tracking-widest uppercase text-[#4ade80] bg-[#22c55e]/10 px-2 py-0.5 rounded-full border border-[#22c55e]/20">{f.status}</span>
              <div>
                <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center mb-4" style={{ color: f.color }}>{f.icon}</div>
                <h3 className="text-base font-bold text-[#f4f4f5] mb-1">{f.title}</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed m-0">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VOICE MODAL — using VoiceRecorder component */}
      {showVoiceModal && (
        <div role="dialog" aria-modal="true" aria-label="Voice Report"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleVoiceModalClose}>
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#fafafa]">Voice Report</h2>
              <button onClick={handleVoiceModalClose} className="text-[#71717a] cursor-pointer bg-transparent border-none" aria-label="Close"><X size={20} /></button>
            </div>

            <VoiceRecorder
              isRecording={isRecording}
              onTranscript={setTranscript}
              onInterimTranscript={setInterimTranscript}
              onStop={() => setIsRecording(false)}
            />

            <p className="text-center text-[#a1a1aa] text-sm mb-4">
              {isRecording ? 'Listening... Describe your emergency clearly' : 'Tap Start to begin recording, or type below'}
            </p>

            {/* Real-time transcript preview inside modal */}
            {transcript && (
              <div className="bg-[#09090b] border border-zinc-800/60 rounded-lg p-3 mb-4">
                <p className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase mb-1">Live Transcript</p>
                <p className="text-[#d4d4d8] text-[13px] leading-relaxed">{transcript}</p>
                {interimTranscript && (
                  <p className="text-[#52525b] text-xs italic mt-1">{interimTranscript.replace(transcript, '')}</p>
                )}
              </div>
            )}

            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Or type your emergency description here..."
              rows={3}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-4 text-sm text-[#fafafa] outline-none resize-y mb-4"
              aria-label="Emergency description"
            />
            <div className="flex gap-3">
              <button onClick={handleToggleRecording} className="flex-1 py-3 rounded-lg font-semibold text-sm border-none cursor-pointer transition-all" style={{ background: isRecording ? '#dc2626' : '#27272a', color: isRecording ? '#fff' : '#d4d4d8' }}>
                <Mic size={16} className="inline mr-2 align-middle" /> {isRecording ? 'Stop' : 'Start'}
              </button>
              <button onClick={() => { handleVoiceSubmit(); handleVoiceModalClose(); }} disabled={!transcript.trim()} className="flex-1 py-3 rounded-lg font-semibold text-sm border-none transition-all" style={{ cursor: transcript.trim() ? 'pointer' : 'not-allowed', background: transcript.trim() ? '#fafafa' : '#27272a', color: transcript.trim() ? '#09090b' : '#52525b' }}>
                <Send size={16} className="inline mr-2 align-middle" /> Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
