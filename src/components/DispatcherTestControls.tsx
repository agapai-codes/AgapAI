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
        type="button"
        onClick={handlePurge}
        disabled={loading}
        className="btn btn-sm btn-outline text-[var(--critical)] hover:border-[var(--critical)] hover:bg-[color-mix(in_srgb,var(--critical)_12%,transparent)]"
      >
        {loading ? 'Purging…' : 'Reset to 0'}
      </button>
      <button
        type="button"
        onClick={handleLoadDemos}
        className="btn btn-sm btn-quiet"
      >
        Load Demos
      </button>
    </div>
  );
};

export default DispatcherTestControls;
