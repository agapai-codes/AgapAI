'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { Zap, Mic, ArrowRight, RotateCcw, ChevronRight, X, Send, CheckCircle2, MapPin } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { extractEmergencyInfo } from '../lib/gemini';
import { getFirstAid, type FirstAidProtocol } from '../lib/firstAid';
import { useAuth } from '../hooks/useAuth';
import { getRealCoordinates, getRandomPHCoords } from '../utils/geolocation';
import { resolveIncidentCoords, isValidPHCoords, sanitizeCoords } from '../utils/coordinates';
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

  const acquireGPS = useCallback((): Promise<{ lng: number; lat: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const fallback = getRandomPHCoords();
        setGpsCoords(fallback);
        setGpsStatus('error');
        resolve(fallback);
        return;
      }
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          let lng = pos.coords.longitude;
          let lat = pos.coords.latitude;
          // Guard against inversion: if coords look like [lat, lng], swap them
          if (lat >= 116 && lat <= 128 && lng >= 4 && lng <= 22) {
            [lng, lat] = [lat, lng];
          }
          // Validate within Philippines bounds
          if (!isValidPHCoords(lng, lat)) {
            const fallback = getRandomPHCoords();
            setGpsCoords(fallback);
            setGpsStatus('error');
            resolve(fallback);
            return;
          }
          const coords = { lng, lat };
          setGpsCoords(coords);
          setGpsStatus('ready');
          resolve(coords);
        },
        () => {
          const fallback = getRandomPHCoords();
          setGpsCoords(fallback);
          setGpsStatus('error');
          resolve(fallback);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const handleSOS = useCallback(async () => {
    try {
      const coords = await acquireGPS();
      const result = await createIncident({
        type: 'MEDICAL',
        location: 'Current Location (GPS)',
        description: 'Emergency beacon activated',
        reporter: user?.name || user?.email || 'System (SOS)',
        reporter_email: user?.email,
        coordinates: coords,
        urgency: 'HIGH',
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
    u === 'high' ? '#ef4444' : u === 'medium' ? '#eab308' : '#22c55e';

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
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col justify-between relative overflow-x-hidden">
      <Toaster position="top-center" theme="dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.08)_0%,rgba(9,9,11,0)_60%)] pointer-events-none z-0" />

      {/* Header */}
      <header className="h-12 min-h-[48px] border-b border-white/5 flex items-center justify-between px-6 relative z-20"
        style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="AgapAI" width={24} height={24} className="rounded-md" />
          <span className="font-extrabold text-sm tracking-wider uppercase">Agap<span className="text-red-500">AI</span></span>
          <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${
            isLive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {APP_MODE.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'live-pulse 1.5s ease-in-out infinite' }} />
            <span className="text-[10px] text-emerald-400 font-semibold">ONLINE</span>
          </div>
          {mounted && <span className="text-[10px] text-neutral-500 font-mono">{currentTime}</span>}
        </div>
      </header>

      {/* Hero + SOS */}
      <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-xl mx-auto px-4 relative z-20">
        {/* Branding */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Agap<span className="text-red-500">AI</span></h1>
          <p className="text-neutral-400 text-sm">Emergency Response Command Center</p>
          <p className="text-neutral-600 text-[10px] mt-1 font-mono">IEEE SumpAI 2026 — MSU-IIT</p>
        </div>

        {/* SOS Button — dramatic */}
        <div className="relative flex flex-col items-center justify-center my-4">
          <div className="absolute w-60 h-60 rounded-full border border-red-500/10" style={{ animation: 'sonar-ping 3s ease-out infinite' }} />
          <div className="absolute w-48 h-48 rounded-full border border-red-500/20" style={{ animation: 'sonar-ping 3s ease-out infinite 1s' }} />
          <button
            onClick={handleSOS}
            aria-label="Emergency SOS - Tap to activate emergency beacon"
            className="relative w-32 h-32 rounded-full bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white text-xl font-black tracking-widest border-none cursor-pointer flex items-center justify-center z-30 transition-all active:scale-95"
            style={{ boxShadow: '0 0 60px rgba(239,68,68,0.3), 0 0 120px rgba(239,68,68,0.1)' }}
          >
            SOS
          </button>
        </div>

        <p className="text-xs font-medium text-neutral-400 mt-4">
          {isRecording ? 'Listening... Speak now' : 'Tap SOS for instant beacon, or use Voice Report below'}
        </p>

        {/* GPS Status */}
        {gpsStatus !== 'idle' && (
          <p className={`text-[10px] mt-1.5 flex items-center gap-1 font-mono ${gpsStatus === 'ready' ? 'text-emerald-400' : gpsStatus === 'loading' ? 'text-amber-400' : 'text-red-400'}`}>
            <MapPin size={10} />
            {gpsStatus === 'loading' ? 'Acquiring GPS...' : gpsStatus === 'ready' ? 'GPS ready' : 'Using approximate location'}
          </p>
        )}

        {/* Demo button */}
        {!transcript && !isRecording && (
          <div className="mt-4 flex flex-col items-center">
            <button onClick={handleTryDemo}
              className="px-4 py-2 bg-white/5 border border-white/10 text-neutral-400 rounded-full text-[10px] font-semibold tracking-wider uppercase cursor-pointer flex items-center gap-1.5 transition-all hover:bg-white/10 hover:text-white"
              style={{ backdropFilter: 'blur(12px)' }}>
              <ChevronRight size={12} /> Launch Simulator
            </button>
            <p className="text-[10px] text-neutral-600 mt-1.5">
              {isDemo ? 'Demo mode: browser speech recognition' : 'Pre-filled emergency report'}
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

        {/* Voice Report button — secondary action */}
        {!transcript && !isRecording && (
          <button onClick={() => setShowVoiceModal(true)}
            className="mt-4 px-5 py-2.5 bg-white/5 border border-white/10 text-neutral-300 rounded-full text-[11px] font-semibold tracking-wider flex items-center gap-2 transition-all hover:bg-white/10 hover:text-white"
            style={{ backdropFilter: 'blur(12px)' }}>
            <Mic size={14} /> Voice Report
          </button>
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
