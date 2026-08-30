/* ══════════════════════════════════════════
   NEJstudios — Seed curriculum
   Beginner foundations, segmented one topic
   per class and paced across 6 weeks
   (14 classes, two a week).
   Once a tutor edits anything, the saved
   version on the server takes over.
   ══════════════════════════════════════════ */
window.NEJ_CURRICULUM = {
  programme: {
    title: 'The NEJ Photography Programme',
    duration: 'Beginner foundations: 14 classes over 6 weeks, two classes a week',
    philosophy: [
      ['Accessibility first',    'Every lesson is taught with tools you already have: a smartphone camera and basic equipment.'],
      ['Incremental complexity', 'One skill at a time. Master it before moving on.'],
      ['Immediate application',  'Every theory lesson comes with a practical project.'],
      ['Creative expression',    'Technical skill serves creative vision, not the other way round.'],
      ['Business ready',         'Foundational business thinking is built in from day one.'],
    ],
    structure: [
      ['Beginner',  '6 weeks · Foundations, 14 classes'],
      ['Mid-level', '12 weeks · Specialisation and application'],
      ['Capstone',  '2 – 4 weeks · Real-world client work'],
    ],
  },

  photography: [
    /* ── WEEK 1 · Camera as a tool: what does a camera actually do? ── */
    {
      id: 'pc01', level: 'Beginner', week: 1, module: 'Camera as a Tool',
      title: 'The exposure triangle',
      desc: 'How aperture, shutter speed and ISO work together.',
      objectives: [
        'How aperture controls depth (f/1.4 vs f/16)',
        'How shutter speed freezes or blurs motion',
        'How ISO controls light sensitivity, and noise',
        'The same scene at different settings, side by side',
      ],
      projects: [{ name: 'Exposure study', brief: 'Photograph the same subject at 9 different exposure settings (3 apertures × 3 shutter speeds). Write what changed and why.' }],
      tools: ['Smartphone camera or a basic DSLR / mirrorless', 'Notebook for observations'],
    },
    {
      id: 'pc02', level: 'Beginner', week: 1, module: 'Camera as a Tool',
      title: 'Light: the currency of photography',
      desc: 'Learning to see light the way a photographer does.',
      objectives: [
        'How photographers see light differently',
        'Golden hour, blue hour, harsh midday light',
        'Hard vs soft light, and directional quality',
        'Light reading (metering)',
      ],
      projects: [{ name: 'Light scavenger hunt', brief: 'Find and photograph 5 different types of light quality (hard, soft, side, backlit, underlit) in your environment in one day.' }],
      tools: ['Natural light, no extra equipment needed'],
    },
    {
      id: 'pc03', level: 'Beginner', week: 2, module: 'Camera as a Tool',
      title: 'Using what you have',
      desc: 'Your phone is a real camera. Creative vision comes before equipment.',
      objectives: [
        'Smartphone camera basics (iPhone and Android)',
        'Built-in Pro modes: manual exposure on phones',
        'When a phone is enough, and when to upgrade',
        'Why limitations breed creativity',
      ],
      projects: [{ name: 'Phone-only set', brief: 'Shoot a set of 10 images on your phone alone, using manual settings for every frame.' }],
      tools: ['Smartphone with a Pro or manual mode'],
    },

    /* ── WEEK 2–3 · Composition and frame: why do some photos stop people? ── */
    {
      id: 'pc04', level: 'Beginner', week: 2, module: 'Composition & Frame',
      title: 'Rule of thirds and beyond',
      desc: 'Why the rules exist, and when to break them.',
      objectives: [
        'Why the rule exists: visual balance, tension, rhythm',
        'The rule of thirds grid, and why it is not gospel',
        'Leading lines and visual pathways',
        'Golden ratio (Fibonacci spiral)',
      ],
      projects: [{ name: 'Composition variations', brief: 'Photograph one subject using 5 different compositional techniques (rule of thirds, leading lines, framing, negative space, unusual angle). Write a rationale for each.' }],
      tools: ['Camera or phone', 'Optional: grid overlay on your camera phone'],
    },
    {
      id: 'pc05', level: 'Beginner', week: 3, module: 'Composition & Frame',
      title: 'Framing and perspective',
      desc: 'Where you stand changes everything.',
      objectives: [
        'Horizontal vs vertical framing',
        'High and low angles, and camera-height psychology',
        'Foreground, midground, background layering',
        'Depth: creating a 3D feeling in a 2D image',
      ],
      projects: [{ name: 'One subject, six heights', brief: 'Photograph a single subject from six camera heights, from ground level to overhead. Note how the meaning shifts.' }],
      tools: ['Camera or phone'],
    },
    {
      id: 'pc06', level: 'Beginner', week: 3, module: 'Composition & Frame',
      title: 'Negative space and minimalism',
      desc: 'What you leave out is as loud as what you keep.',
      objectives: [
        'The power of empty space',
        'When less is more',
        'Breathing room and visual rest',
        'Contrast and emphasis',
      ],
      projects: [{ name: 'Visual storytelling in one frame', brief: 'Create a photo where composition alone tells a story, without text. Submit with a 100-word explanation of what the viewer should feel or understand.' }],
      tools: ['Camera or phone'],
    },

    /* ── WEEK 4–5 · Portrait fundamentals: how do you capture a person? ── */
    {
      id: 'pc07', level: 'Beginner', week: 4, module: 'Portrait Fundamentals',
      title: 'Light on the face',
      desc: 'The five classic portrait lighting patterns.',
      objectives: [
        'Butterfly lighting: flat, symmetrical, forgiving',
        'Rembrandt lighting: dramatic, dimensional, fashionable',
        'Loop lighting: natural, classic',
        'Split lighting: fashion, edgy',
        'Backlighting and rim light: separation, dimension',
      ],
      projects: [{ name: 'Rembrandt lighting challenge', brief: 'Create a portrait using Rembrandt (off-to-the-side) light. Window light, reflector or a single lamp. Submit the photo plus a lighting diagram.' }],
      tools: ['Camera or phone', 'A window or another source of diffused light'],
    },
    {
      id: 'pc08', level: 'Beginner', week: 4, module: 'Portrait Fundamentals',
      title: 'Posing principles',
      desc: 'Angles, hands, tension and where the eyes go.',
      objectives: [
        'Angles that flatter: 45-degree body turn, head position',
        'Hand placement and body tension',
        'Eye direction and connection',
        'Movement vs stillness',
        'Posing for different body types',
      ],
      projects: [{ name: 'Pose library', brief: 'Build a reference sheet of 10 poses you can direct from memory, photographed with a willing subject.' }],
      tools: ['Camera or phone', 'A willing subject'],
    },
    {
      id: 'pc09', level: 'Beginner', week: 5, module: 'Portrait Fundamentals',
      title: 'Connection and direction',
      desc: 'Getting a real expression, not a performed one.',
      objectives: [
        'Building trust with subjects',
        'Slow direction: gentle guidance, not dictation',
        'Capturing authentic emotion vs performative smiles',
        'Directing without judgment',
        'Professional ethics and consent',
      ],
      projects: [{ name: 'Connection over perfection', brief: 'Photograph 3 different subjects. For each, aim for one technically perfect shot and one emotionally true shot. Compare and reflect on what matters.' }],
      tools: ['Camera or phone', 'Three willing subjects'],
    },
    {
      id: 'pc10', level: 'Beginner', week: 5, module: 'Portrait Fundamentals',
      title: 'DIY portrait setup',
      desc: 'A window, a board and a bedsheet will take you far.',
      objectives: [
        'Window light: the most forgiving light',
        'Reflectors: white poster board, aluminium foil',
        'Diffusers: white sheet, printer paper',
        'One-light setups',
        'No-equipment setups: pure ambient light',
      ],
      projects: [{ name: 'Window light portrait series', brief: 'Photograph one willing subject in window light at 5 different times of day. Document how the light changes and how it changes the mood.' }],
      tools: ['White poster board or sheet as a reflector', 'Optional: a second light (lamp, flash, ring light)'],
    },

    /* ── WEEK 5–6 · Documentary and storytelling: telling a story in stills ── */
    {
      id: 'pc11', level: 'Beginner', week: 5, module: 'Documentary & Storytelling',
      title: 'The decisive moment',
      desc: 'Anticipating the frame before it happens.',
      objectives: [
        'Henri Cartier-Bresson’s concept',
        'Anticipation vs reaction',
        'Seeing layers of action',
        'Timing in fast-moving situations',
      ],
      projects: [{ name: 'Emotion series', brief: 'Capture images showing 5 different human emotions (joy, sorrow, concentration, surprise, connection) in their natural context. No posed portraits.' }],
      tools: ['Camera or phone'],
    },
    {
      id: 'pc12', level: 'Beginner', week: 6, module: 'Documentary & Storytelling',
      title: 'Visual story sequences',
      desc: 'How a set of frames becomes a narrative.',
      objectives: [
        'Establishing shot, detail, emotion, reaction',
        'Building narrative through multiple images',
        'Redundancy vs variety in a series',
        'Edit and sequence for maximum impact',
      ],
      projects: [{ name: 'Day in the life', brief: 'Photograph a person or family for 4 to 6 hours. Capture at least 30 images that tell the complete story of their day, then sequence them into a narrative.' }],
      tools: ['Camera or phone'],
    },
    {
      id: 'pc13', level: 'Beginner', week: 6, module: 'Documentary & Storytelling',
      title: 'Authentic vs candid',
      desc: 'Directing the natural, and knowing when not to.',
      objectives: [
        'Posed candids: directing the natural',
        'True candids: unnoticed observation',
        'A mixed approach: the best of both',
        'When authenticity matters and when direction works',
      ],
      projects: [{ name: 'Event photography simulation', brief: 'Photograph a local event: market, church, gathering, sports, street performance. Deliver 15 to 20 images that tell the story for someone who was not there.' }],
      tools: ['Camera or phone'],
    },
    {
      id: 'pc14', level: 'Beginner', week: 6, module: 'Documentary & Storytelling',
      title: 'Lighting in real situations',
      desc: 'Working with the light a venue gives you.',
      objectives: [
        'Working with existing light: acceptance, adaptation, augmentation',
        'Flash in documentary work: when and why',
        'Balancing ambient and flash light',
      ],
      projects: [{ name: 'Low-light story', brief: 'Shoot a short set in a difficult light situation, once with ambient light only and once with flash. Compare the two.' }],
      tools: ['Camera or phone', 'Optional: external flash or continuous light'],
    },
  ],
};
