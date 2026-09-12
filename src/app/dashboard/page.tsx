'use client';

import { useState, useEffect } from 'react';
import { Incident } from '../../types/incident';
import DispatchView from '../../views/DispatchView';

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('agap-incidents');
      if (stored) {
        setIncidents(JSON.parse(stored));
      }
    } catch (e) {
      // Use mock data
    }
  }, []);

  useEffect(() => {
    if (incidents.length > 0) {
      localStorage.setItem('agap-incidents', JSON.stringify(incidents));
    }
  }, [incidents]);

  return <DispatchView externalIncidents={incidents} />;
}
