'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import SOSButton from '@/components/SOSButton';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptView from '@/components/TranscriptView';
import FirstAidPanel from '@/components/FirstAidPanel';
import UrgencyBadge from '@/components/UrgencyBadge';
import { extractEmergencyInfo } from '@/lib/gemini';
import { EmergencyReport } from '@/lib/types';
import { getFirstAid } from '@/lib/firstAid';
import { ArrowRight, RotateCcw, Zap, Mic, Bot, CheckCircle2, MapPin, Users, Clock, Radio, Shield, AlertTriangle } from 'lucide-react';

const DEMO_TRANSCRIPT = "My friend fell from the stairs. He is unconscious and bleeding from his head. We are inside the engineering building, third floor.";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [report, setReport] = useState<EmergencyReport | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [systemStatus, setSystemStatus] = useState<'online' | 'processing' | 'offline'>('online');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSOS = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      setSystemStatus('online');
    } else {
      setTranscript('');
      setInterimTranscript('');
      setReport(null);
      setIsRecording(true);
      setSystemStatus('processing');

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => setLocation(null)
        );
      }
    }
  }, [isRecording]);

  const handleTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    setInterimTranscript(text);
  }, []);

  const handleProcessReport = useCallback(async (customTranscript?: string) => {
    const textToProcess = customTranscript || transcript;
    if (!textToProcess.trim()) return;

    setIsRecording(false);
    setIsProcessing(true);
    setProcessingProgress(0);
    setSystemStatus('processing');
    setTranscript(textToProcess);

    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 300);

    try {
      const extracted = await extractEmergencyInfo(textToProcess);
      clearInterval(progressInterval);
      setProcessingProgress(100);

      const newReport: EmergencyReport = {
        id: `RPT-${Date.now().toString(36).toUpperCase()}`,
        ...extracted,
        latitude: location?.lat ?? (8.2280 + Math.random() * 0.01),
        longitude: location?.lng ?? (124.2452 + Math.random() * 0.01),
        first_aid: getFirstAid(extracted.condition),
        timestamp: new Date(),
        status: 'pending',
      };

      setReport(newReport);
      setSystemStatus('online');

      try {
        const existing = JSON.parse(localStorage.getItem('agap-reports') || '[]');
        existing.unshift(newReport);
        localStorage.setItem('agap-reports', JSON.stringify(existing));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }

      toast.success('REPORT PROCESSED', {
        description: `${newReport.incident_type.toUpperCase()} | ${newReport.urgency.toUpperCase()} PRIORITY`,
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Failed to extract info:', err);
      setSystemStatus('online');
      toast.error('PROCESSING FAILED', {
        description: 'Please try again or call emergency services.',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, location]);

  const handleTryDemo = () => {
    handleProcessReport(DEMO_TRANSCRIPT);
  };

  const handleReset = () => {
    setReport(null);
    setTranscript('');
    setInterimTranscript('');
    setSystemStatus('online');
  };

  if (report) {
    return (
      <main className="min-h-screen bg-[#080C14]">
        <Toaster position="top-center" theme="dark" />

        <header className="border-b border-[#1E3A5F] bg-[#0F1520] px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} className="object-contain" />
              <div>
                <span className="font-bold text-lg tracking-tight">AGAP<span className="text-[#DC2626]">AI</span></span>
                <span className="text-[#6B7280] text-xs ml-2 mono">REPORT GENERATED</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[#10B981] text-xs mono">ONLINE</span>
              </div>
              {mounted && <span className="text-[#6B7280] text-xs mono">{currentTime}</span>}
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="mb-6 p-4 bg-[#10B981]/10 border border-[#10B981]/30 flex items-center gap-4 animate-slide-up">
            <CheckCircle2 className="w-6 h-6 text-[#10B981] shrink-0" />
            <div>
              <p className="text-[#10B981] font-bold text-sm">REPORT SUCCESSFULLY GENERATED</p>
              <p className="text-[#9CA3AF] text-xs mt-1">ID: {report.id} | {new Date(report.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <Card className="tactical-card mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-0">
              <div className="p-4 border-b border-[#1E3A5F] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#1C2738] flex items-center justify-center border border-[#1E3A5F]">
                    <span className="text-2xl" aria-hidden="true">{
                      report.incident_type === 'medical' ? '🏥' :
                      report.incident_type === 'fire' ? '🔥' :
                      report.incident_type === 'accident' ? '🚗' :
                      report.incident_type === 'disaster' ? '🌪️' : '📋'
                    }</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg uppercase tracking-wide">{report.incident_type.replace('_', ' ')}</h2>
                    <p className="text-[#9CA3AF] text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {report.location_description}
                    </p>
                  </div>
                </div>
                <UrgencyBadge urgency={report.urgency} size="lg" />
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                  <p className="data-label flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3" />
                    Condition
                  </p>
                  <p className="font-medium text-sm capitalize">{report.condition}</p>
                </div>
                <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                  <p className="data-label flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3" />
                    People Affected
                  </p>
                  <p className="font-medium text-sm mono">{report.people_affected}</p>
                </div>
                <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                  <p className="data-label flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Hazards
                  </p>
                  <p className="font-medium text-sm">{report.hazards.length > 0 ? report.hazards.length : 'None'}</p>
                </div>
                <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                  <p className="data-label flex items-center gap-1 mb-1">
                    <Radio className="w-3 h-3" />
                    Status
                  </p>
                  <p className="font-medium text-sm text-[#F59E0B] uppercase">{report.status}</p>
                </div>
              </div>

              <div className="p-4 border-t border-[#1E3A5F]">
                <p className="data-label mb-2">AI URGENCY ASSESSMENT</p>
                <p className="text-sm text-[#9CA3AF]">{report.urgency_reason}</p>
              </div>
            </CardContent>
          </Card>

          <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <FirstAidPanel instruction={report.first_aid} />
          </div>

          <Card className="tactical-card mb-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-4">
              <p className="data-label mb-4">PROCESSING STATUS</p>
              <div className="space-y-4">
                {[
                  { step: 1, text: 'Voice report captured', done: true },
                  { step: 2, text: 'AI analysis complete', done: true },
                  { step: 3, text: 'Report sent to dispatch', done: true },
                  { step: 4, text: 'Dispatcher review pending', done: false },
                  { step: 5, text: 'Emergency response', done: false },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold mono ${
                      item.done ? 'bg-[#10B981] text-white' : 'bg-[#1C2738] text-[#6B7280] border border-[#1E3A5F]'
                    }`}>
                      {item.done ? '✓' : item.step}
                    </div>
                    <p className={`text-sm ${item.done ? 'text-[#F9FAFB]' : 'text-[#6B7280]'}`}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <a href="/dashboard" className="flex-1">
              <Button className="w-full gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white cursor-pointer h-11 rounded-none">
                <Shield className="w-4 h-4" />
                DISPATCHER DASHBOARD
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2 border-[#1E3A5F] hover:bg-[#1C2738] cursor-pointer h-11 rounded-none"
            >
              <RotateCcw className="w-4 h-4" />
              NEW REPORT
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080C14]">
      <Toaster position="top-center" theme="dark" />

      <header className="border-b border-[#1E3A5F] bg-[#0F1520] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="AgapAI" width={32} height={32} className="object-contain" />
            <div>
              <span className="font-bold text-lg tracking-tight">AGAP<span className="text-[#DC2626]">AI</span></span>
              <span className="text-[#6B7280] text-xs ml-2 hidden sm:inline">EMERGENCY RESPONSE</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#10B981]/10 border border-[#10B981]/30">
              <div className={`w-2 h-2 rounded-full ${systemStatus === 'online' ? 'bg-[#10B981]' : systemStatus === 'processing' ? 'bg-[#F59E0B] animate-pulse' : 'bg-[#DC2626]'}`} />
              <span className={`text-xs mono ${systemStatus === 'online' ? 'text-[#10B981]' : systemStatus === 'processing' ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>
                {systemStatus.toUpperCase()}
              </span>
            </div>
            {mounted && <span className="text-[#6B7280] text-xs mono hidden sm:block">{currentTime}</span>}
            <a href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer rounded-none">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">DASHBOARD</span>
              </Button>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-8 animate-slide-up">
          <Image src="/logo.jpg" alt="AgapAI" width={64} height={64} className="mx-auto mb-4 object-contain" />
          <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">
            AGAP<span className="text-[#DC2626]">AI</span>
          </h1>
          <p className="text-[#9CA3AF] text-base max-w-md mx-auto">
            EMERGENCY RESPONSE COMMAND CENTER
          </p>
          <p className="text-[#6B7280] text-xs mt-1">Your voice is the emergency report</p>
          <p className="text-[#6B7280] text-[10px] mono mt-1">IEEE SumpAI 2026 — MSU-IIT</p>
        </div>

        <div className="flex flex-col items-center mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <SOSButton onClick={handleSOS} isActive={isRecording} />
          <div className="mt-4 flex items-center gap-3 text-sm">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-[#DC2626] animate-pulse' : 'bg-[#6B7280]'}`} />
            <span className="text-[#9CA3AF] mono">
              {isRecording ? 'RECORDING — SPEAK NOW' : 'TAP TO ACTIVATE'}
            </span>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <VoiceRecorder
            onTranscript={handleTranscript}
            onInterimTranscript={handleInterimTranscript}
            isRecording={isRecording}
            onStop={() => setIsRecording(false)}
          />
        </div>

        {isProcessing && (
          <div className="max-w-2xl mx-auto mt-6 animate-fade-in">
            <div className="bg-[#0F1520] border border-[#1E3A5F] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="data-label">PROCESSING REPORT</span>
                <span className="text-xs mono text-[#F59E0B]">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-1 bg-[#1C2738]" />
            </div>
          </div>
        )}

        <TranscriptView
          transcript={transcript}
          interimTranscript={interimTranscript}
          isProcessing={isProcessing}
        />

        {transcript && !isRecording && !isProcessing && (
          <div className="max-w-2xl mx-auto mt-6 flex gap-3 animate-slide-up">
            <Button
              size="lg"
              onClick={() => handleProcessReport()}
              className="gap-2 cursor-pointer px-8 bg-[#DC2626] hover:bg-[#B91C1C] text-white h-12 rounded-none"
            >
              <Bot className="w-5 h-5" />
              PROCESS WITH AI
            </Button>
          </div>
        )}

        {!transcript && !isRecording && !isProcessing && (
          <div className="text-center mt-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Button
              variant="outline"
              size="lg"
              onClick={handleTryDemo}
              className="gap-2 cursor-pointer border-[#1E3A5F] hover:bg-[#1C2738] h-11 rounded-none"
            >
              <Zap className="w-4 h-4" />
              RUN DEMO SCENARIO
            </Button>
            <p className="text-xs text-[#6B7280] mt-2 mono">
              Pre-loaded emergency report for demonstration
            </p>
          </div>
        )}

        {!transcript && !isRecording && !isProcessing && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            {[
              { icon: <Zap className="w-5 h-5" />, title: 'TAP SOS', desc: 'Instant emergency activation', status: 'READY', color: '#DC2626' },
              { icon: <Mic className="w-5 h-5" />, title: 'VOICE REPORT', desc: 'Natural speech input', status: 'READY', color: '#3B82F6' },
              { icon: <Bot className="w-5 h-5" />, title: 'AI TRIAGE', desc: 'Real-time analysis', status: 'READY', color: '#10B981' },
            ].map((feature) => (
              <div key={feature.title} className="tactical-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 flex items-center justify-center border border-[#1E3A5F]" style={{ color: feature.color }}>
                    {feature.icon}
                  </div>
                  <span className="text-[10px] mono text-[#10B981] px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30">
                    {feature.status}
                  </span>
                </div>
                <h3 className="font-bold text-sm mb-1 tracking-wide">{feature.title}</h3>
                <p className="text-[#6B7280] text-xs">{feature.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
