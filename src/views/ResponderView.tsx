'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { MapPin, Clock, AlertTriangle, CheckCircle2, Navigation, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getFirstAid } from '../lib/firstAid';
import type { Incident, IncidentStatus } from '../types/incident';

const URGENCY_STYLE: Record<string, { color: string; bg: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const INCIDENT_ICONS: Record<string, string> = { FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', DISASTER: '🌪️', VIOLENCE: '⚠️', HAZARDOUS: '☢️', MISSING_PERSON: '🔍' };

export default function ResponderView() {
  const { user, signOut } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolve, setShowResolve] = useState(false);

  const fetchAssigned = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents', { cache: 'no-store' });
      const payload = await res.json();
      if (payload.success && payload.data) {
        // Filter to only incidents assigned to this responder (or all if demo mode), exclude resolved
        const assigned = payload.data.filter((i: Incident) =>
          i.status !== 'RESOLVED' && (i.assigned_responder_id === user?.id || i.status === 'DISPATCHED')
        );
        setIncidents(assigned);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAssigned();
    const t = setInterval(fetchAssigned, 10000);
    return () => clearInterval(t);
  }, [fetchAssigned]);

  const updateStatus = async (id: string, status: IncidentStatus, notes?: string) => {
    setUpdateLoading(true);
    try {
      const body: Record<string, string> = { status };
      if (notes) body.resolution_notes = notes;

      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (payload.success && payload.data) {
        setIncidents(prev => payload.data.status === 'RESOLVED'
          ? prev.filter(i => i.id !== id)
          : prev.map(i => i.id === id ? payload.data : i));
        if (selectedIncident?.id === id) setSelectedIncident(payload.data);
        toast.success(`Status updated to ${status}`);
        setShowResolve(false);
        setResolutionNotes('');
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setUpdateLoading(false);
    }
  };

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  // Detail view
  if (selectedIncident) {
    const inc = selectedIncident;
    const urgency = URGENCY_STYLE[inc.urgency || 'medium'];
    const protocol = getFirstAid((inc.condition || '') + ' ' + inc.type);

    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa' }}>
        <Toaster position="top-center" theme="dark" />
        <header style={{ height: '56px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
          <button onClick={() => { setSelectedIncident(null); setShowResolve(false); }} style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Incident Detail</span>
        </header>

        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          {/* Header card */}
          <div style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '28px' }}>{INCIDENT_ICONS[inc.type]}</span>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{inc.type.replace('_', ' ')}</h2>
                <p style={{ fontSize: '12px', color: '#71717a' }}>{inc.status} · {timeAgo(inc.timestamp)}</p>
              </div>
              <span style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: urgency.bg, color: urgency.color }}>
                {(inc.urgency || 'medium').toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: '#d4d4d8', lineHeight: 1.6, marginBottom: '12px' }}>{inc.description}</p>

            {/* Vitals */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {inc.condition && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(39,39,42,0.6)', color: '#a1a1aa' }}>Condition: {inc.condition}</span>}
              {inc.people_affected && inc.people_affected > 1 && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(39,39,42,0.6)', color: '#a1a1aa' }}>People: {inc.people_affected}</span>}
              {inc.consciousness === false && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Unconscious</span>}
              {inc.breathing === false && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Not Breathing</span>}
              {inc.bleeding && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Bleeding</span>}
            </div>

            {/* Location */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#09090b', borderRadius: '8px', marginBottom: '12px' }}>
              <MapPin size={16} style={{ color: '#3b82f6' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', color: '#d4d4d8' }}>{inc.location}</p>
                <p style={{ fontSize: '10px', color: '#52525b', fontFamily: 'monospace' }}>{inc.coordinates.lat.toFixed(4)}, {inc.coordinates.lng.toFixed(4)}</p>
              </div>
              <button onClick={() => openNavigation(inc.coordinates.lat, inc.coordinates.lng)}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Navigation size={12} /> Navigate
              </button>
            </div>

            {/* Reporter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#71717a' }}>
              <span>Reported by: <strong style={{ color: '#d4d4d8' }}>{inc.reporter}</strong></span>
            </div>
          </div>

          {/* First-aid protocol */}
          <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>🏥 FIRST-AID: {protocol.title.toUpperCase()}</p>
            <ol style={{ margin: '0 0 8px 16px', padding: 0 }}>
              {protocol.steps.map((s, i) => <li key={i} style={{ fontSize: '12px', color: '#d4d4d8', lineHeight: 1.6, marginBottom: '4px' }}>{s}</li>)}
            </ol>
            <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>{protocol.source}</p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inc.status === 'DISPATCHED' && (
              <>
                <button onClick={() => updateStatus(inc.id, 'EN_ROUTE')} disabled={updateLoading}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: '1px solid #f97316', cursor: 'pointer', background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                  En Route
                </button>
                <button onClick={() => updateStatus(inc.id, 'ARRIVED')} disabled={updateLoading}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>
                  On Scene
                </button>
              </>
            )}
            {inc.status === 'EN_ROUTE' && (
              <>
                <button onClick={() => updateStatus(inc.id, 'ARRIVED')} disabled={updateLoading}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>
                  Arrived on Scene
                </button>
                <button onClick={() => setShowResolve(true)} disabled={updateLoading}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000' }}>
                  Mark Resolved
                </button>
              </>
            )}
            {inc.status === 'ARRIVED' && (
              <button onClick={() => setShowResolve(true)} disabled={updateLoading}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000' }}>
                Mark Resolved
              </button>
            )}
            {inc.status === 'PENDING' && (
              <button onClick={() => updateStatus(inc.id, 'DISPATCHED')} disabled={updateLoading}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff' }}>
                Accept Assignment
              </button>
            )}
          </div>

          {/* Resolve form */}
          {showResolve && (
            <div style={{ marginTop: '16px', background: 'rgba(24,24,27,0.6)', border: '1px solid #27272a', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Resolution Notes</p>
              <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Describe what was done, patient outcome..."
                style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#fafafa', outline: 'none', resize: 'vertical', minHeight: '80px', marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => updateStatus(inc.id, 'RESOLVED', resolutionNotes)} disabled={updateLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000' }}>
                  Confirm Resolve
                </button>
                <button onClick={() => { setShowResolve(false); setResolutionNotes(''); }}
                  style={{ padding: '10px 16px', borderRadius: '6px', fontSize: '13px', border: '1px solid #27272a', cursor: 'pointer', background: 'transparent', color: '#71717a' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa' }}>
      <Toaster position="top-center" theme="dark" />
      <header style={{ height: '56px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Image src="/logo.jpg" alt="AgapAI" width={24} height={24} style={{ borderRadius: '6px' }} />
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Agap<span style={{ color: '#ef4444' }}>AI</span></span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>RESPONDER</span>
        </div>
        <button onClick={signOut} style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={18} /></button>
      </header>

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Assigned Incidents</h2>

        {loading ? (
          <p style={{ color: '#71717a', textAlign: 'center', padding: '40px 0' }}>Loading...</p>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#52525b' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No assigned incidents</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {incidents.map(inc => {
              const urgency = URGENCY_STYLE[inc.urgency || 'medium'];
              return (
                <div key={inc.id} onClick={() => setSelectedIncident(inc)}
                  style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', cursor: 'pointer', borderLeft: `4px solid ${urgency.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '20px' }}>{INCIDENT_ICONS[inc.type]}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700 }}>{inc.type.replace('_', ' ')}</p>
                      <p style={{ fontSize: '11px', color: '#71717a' }}>{inc.status}</p>
                    </div>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: urgency.bg, color: urgency.color }}>
                      {(inc.urgency || 'medium').toUpperCase()}
                    </span>
                    <ChevronRight size={16} style={{ color: '#52525b' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>{inc.description?.slice(0, 80)}...</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10} />{inc.location?.slice(0, 30)}</span>
                    <span style={{ fontSize: '10px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={9} />{timeAgo(inc.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
