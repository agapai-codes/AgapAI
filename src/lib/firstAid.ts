export const firstAidProtocols: Record<string, string> = {
  'severe_bleeding': 'Apply firm, direct pressure to the wound with a clean cloth. Do NOT remove the cloth. Keep the person lying down. Elevate the injured area above the heart if possible. Apply pressure continuously until help arrives.',
  'unconscious': 'Check if the person is breathing. If breathing, place in recovery position (on their side). If NOT breathing, begin CPR immediately: 30 chest compressions followed by 2 rescue breaths. Continue until help arrives.',
  'burns': 'Cool the burn under cool running water for at least 20 minutes. Do NOT use ice. Do NOT remove clothing stuck to the burn. Cover loosely with a clean dressing. Do not apply creams or oils.',
  'fracture': 'Do NOT move the injured area. Immobilize the limb using a splint if available. Apply ice wrapped in cloth to reduce swelling. Keep the person calm and still until help arrives.',
  'choking': 'If the person can cough, encourage them to keep coughing. If they CANNOT cough or breathe: Stand behind them, place your fist above their navel, and perform quick upward abdominal thrusts (Heimlich maneuver). Repeat until the object is expelled or help arrives.',
  'difficulty_breathing': 'Help the person sit upright (do NOT let them lie down). Loosen tight clothing. If they have an inhaler, help them use it. Keep them calm. If lips turn blue or they become unresponsive, begin CPR.',
  'drowning': 'Remove the person from water if safe to do so. Check for breathing. If not breathing, begin CPR immediately. If breathing, place in recovery position. Keep the person warm. Continue until help arrives.',
  'heatstroke': 'Move the person to a cool, shaded area. Remove excess clothing. Cool rapidly by fanning and applying cool water to skin. Do NOT give fluids if unconscious. Call emergency services immediately.',
  'earthquake_injury': 'Control any bleeding with direct pressure. Immobilize suspected fractures — do NOT move the person if spine injury is suspected. Keep the person calm and still. Cover with a blanket to prevent shock.',
  'flood_exposure': 'Remove wet clothing immediately. Wrap in dry blankets or towels. Keep the person warm. If they show signs of hypothermia (shivering, confusion), keep them still and warm until help arrives.',
  'electric_shock': 'Do NOT touch the person if they are still in contact with the electrical source. Call emergency services. If safe, move the person away from the source. Check breathing — begin CPR if needed.',
  'poisoning': 'Do NOT induce vomiting. Call poison control or emergency services immediately. Try to identify the substance. Keep the container or substance for responders. Keep the person calm and monitor breathing.',
  'chest_pain': 'Help the person sit in a comfortable position (usually upright). Loosen tight clothing. If they have prescribed medication (e.g., nitroglycerin), help them take it. If pain persists, begin CPR.',
  'default': 'Keep the person calm and still. Do not give food or water. Monitor their condition. Stay with them until emergency help arrives. Follow any instructions from the emergency dispatcher.'
};

export function getFirstAid(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('bleeding') || lower.includes('blood')) return firstAidProtocols['severe_bleeding'];
  if (lower.includes('unconscious') || lower.includes('unresponsive')) return firstAidProtocols['unconscious'];
  if (lower.includes('burn') || lower.includes('scald')) return firstAidProtocols['burns'];
  if (lower.includes('fracture') || lower.includes('broken') || lower.includes('sprain')) return firstAidProtocols['fracture'];
  if (lower.includes('choking')) return firstAidProtocols['choking'];
  if (lower.includes('breathing') || lower.includes('asthma')) return firstAidProtocols['difficulty_breathing'];
  if (lower.includes('drowning') || lower.includes('submerged')) return firstAidProtocols['drowning'];
  if (lower.includes('heat') || lower.includes('stroke') || lower.includes('dehydrated')) return firstAidProtocols['heatstroke'];
  if (lower.includes('earthquake') || lower.includes('trapped') || lower.includes('collapsed')) return firstAidProtocols['earthquake_injury'];
  if (lower.includes('flood') || lower.includes('wet') || lower.includes('exposed')) return firstAidProtocols['flood_exposure'];
  if (lower.includes('electric') || lower.includes('shock')) return firstAidProtocols['electric_shock'];
  if (lower.includes('poison') || lower.includes('ingested')) return firstAidProtocols['poisoning'];
  if (lower.includes('chest') || lower.includes('heart')) return firstAidProtocols['chest_pain'];
  return firstAidProtocols['default'];
}
