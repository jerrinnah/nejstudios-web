/* ══════════════════════════════════════════
   NEJstudios — Seed curriculum
   Photography syllabus, segmented one topic per
   class and paced across 6 weeks
   (18 classes, three a week, 2 hours each).
   Once a tutor edits anything, the saved
   version on the server takes over.
   ══════════════════════════════════════════ */
window.NEJ_CURRICULUM = {
  programme: {
    title: 'The NEJ Photography Programme',
    duration: 'Photography: 18 classes over 6 weeks, three classes a week, 2 hours each',
    philosophy: [
      ['Accessibility first',    'Every lesson is taught with tools you already have: a smartphone camera and basic equipment.'],
      ['Incremental complexity', 'One skill at a time. Master it before moving on.'],
      ['Immediate application',  'Every theory lesson comes with a practical project.'],
      ['Creative expression',    'Technical skill serves creative vision, not the other way round.'],
      ['Business ready',         'Foundational business thinking is built in from day one.'],
    ],
    structure: [
      ['Photography', '6 weeks · 18 classes, Mon / Wed / Fri at noon'],
      ['Mid-level', '12 weeks · Specialisation and application'],
      ['Capstone',  '2 – 4 weeks · Real-world client work'],
    ],
  },

  photography: [
    /* ── WEEK 1 · Understanding the exposure triangle ── */
    {
      id: 'ph01', level: 'Beginner', week: 1, module: 'Exposure Triangle',
      title: 'Aperture',
      desc: 'The first corner of the triangle: how wide the lens opens.',
      objectives: [
        'What the f-number means, and why smaller is wider',
        'Depth of field: what stays sharp and what falls away',
        'Fast glass vs kit lenses in low light',
        'Choosing an aperture for portraits, groups and detail',
      ],
    },
    {
      id: 'ph02', level: 'Beginner', week: 1, module: 'Exposure Triangle',
      title: 'Shutter speed',
      desc: 'Freezing a moment, or letting it blur.',
      objectives: [
        'How shutter speed controls motion',
        'The slowest speed you can hand-hold',
        'Freezing dancers, kids and processions',
        'Deliberate blur as a creative choice',
      ],
    },
    {
      id: 'ph03', level: 'Beginner', week: 1, module: 'Exposure Triangle',
      title: 'ISO, and the three together',
      desc: 'Balancing all three corners in real light.',
      objectives: [
        'ISO and sensitivity to light',
        'Noise: how much is too much on your camera',
        'Trading one setting against another',
        'Reading a scene and choosing settings quickly',
      ],
    },

    /* ── WEEK 2 · Camera settings and modes, into composition ── */
    {
      id: 'ph04', level: 'Beginner', week: 2, module: 'Camera Settings & Modes',
      title: 'White balance and file formats',
      desc: 'Getting colour right in camera, and what to shoot in.',
      objectives: [
        'White balance presets and setting it by hand',
        'Why skin tone shifts under different light',
        'RAW vs JPEG: what each keeps and throws away',
        'When JPEG is enough, and when it is not',
      ],
    },
    {
      id: 'ph05', level: 'Beginner', week: 2, module: 'Camera Settings & Modes',
      title: 'Focus modes and the camera menu',
      desc: 'Making the camera focus where you want it to.',
      objectives: [
        'Single, continuous and manual focus',
        'Focus points, tracking and eye detection',
        'Working through the camera menu without fear',
        'Setting the camera up the way you shoot',
      ],
    },
    {
      id: 'ph06', level: 'Beginner', week: 2, module: 'Composition Techniques',
      title: 'Framing and the rule of thirds',
      desc: 'Where the subject sits, and why it matters.',
      objectives: [
        'Framing: what to include and what to cut',
        'The rule of thirds, and when to break it',
        'Framing within the frame: doorways, arches, foliage',
      ],
    },

    /* ── WEEK 3 · Composition, into the studio ── */
    {
      id: 'ph07', level: 'Beginner', week: 3, module: 'Composition Techniques',
      title: 'Leading lines and balance',
      desc: 'Guiding the eye and holding the frame steady.',
      objectives: [
        'Leading lines and visual pathways',
        'Balancing weight across the frame',
        'Symmetry and deliberate imbalance',
      ],
    },
    {
      id: 'ph08', level: 'Beginner', week: 3, module: 'Composition Techniques',
      title: 'Depth and centre framing',
      desc: 'Making a flat image feel three-dimensional.',
      objectives: [
        'Foreground, midground and background',
        'Creating depth with layers and light',
        'Centre framing: when the middle is right',
      ],
    },
    {
      id: 'ph09', level: 'Beginner', week: 3, module: 'Studio Session: Lighting',
      title: 'Types of light: key, fill and rim',
      desc: 'The three lights every studio portrait is built from.',
      objectives: [
        'Types of lighting and what each one does',
        'Key light: the light that shapes the face',
        'Fill light: controlling how deep the shadows go',
        'Rim light: separating the subject from the background',
      ],
    },

    /* ── WEEK 4 · Studio lighting, into posing ── */
    {
      id: 'ph10', level: 'Beginner', week: 4, module: 'Studio Session: Lighting',
      title: 'Light modifiers',
      desc: 'Softboxes, umbrellas, beauty dishes and reflectors.',
      objectives: [
        'How each modifier changes the quality of light',
        'Size and distance: why bigger and closer is softer',
        'Grids, flags and controlling spill',
        'Cheap modifiers that do the job',
      ],
    },
    {
      id: 'ph11', level: 'Beginner', week: 4, module: 'Studio Session: Lighting',
      title: 'Building a light setup',
      desc: 'Putting a full setup together, one light at a time.',
      objectives: [
        'One-light setups that always work',
        'Adding fill and rim without losing control',
        'Metering and balancing your lights',
        'Setting up and tearing down quickly',
      ],
    },
    {
      id: 'ph12', level: 'Beginner', week: 4, module: 'Posing Techniques',
      title: 'Posing men',
      desc: 'Stance, shoulders, hands and jaw.',
      objectives: [
        'Building a strong, natural stance',
        'What to do with the hands',
        'Angles for the shoulders and jaw',
        'Seated and standing variations',
      ],
    },

    /* ── WEEK 5 · Posing, directing, into editing ── */
    {
      id: 'ph13', level: 'Beginner', week: 5, module: 'Posing Techniques',
      title: 'Posing women',
      desc: 'Line, curve, weight and movement.',
      objectives: [
        'Creating line and shape through the body',
        'Weight on the back foot, and why it works',
        'Hands, chin and neck',
        'Posing for different body types',
      ],
    },
    {
      id: 'ph14', level: 'Beginner', week: 5, module: 'Working with Clients & Models',
      title: 'The act of directing',
      desc: 'Getting what you need from the person in front of you.',
      objectives: [
        'Directing clearly without making people stiff',
        'Building trust in the first five minutes',
        'Working with a nervous client vs an experienced model',
        'Running a session so it stays on time',
      ],
    },
    {
      id: 'ph15', level: 'Beginner', week: 5, module: 'Editing',
      title: 'Introduction to Photoshop',
      desc: 'Finding your way around and making clean edits.',
      objectives: [
        'The interface, layers and masks',
        'Cleanup: blemishes, stray hair, distractions',
        'Dodge and burn, and knowing when to stop',
        'Saving and exporting properly',
      ],
    },

    /* ── WEEK 6 · Editing, and out on a real event ── */
    {
      id: 'ph16', level: 'Beginner', week: 6, module: 'Editing',
      title: 'Frequency separation',
      desc: 'Retouching skin without turning it to plastic.',
      objectives: [
        'What frequency separation actually does',
        'Setting it up step by step',
        'Texture vs tone: working on the right layer',
        'Keeping skin looking like skin',
      ],
    },
    {
      id: 'ph17', level: 'Beginner', week: 6, module: 'Editing',
      title: 'Colour grading and Capture One',
      desc: 'A consistent look, and a faster workflow.',
      objectives: [
        'Colour grading: building a look you can repeat',
        'Introduction to Capture One',
        'Culling and tethering',
        'Batch editing a full session',
      ],
    },
    {
      id: 'ph18', level: 'Beginner', week: 6, module: 'Event Photography',
      title: 'Event photography',
      desc: 'Everything so far, applied on a live event.',
      objectives: [
        'Reading a venue and its light',
        'Coverage: what you must not miss',
        'Working fast without losing quality',
        'Delivering the story of the day',
      ],
    },
  ],
};
