import { EmergencyReport } from './types';
import { getFirstAid } from './firstAid';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const EXTRACTION_PROMPT = `You are an emergency triage AI for an emergency response system. Given a voice transcript from someone reporting an emergency, extract structured information.

Return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "incident_type": "one of: medical, accident, fire, violence, hazardous, missing_person, disaster, other",
  "condition": "brief description of the person's condition (e.g., unconscious, bleeding, breathing difficulty, burned, fractured, pain, trapped)",
  "location_description": "the location as described by the speaker (building, room, floor, landmark, nearby reference)",
  "people_affected": number (how many people need help),
  "hazards": ["list", "of", "reported", "hazards"],
  "urgency": "one of: critical, high, medium, low",
  "urgency_reason": "brief explanation of why this urgency level"
}

Rules:
- If someone is unconscious, bleeding heavily, not breathing, or trapped → urgency is "critical"
- If someone is injured but conscious and stable → urgency is "high"
- If minor injury, no immediate danger → urgency is "medium"
- If precautionary report, no injury → urgency is "low"
- Be conservative: when in doubt, assign higher urgency
- Extract location even if vague ("near the building with the blue sign")

Transcript: "`;

export async function extractEmergencyInfo(transcript: string): Promise<Omit<EmergencyReport, 'id' | 'timestamp' | 'status' | 'first_aid' | 'latitude' | 'longitude'>> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: EXTRACTION_PROMPT + transcript + '"' }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Validate response structure
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    throw new Error('Invalid API response structure');
  }
  
  const text = data.candidates[0].content.parts[0].text;
  if (!text) {
    throw new Error('Empty response from AI');
  }

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response');

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!parsed.incident_type || !parsed.condition || !parsed.urgency) {
    throw new Error('AI response missing required fields');
  }

  return {
    transcript,
    incident_type: parsed.incident_type || 'other',
    condition: parsed.condition || 'unknown',
    location_description: parsed.location_description || 'location unknown',
    people_affected: parsed.people_affected || 1,
    hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
    urgency: ['critical', 'high', 'medium', 'low'].includes(parsed.urgency) ? parsed.urgency : 'medium',
    urgency_reason: parsed.urgency_reason || 'Unable to determine urgency',
  };
}
