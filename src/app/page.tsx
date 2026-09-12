'use client';

import { useState, useCallback } from 'react';
import { Incident } from '../types/incident';
import CitizenView from '../views/CitizenView';

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const handleIncidentCreate = useCallback((incident: Incident) => {
    setIncidents(prev => [incident, ...prev]);
  }, []);

  return <CitizenView onIncidentCreate={handleIncidentCreate} />;
}
