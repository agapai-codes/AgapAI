// src/lib/firstAid.ts
// First-aid protocols based on American Red Cross guidelines.
// Source: https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies.html
// For educational/demo purposes — always call emergency services in real emergencies.

export interface FirstAidProtocol {
  title: string;
  steps: string[];
  warnings: string[];
  source: string;
}

export const firstAidProtocols: Record<string, FirstAidProtocol> = {
  severe_bleeding: {
    title: 'Severe External Bleeding',
    steps: [
      'Apply firm, direct pressure to the wound with a clean cloth or gauze.',
      'Do NOT remove the cloth — add more layers if blood soaks through.',
      'If possible, elevate the injured area above the level of the heart.',
      'Apply pressure continuously until emergency help arrives.',
      'If trained, apply a tourniquet 2-3 inches above the wound for limb bleeding that won\'t stop.',
    ],
    warnings: [
      'Do NOT remove objects embedded in a wound.',
      'Do NOT apply a tourniquet to the neck, chest, or abdomen.',
    ],
    source: 'American Red Cross — Life-Threatening External Bleeding',
  },
  unconscious: {
    title: 'Unconscious / Unresponsive Person',
    steps: [
      'Check for responsiveness — tap shoulders and shout "Are you OK?"',
      'Call emergency services immediately (911 or local number).',
      'Check for breathing — look for chest rise for no more than 10 seconds.',
      'If breathing: Place in the recovery position (on their side).',
      'If NOT breathing: Begin CPR — 30 chest compressions (2 inches deep) followed by 2 rescue breaths.',
      'Continue CPR until emergency services arrive or the person breathes on their own.',
    ],
    warnings: [
      'Do NOT leave the person face-up if they are vomiting.',
      'Do NOT attempt CPR if you are not trained — perform hands-only CPR (compressions without breaths).',
    ],
    source: 'American Red Cross — Unresponsive Person / CPR',
  },
  burns: {
    title: 'Burns and Scalds',
    steps: [
      'Cool the burn under cool (not icy) running water for at least 20 minutes.',
      'Remove rings, watches, or tight clothing from the burned area before swelling occurs.',
      'Do NOT use ice, butter, toothpaste, or other home remedies.',
      'Cover loosely with a sterile, non-stick dressing or clean cloth.',
      'Do not pop blisters — this increases infection risk.',
    ],
    warnings: [
      'For chemical burns: Flush with large amounts of water for 20+ minutes.',
      'For electrical burns: Do NOT touch the person until the electrical source is disconnected.',
      'Seek emergency care for burns larger than the person\'s palm, or on face/hands/feet/joints.',
    ],
    source: 'American Red Cross — Burns and Scalds',
  },
  fracture: {
    title: 'Suspected Fracture or Broken Bone',
    steps: [
      'Do NOT move the injured area — immobilize the limb in the position found.',
      'Apply a splint (rigid board, rolled magazine, or stick) alongside the injured area.',
      'Pad the splint with soft material for comfort.',
      'Apply a cold pack wrapped in cloth to reduce swelling (20 minutes on, 20 off).',
      'Check for circulation below the injury — pulse, warmth, sensation.',
    ],
    warnings: [
      'Do NOT attempt to realign the bone.',
      'Do NOT apply ice directly to the skin.',
      'If it is an open fracture (bone visible), cover the wound with a sterile dressing.',
    ],
    source: 'American Red Cross — Fractures and Dislocations',
  },
  choking: {
    title: 'Choking — Foreign Body Airway Obstruction',
    steps: [
      'If the person CAN cough, encourage them to keep coughing forcefully.',
      'If the person CANNOT cough, speak, or breathe:',
      'Stand behind the person. Place your fist above their navel (belly button).',
      'Grasp your fist with your other hand and perform quick, upward abdominal thrusts (Heimlich maneuver).',
      'Repeat until the object is expelled or the person becomes unconscious.',
      'If unconscious: Begin CPR (30 compressions, look in mouth for object, 2 breaths).',
    ],
    warnings: [
      'For pregnant women or obese persons: Use chest thrusts instead of abdominal thrusts.',
      'For infants (under 1 year): Use 5 back blows followed by 5 chest thrusts.',
    ],
    source: 'American Red Cross — Choking',
  },
  difficulty_breathing: {
    title: 'Difficulty Breathing / Respiratory Distress',
    steps: [
      'Help the person sit upright — do NOT let them lie down.',
      'Loosen tight clothing around the neck and chest.',
      'If the person has an inhaler or prescribed medication, help them use it.',
      'Keep the person calm and speaking in short sentences.',
      'If lips or fingernails turn blue, or the person becomes unresponsive: Begin CPR.',
    ],
    warnings: [
      'Do NOT give food or water if the person is struggling to breathe.',
      'If breathing stops, call emergency services immediately and begin CPR.',
    ],
    source: 'American Red Cross — Breathing Emergencies',
  },
  chest_pain: {
    title: 'Chest Pain / Suspected Heart Attack',
    steps: [
      'Call emergency services immediately — do NOT delay.',
      'Help the person sit in a comfortable position (usually upright with knees bent).',
      'Loosen tight clothing.',
      'If the person has prescribed nitroglycerin, help them take it.',
      'If the person is responsive and not allergic to aspirin, give 1 adult aspirin (325 mg) or 4 baby aspirin (81 mg each) to chew.',
      'If the person becomes unresponsive and stops breathing: Begin CPR.',
    ],
    warnings: [
      'Do NOT let the person walk around or exert themselves.',
      'If aspirin allergy is known, do NOT give aspirin.',
    ],
    source: 'American Red Cross — Heart Attack and Cardiac Arrest',
  },
  drowning: {
    title: 'Drowning / Water Emergency',
    steps: [
      'Remove the person from water ONLY if you can do so safely.',
      'Call emergency services immediately.',
      'Check for breathing.',
      'If NOT breathing: Begin CPR immediately (30 compressions, 2 breaths).',
      'If breathing: Place in the recovery position (on their side) and keep warm.',
      'Continue until emergency services arrive.',
    ],
    warnings: [
      'Do NOT attempt rescue if you are not trained — throw a rope or flotation device instead.',
      'Do NOT perform CPR in the water if you can get the person to shore.',
      'Even if the person appears fine, always seek medical evaluation after submersion.',
    ],
    source: 'American Red Cross — Drowning',
  },
  heatstroke: {
    title: 'Heatstroke / Heat-Related Emergency',
    steps: [
      'Move the person to a cool, shaded or air-conditioned area immediately.',
      'Remove excess clothing.',
      'Cool the person rapidly: fan while misting with water, or apply ice packs to neck, armpits, and groin.',
      'If the person is conscious and not vomiting, give cool water to sip.',
      'If the person is unconscious, do NOT give fluids — place in recovery position.',
    ],
    warnings: [
      'Heatstroke is a life-threatening emergency — always call for help.',
      'Do NOT give aspirin or acetaminophen — these can worsen heat-related illness.',
    ],
    source: 'American Red Cross — Heatstroke',
  },
  poisoning: {
    title: 'Poisoning / Ingested Substance',
    steps: [
      'Call Poison Control or emergency services immediately.',
      'Try to identify the substance (name, amount, time ingested).',
      'Do NOT induce vomiting unless specifically instructed by a professional.',
      'If the person is unconscious but breathing, place in the recovery position.',
      'Keep the container or substance for responders to identify.',
    ],
    warnings: [
      'Do NOT give food, water, or milk unless directed by Poison Control.',
      'If the substance is on the skin: Remove contaminated clothing and flush with water for 15+ minutes.',
      'If the substance is in the eyes: Flush with clean water for 15+ minutes.',
    ],
    source: 'American Red Cross — Poisoning',
  },
  earthquake_injury: {
    title: 'Earthquake-Related Injury',
    steps: [
      'Control any visible bleeding with direct pressure using a clean cloth.',
      'Immobilize suspected fractures — do NOT move the person if spine injury is suspected.',
      'Keep the person calm and still.',
      'Cover with a blanket to prevent shock.',
      'If the person is trapped, do NOT attempt to move heavy debris — clear the airway if possible and wait for rescue.',
    ],
    warnings: [
      'Do NOT move a person with a suspected spinal injury.',
      'If aftershocks are possible, protect yourself and the person from falling debris.',
    ],
    source: 'American Red Cross — Earthquakes',
  },
  flood_exposure: {
    title: 'Flood Exposure / Hypothermia Risk',
    steps: [
      'Remove wet clothing immediately.',
      'Wrap in dry blankets or towels.',
      'Keep the person warm — focus on the head, neck, and chest.',
      'If shivering is present, give warm (not hot) fluids if the person is conscious.',
      'If the person is confused or unresponsive, keep them still and warm until help arrives.',
    ],
    warnings: [
      'Do NOT rub or massage the skin — this can cause cardiac arrest in severe hypothermia.',
      'Do NOT use direct heat (heating pads, fires) on hypothermic skin.',
    ],
    source: 'American Red Cross — Floods and Flash Floods',
  },
  electric_shock: {
    title: 'Electrical Shock / Lightning',
    steps: [
      'Do NOT touch the person if they are still in contact with the electrical source.',
      'Call emergency services.',
      'If safe to do so, turn off the power source or move the person away using a dry, non-conductive object.',
      'Check for breathing and pulse.',
      'If not breathing: Begin CPR.',
      'If breathing: Monitor and keep the person still.',
    ],
    warnings: [
      'Do NOT use metallic or wet objects to separate the person from the source.',
      'Electrical burns may appear minor on the surface — always seek medical evaluation.',
    ],
    source: 'American Red Cross — Electrical Shock and Lightning',
  },
  trauma_head: {
    title: 'Head / Brain Injury',
    steps: [
      'Call emergency services immediately for any head injury with loss of consciousness.',
      'Keep the person still — minimize movement of the head and neck.',
      'If vomiting, gently turn the person on their side (recovery position).',
      'Apply gentle pressure with a clean cloth to control any scalp bleeding.',
      'Do NOT remove any object embedded in the head.',
      'Monitor consciousness — try to keep the person awake and talking.',
    ],
    warnings: [
      'Do NOT remove a helmet if the person is wearing one.',
      'Do NOT give aspirin or ibuprofen — these can increase bleeding.',
      'Seek emergency care even if symptoms seem minor — brain injuries can worsen over hours.',
    ],
    source: 'American Red Cross — Head and Brain Injuries',
  },
  default: {
    title: 'General Emergency',
    steps: [
      'Ensure the scene is safe — do NOT become a second victim.',
      'Call emergency services immediately.',
      'Keep the person calm and still.',
      'Do not give food or water.',
      'Monitor the person\'s condition continuously.',
      'Stay with them until emergency help arrives.',
    ],
    warnings: [
      'Always follow instructions from the emergency dispatcher.',
      'Do NOT move the person unless they are in immediate danger.',
    ],
    source: 'American Red Cross — General Emergency Guidelines',
  },
};

export function getFirstAid(condition: string): FirstAidProtocol {
  const lower = condition.toLowerCase();
  if (lower.includes('bleeding') || lower.includes('blood') || lower.includes('wound')) return firstAidProtocols['severe_bleeding'];
  if (lower.includes('unconscious') || lower.includes('unresponsive') || lower.includes('fainted')) return firstAidProtocols['unconscious'];
  if (lower.includes('head') || lower.includes('brain') || lower.includes('concussion') || lower.includes('skull')) return firstAidProtocols['trauma_head'];
  if (lower.includes('burn') || lower.includes('scald')) return firstAidProtocols['burns'];
  if (lower.includes('fracture') || lower.includes('broken') || lower.includes('sprain') || lower.includes('bone')) return firstAidProtocols['fracture'];
  if (lower.includes('choking')) return firstAidProtocols['choking'];
  if (lower.includes('breathing') || lower.includes('asthma') || lower.includes('respiratory')) return firstAidProtocols['difficulty_breathing'];
  if (lower.includes('chest') || lower.includes('heart') || lower.includes('cardiac')) return firstAidProtocols['chest_pain'];
  if (lower.includes('drowning') || lower.includes('submerged')) return firstAidProtocols['drowning'];
  if (lower.includes('heat') || lower.includes('dehydrated') || lower.includes('sunstroke')) return firstAidProtocols['heatstroke'];
  if (lower.includes('poison') || lower.includes('ingested') || lower.includes('overdose')) return firstAidProtocols['poisoning'];
  if (lower.includes('earthquake') || lower.includes('trapped') || lower.includes('collapsed') || lower.includes('rubble')) return firstAidProtocols['earthquake_injury'];
  if (lower.includes('flood') || lower.includes('wet') || lower.includes('exposed')) return firstAidProtocols['flood_exposure'];
  if (lower.includes('electric') || lower.includes('shock') || lower.includes('lightning')) return firstAidProtocols['electric_shock'];
  return firstAidProtocols['default'];
}

// Simple string version for quick display
export function getFirstAidText(condition: string): string {
  const protocol = getFirstAid(condition);
  return `${protocol.title}\n\n${protocol.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n⚠ Warnings:\n${protocol.warnings.map(w => `• ${w}`).join('\n')}\n\nSource: ${protocol.source}`;
}
