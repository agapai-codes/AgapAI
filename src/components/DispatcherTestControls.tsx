'use client';

import React, { useState } from 'react';
import { SIMULATION_DEMO_INCIDENTS, purgeAllIncidents } from '../utils/incidentTestingSuite';
import type { Incident } from '../types/incident';
import { reportToIncident } from '../types/incident';

interface DispatcherTestControlsProps {
  onPurge: () => void;
  onLoadDemos: (incidents: Incident[]) => void;
}

export const DispatcherTestControls: React.FC<DispatcherTestControlsProps> = ({
  onPurge,
  onLoadDemos,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePurge = async () => {
    if (!confirm('Purge all incidents and reset dashboard to 0?')) return;
    setLoading(true);
    const success = await purgeAllIncidents();
    if (success) {
      onPurge();
    }
    setLoading(false);
  };

  const handleLoadDemos = () => {
    const demoIncidents = SIMULATION_DEMO_INCIDENTS.map(r => reportToIncident(r));
    onLoadDemos(demoIncidents);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePurge}
        disabled={loading}
        className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
      >
        {loading ? 'Purging...' : 'Reset to 0'}
      </button>
      <button
        onClick={handleLoadDemos}
        className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 rounded text-[10px] font-bold tracking-wider uppercase transition-colors"
      >
        Load Demos
      </button>
    </div>
  );
};

export default DispatcherTestControls;
