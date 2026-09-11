'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import SOSButton from '@/components/SOSButton';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptView from '@/components/TranscriptView';
import FirstAidPanel from '@/components/FirstAidPanel';
import UrgencyBadge from '@/components/UrgencyBadge';
import { extractEmergencyInfo } from '@/lib/gemini';
import { EmergencyReport } from '@/lib/types';
import { getFirstAid } from '@/lib/firstAid';
import { ArrowRight, RotateCcw, Zap, Mic, Bot, CheckCircle2, MapPin, Users, Clock } from 'lucide-react';

const DEMO_TRANSCRIPT = "My friend fell from the stairs. He is unconscious and bleeding from his head. We are inside the engineering building, third floor.";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<EmergencyReport | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleSOS = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setTranscript('');
      setInterimTranscript('');
      setReport(null);
      setIsRecording(true);

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
    setTranscript(textToProcess);

    try {
      const extracted = await extractEmergencyInfo(textToProcess);
      const newReport: EmergencyReport = {
        id: `report-${Date.now()}`,
        ...extracted,
        latitude: location?.lat ?? (8.2280 + Math.random() * 0.01),
        longitude: location?.lng ?? (124.2452 + Math.random() * 0.01),
        first_aid: getFirstAid(extracted.condition),
        timestamp: new Date(),
        status: 'pending',
      };

      setReport(newReport);

      const existing = JSON.parse(localStorage.getItem('agap-reports') || '[]');
      existing.unshift(newReport);
      localStorage.setItem('agap-reports', JSON.stringify(existing));

      toast.success('Report processed', {
        description: `${newReport.incident_type} • ${newReport.urgency} priority`,
      });
    } catch (err) {
      console.error('Failed to extract info:', err);
      toast.error('Failed to process report', {
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
  };

  // Report success screen
  if (report) {
    return (
      <main className="min-h-screen bg-[#0A0E17] p-4 md:p-8">
        <Toaster position="top-center" theme="dark" />
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 animate-slide-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Report Received</h1>
            <p className="text-[#9CA3AF] text-sm">Emergency services have been notified</p>
          </div>

          <Card className="bg-[#111827] border-[#374151] mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-[#1F2937] flex items-center justify-center">
                  <span className="text-2xl">{
                    report.incident_type === 'medical' ? '🏥' :
                    report.incident_type === 'fire' ? '🔥' :
                    report.incident_type === 'accident' ? '🚗' :
                    report.incident_type === 'disaster' ? '🌪️' : '📋'
                  }</span>
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg capitalize">{report.incident_type.replace('_', ' ')}</h2>
                  <p className="text-[#9CA3AF] text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {report.location_description}
                  </p>
                </div>
                <UrgencyBadge urgency={report.urgency} size="lg" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                  <p className="text-[#6B7280] text-[10px] uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Condition
                  </p>
                  <p className="font-medium text-sm capitalize mt-1">{report.condition}</p>
                </div>
                <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                  <p className="text-[#6B7280] text-[10px] uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    People Affected
                  </p>
                  <p className="font-medium text-sm mt-1">{report.people_affected}</p>
                </div>
              </div>

              <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                <p className="text-[#6B7280] text-[10px] uppercase tracking-wide mb-1">AI Urgency Reason</p>
                <p className="text-sm">{report.urgency_reason}</p>
              </div>
            </CardContent>
          </Card>

          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <FirstAidPanel instruction={report.first_aid} incidentType={report.incident_type} />
          </div>

          <Card className="mt-6 bg-[#111827] border-[#374151] animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-5">
              <h3 className="text-[#EAB308] font-bold text-sm mb-4">What Happens Next</h3>
              <div className="space-y-3">
                {[
                  { step: 1, text: 'Your report has been sent to dispatch', done: true },
                  { step: 2, text: 'AI has assessed urgency and provided first-aid guidance', done: true },
                  { step: 3, text: 'Dispatcher is reviewing your report', done: false },
                  { step: 4, text: 'Emergency responders will be dispatched', done: false },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      item.done ? 'bg-[#22C55E] text-white' : 'bg-[#374151] text-[#6B7280]'
                    }`}>
                      {item.step}
                    </div>
                    <p className={`text-sm ${item.done ? '' : 'text-[#6B7280]'}`}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center space-y-3 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <a href="/dashboard">
              <Button size="lg" className="gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white cursor-pointer w-full max-w-xs">
                View Dispatcher Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2 border-[#374151] hover:bg-[#1F2937] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Report Another Emergency
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Main landing page
  return (
    <main className="min-h-screen bg-[#0A0E17]">
      <Toaster position="top-center" theme="dark" />
      
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#374151] bg-[#111827]">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="AgapAI" className="w-8 h-8 rounded-lg" />
          <span className="text-lg font-bold">Agap<span className="text-[#EF4444]">AI</span></span>
        </div>
        <a href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer">
            Dispatcher Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </a>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12 animate-slide-up">
          <img src="/logo.jpg" alt="AgapAI Logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg" />
          <h1 className="text-5xl font-bold mb-3">
            Agap<span className="text-[#EF4444]">AI</span>
          </h1>
          <p className="text-[#9CA3AF] max-w-md">
            Your voice becomes the emergency report
          </p>
          <p className="text-[#6B7280] text-xs mt-2">IEEE SumpAI 2026 — MSU-IIT</p>
        </div>

        {/* SOS Button */}
        <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <SOSButton onClick={handleSOS} isActive={isRecording} />
        </div>

        {/* Voice Recorder */}
        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <VoiceRecorder
            onTranscript={handleTranscript}
            onInterimTranscript={handleInterimTranscript}
            isRecording={isRecording}
            onStop={() => setIsRecording(false)}
          />
        </div>

        {/* Transcript */}
        <TranscriptView
          transcript={transcript}
          interimTranscript={interimTranscript}
          isProcessing={isProcessing}
        />

        {/* Action Buttons */}
        {transcript && !isRecording && !isProcessing && (
          <div className="mt-8 flex gap-4 animate-slide-up">
            <Button
              size="lg"
              onClick={() => handleProcessReport()}
              className="gap-2 cursor-pointer px-8 bg-[#EF4444] hover:bg-[#DC2626] text-white"
            >
              <Bot className="w-5 h-5" />
              Process Report with AI
            </Button>
          </div>
        )}

        {/* Try Demo Button */}
        {!transcript && !isRecording && !isProcessing && (
          <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Button
              variant="outline"
              size="lg"
              onClick={handleTryDemo}
              className="gap-2 cursor-pointer border-[#374151] hover:bg-[#1F2937]"
            >
              <Zap className="w-4 h-4" />
              Try Demo (No mic needed)
            </Button>
            <p className="text-xs text-[#6B7280] mt-2">
              Pre-filled emergency report for demonstration
            </p>
          </div>
        )}

        {/* Feature Cards */}
        {!transcript && !isRecording && !isProcessing && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full animate-slide-up" style={{ animationDelay: '0.4s' }}>
            {[
              { icon: <Zap className="w-5 h-5" />, title: 'Tap SOS', desc: 'Instant emergency activation with one touch', color: '#EF4444' },
              { icon: <Mic className="w-5 h-5" />, title: 'Voice Report', desc: 'Describe your emergency naturally — no forms needed', color: '#3B82F6' },
              { icon: <Bot className="w-5 h-5" />, title: 'AI-Powered', desc: 'Instant triage, first-aid guidance, and structured reports', color: '#22C55E' },
            ].map((feature) => (
              <Card key={feature.title} className="bg-[#111827] border-[#374151] text-center card-hover">
                <CardContent className="pt-5 pb-5">
                  <div 
                    className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${feature.color}20`, color: feature.color }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-bold mb-1">{feature.title}</h3>
                  <p className="text-[#9CA3AF] text-sm">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
