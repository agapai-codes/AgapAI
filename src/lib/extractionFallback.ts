// src/lib/extractionFallback.ts
// Keyword-based incident extraction used when Gemini is unavailable.
// Keeps triage functional so the demo never breaks on an API failure.

import type { IncidentType } from '../types/incident';

export interface ExtractedInfo {
  incident_type: IncidentType;
  condition: string;
  location_description: string;
  people_affected: number;
  hazards: string[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgency_reason: string;
}

function detectType(text: string): IncidentType {
  if (/(fire|burning|smoke|flames|wildfire|arson)/.test(text)) return 'FIRE';
  if (/(accident|collision|crash|vehicle|tricycle|car|motorcycle|motor)/.test(text)) return 'ACCIDENT';
  if (/(flood|earthquake|typhoon|landslide|storm|volcano|tsunami|disaster|evacuat)/.test(text)) return 'DISASTER';
  if (/(gun|stab|assault|fight|weapon|shooting|shot|knife|attack|robbery|violence)/.test(text)) return 'VIOLENCE';
  if (/(chemical|gas leak|toxic|hazmat|radiation|spill|hazardous)/.test(text)) return 'HAZARDOUS';
  if (/(missing|lost|cannot find|disappeared|looking for)/.test(text)) return 'MISSING_PERSON';
  return 'MEDICAL';
}

function detectCondition(text: string): string {
  const parts: string[] = [];
  if (/(unconscious|unresponsive|passed out|fainted)/.test(text)) parts.push('unconscious');
  if (/(bleed|blood)/.test(text)) parts.push('bleeding');
  if (/(not breathing|can'?t breathe|difficulty breathing|short of breath|gasping)/.test(text)) parts.push('breathing difficulty');
  if (/(chest pain|heart attack|cardiac)/.test(text)) parts.push('chest pain');
  if (/(burn)/.test(text)) parts.push('burns');
  if (/(fracture|broken|can'?t move|deformed)/.test(text)) parts.push('possible fracture');
  if (/(trapped|stuck|pinned)/.test(text)) parts.push('trapped');
  if (/(pain|hurts|hurting)/.test(text)) parts.push('pain');
  if (/(head injury|head wound|hit head|skull)/.test(text)) parts.push('head injury');
  if (/(shot|stab|wound)/.test(text)) parts.push('trauma wound');
  return parts.length > 0 ? parts.join(', ') : 'unknown condition';
}

function detectLocation(text: string): string {
  const m = text.match(/(?:at|in|inside|near|on|by)\s+(?:the\s+)?([a-z0-9][a-z0-9\s,.'-]{2,60})/i);
  if (m) return m[1].trim();
  return 'location not specified';
}

function detectPeople(text: string): number {
  const digit = text.match(/(\d+)\s+(?:people|persons?|victims?|injured|affected|of us|children)/i);
  if (digit) return Math.min(parseInt(digit[1], 10), 1000);
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, several: 3, many: 5 };
  for (const [word, n] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return n;
  }
  return 1;
}

function detectHazards(text: string): string[] {
  const hazards: string[] = [];
  if (/(fire|smoke|flames)/.test(text)) hazards.push('fire/smoke');
  if (/(flood|water rising|floodwater)/.test(text)) hazards.push('rising water');
  if (/(trapped|stuck)/.test(text)) hazards.push('trapped victim');
  if (/(electric|live wire|power line)/.test(text)) hazards.push('electrical hazard');
  if (/(gas|chemical|toxic|hazmat)/.test(text)) hazards.push('hazardous material');
  if (/(collapse|structural|debris)/.test(text)) hazards.push('structural damage');
  if (/(gun|weapon|knife|shooter)/.test(text)) hazards.push('armed individual');
  return hazards;
}

export function extractFallback(transcript: string): ExtractedInfo {
  const text = transcript.toLowerCase();
  const incident_type = detectType(text);
  const condition = detectCondition(text);
  const hazards = detectHazards(text);
  const people_affected = detectPeople(text);
  const location_description = detectLocation(transcript);

  const critical = /(unconscious|not breathing|severe bleeding|bleeding heavily|trapped|cardiac|heart attack|chest pain)/.test(text);
  const high = /(bleed|burn|fracture|broken|difficulty breathing|injur|shot|stab)/.test(text);

  let urgency: ExtractedInfo['urgency'] = 'medium';
  let urgency_reason = 'Minor or precautionary report; no immediate life threat detected.';
  if (critical) {
    urgency = 'critical';
    urgency_reason = 'Life-threatening indicators detected (unconsciousness, severe bleeding, breathing failure, or entrapment).';
  } else if (high) {
    urgency = 'high';
    urgency_reason = 'Injury requiring prompt attention; victim appears conscious.';
  }

  return { incident_type, condition, location_description, people_affected, hazards, urgency, urgency_reason };
}
