import { Asset } from "@design-platform/types";

export const SAMPLE_ASSETS: Asset[] = [
  // ==========================================
  // Science & Bio
  // ==========================================
  {
    id: "asset-bio-dna",
    name: "DNA Double Helix",
    type: "svg",
    category: "science",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["dna", "genetics", "helix", "biology", "molecule"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 25 15 C 40 25, 60 25, 75 15 M 25 35 C 40 45, 60 45, 75 35 M 25 55 C 40 65, 60 65, 75 55 M 25 75 C 40 85, 60 85, 75 75" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <path d="M 25 15 Q 15 45 25 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
      <path d="M 75 15 Q 85 45 75 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
      <circle cx="25" cy="15" r="4" fill="#3b82f6"/>
      <circle cx="75" cy="15" r="4" fill="#3b82f6"/>
      <circle cx="25" cy="35" r="4" fill="#3b82f6"/>
      <circle cx="75" cy="35" r="4" fill="#3b82f6"/>
      <circle cx="25" cy="55" r="4" fill="#3b82f6"/>
      <circle cx="75" cy="55" r="4" fill="#3b82f6"/>
      <circle cx="25" cy="75" r="4" fill="#3b82f6"/>
      <circle cx="75" cy="75" r="4" fill="#3b82f6"/>
    </svg>`,
  },
  {
    id: "asset-bio-cell",
    name: "Cell with Nucleus",
    type: "svg",
    category: "science",
    defaultWidth: 150,
    defaultHeight: 150,
    tags: ["cell", "biology", "membrane", "nucleus", "organelle"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <ellipse cx="50" cy="50" rx="44" ry="40" fill="#ec4899" fill-opacity="0.25" stroke="#ec4899" stroke-width="4"/>
      <ellipse cx="46" cy="46" rx="20" ry="18" fill="#ec4899" fill-opacity="0.6" stroke="#db2777" stroke-width="3"/>
      <circle cx="44" cy="44" r="8" fill="#be185d"/>
      <circle cx="70" cy="35" r="4" fill="#ec4899"/>
      <circle cx="30" cy="70" r="5" fill="#ec4899"/>
      <ellipse cx="68" cy="65" rx="6" ry="3" fill="#ec4899"/>
    </svg>`,
  },
  {
    id: "asset-bio-flask",
    name: "Erlenmeyer Flask",
    type: "svg",
    category: "science",
    defaultWidth: 130,
    defaultHeight: 150,
    tags: ["flask", "beaker", "lab", "chemistry", "experiment"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 42 12 L 58 12 L 58 35 L 85 82 C 88 88 84 92 78 92 L 22 92 C 16 92 12 88 15 82 L 42 35 Z" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="4" stroke-linejoin="round"/>
      <path d="M 27 75 L 73 75 L 82 89 C 83 91 80 92 78 92 L 22 92 C 20 92 17 91 18 89 Z" fill="#10b981" fill-opacity="0.75"/>
      <line x1="38" y1="12" x2="62" y2="12" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <circle cx="45" cy="80" r="2.5" fill="#ffffff" fill-opacity="0.8"/>
      <circle cx="55" cy="76" r="2" fill="#ffffff" fill-opacity="0.8"/>
      <circle cx="40" cy="84" r="1.5" fill="#ffffff" fill-opacity="0.8"/>
    </svg>`,
  },
  {
    id: "asset-bio-microscope",
    name: "Microscope",
    type: "svg",
    category: "science",
    defaultWidth: 140,
    defaultHeight: 160,
    tags: ["microscope", "optics", "lab", "science", "research"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="25" y="86" width="50" height="8" rx="3" fill="#6366f1"/>
      <path d="M 60 86 Q 78 70 70 45 Q 64 30 50 32" fill="none" stroke="#6366f1" stroke-width="6" stroke-linecap="round"/>
      <rect x="35" y="20" width="16" height="36" rx="3" transform="rotate(-30 43 38)" fill="#818cf8" stroke="#4f46e5" stroke-width="2"/>
      <rect x="40" y="8" width="12" height="14" rx="2" transform="rotate(-30 46 15)" fill="#6366f1"/>
      <rect x="25" y="58" width="30" height="4" rx="1" fill="#4f46e5"/>
      <circle cx="68" cy="52" r="5" fill="#a5b4fc" stroke="#4f46e5" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "asset-bio-virus",
    name: "Virus / Pathogen",
    type: "svg",
    category: "science",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["virus", "bacteria", "covid", "pathogen", "microbiology"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="26" fill="#f59e0b" fill-opacity="0.3" stroke="#f59e0b" stroke-width="4"/>
      <line x1="50" y1="24" x2="50" y2="10" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="8" r="4" fill="#f59e0b"/>
      <line x1="50" y1="76" x2="50" y2="90" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="92" r="4" fill="#f59e0b"/>
      <line x1="24" y1="50" x2="10" y2="50" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="8" cy="50" r="4" fill="#f59e0b"/>
      <line x1="76" y1="50" x2="90" y2="50" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="92" cy="50" r="4" fill="#f59e0b"/>
      <line x1="32" y1="32" x2="20" y2="20" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="18" cy="18" r="4" fill="#f59e0b"/>
      <line x1="68" y1="68" x2="80" y2="80" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <circle cx="82" cy="82" r="4" fill="#f59e0b"/>
      <circle cx="44" cy="46" r="3" fill="#d97706"/>
      <circle cx="56" cy="54" r="4" fill="#d97706"/>
    </svg>`,
  },
  {
    id: "asset-bio-molecule",
    name: "Chemical Molecule",
    type: "svg",
    category: "science",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["molecule", "chemistry", "structure", "compound", "bond"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <line x1="50" y1="20" x2="78" y2="38" stroke="#06b6d4" stroke-width="4"/>
      <line x1="78" y1="38" x2="78" y2="70" stroke="#06b6d4" stroke-width="4"/>
      <line x1="78" y1="70" x2="50" y2="88" stroke="#06b6d4" stroke-width="4"/>
      <line x1="50" y1="88" x2="22" y2="70" stroke="#06b6d4" stroke-width="4"/>
      <line x1="22" y1="70" x2="22" y2="38" stroke="#06b6d4" stroke-width="4"/>
      <line x1="22" y1="38" x2="50" y2="20" stroke="#06b6d4" stroke-width="4"/>
      <circle cx="50" cy="20" r="7" fill="#0891b2"/>
      <circle cx="78" cy="38" r="7" fill="#06b6d4"/>
      <circle cx="78" cy="70" r="7" fill="#0891b2"/>
      <circle cx="50" cy="88" r="7" fill="#06b6d4"/>
      <circle cx="22" cy="70" r="7" fill="#0891b2"/>
      <circle cx="22" cy="38" r="7" fill="#06b6d4"/>
    </svg>`,
  },
  {
    id: "asset-bio-cross",
    name: "Medical Cross",
    type: "svg",
    category: "science",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["medical", "health", "hospital", "clinic", "cross"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="38" y="14" width="24" height="72" rx="4" fill="#ef4444"/>
      <rect x="14" y="38" width="72" height="24" rx="4" fill="#ef4444"/>
    </svg>`,
  },

  // ==========================================
  // Clean Shapes
  // ==========================================
  {
    id: "asset-shape-rect",
    name: "Rectangle",
    type: "shape",
    category: "shapes",
    defaultWidth: 160,
    defaultHeight: 100,
    tags: ["rectangle", "box", "square"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="10" y="20" width="80" height="60" rx="6" fill="#3b82f6"/>
    </svg>`,
  },
  {
    id: "asset-shape-circle",
    name: "Circle",
    type: "shape",
    category: "shapes",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["circle", "round", "oval"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="#10b981"/>
    </svg>`,
  },
  {
    id: "asset-shape-arrow-right",
    name: "Arrow Right",
    type: "svg",
    category: "shapes",
    defaultWidth: 160,
    defaultHeight: 90,
    tags: ["arrow", "right", "direction", "flow", "pointer"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 15 42 L 55 42 L 55 24 L 88 50 L 55 76 L 55 58 L 15 58 Z" fill="#8b5cf6"/>
    </svg>`,
  },
  {
    id: "asset-shape-star",
    name: "Star",
    type: "svg",
    category: "shapes",
    defaultWidth: 130,
    defaultHeight: 130,
    tags: ["star", "favorite", "badge"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,10 63,38 94,40 70,60 78,90 50,74 22,90 30,60 6,40 37,38" fill="#f59e0b"/>
    </svg>`,
  },

  // ==========================================
  // Icons
  // ==========================================
  {
    id: "asset-icon-target",
    name: "Target / Focus",
    type: "svg",
    category: "icons",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["target", "aim", "goal", "focus"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#64748b" stroke-width="5"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke="#64748b" stroke-width="5"/>
      <circle cx="50" cy="50" r="12" fill="#ef4444"/>
    </svg>`,
  },
  {
    id: "asset-icon-chart",
    name: "Bar Chart",
    type: "svg",
    category: "icons",
    defaultWidth: 130,
    defaultHeight: 120,
    tags: ["chart", "analytics", "data", "report", "graph"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="18" y="55" width="16" height="35" rx="3" fill="#3b82f6"/>
      <rect x="42" y="32" width="16" height="58" rx="3" fill="#60a5fa"/>
      <rect x="66" y="15" width="16" height="75" rx="3" fill="#2563eb"/>
      <line x1="12" y1="92" x2="88" y2="92" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "asset-icon-lightbulb",
    name: "Idea / Lightbulb",
    type: "svg",
    category: "icons",
    defaultWidth: 120,
    defaultHeight: 140,
    tags: ["idea", "lightbulb", "innovation", "brainstorm"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 32 40 C 32 25 40 16 50 16 C 60 16 68 25 68 40 C 68 50 60 56 58 64 L 42 64 C 40 56 32 50 32 40 Z" fill="#fbbf24" fill-opacity="0.3" stroke="#f59e0b" stroke-width="4"/>
      <rect x="42" y="68" width="16" height="6" rx="2" fill="#d97706"/>
      <rect x="45" y="76" width="10" height="5" rx="2" fill="#b45309"/>
      <line x1="50" y1="34" x2="50" y2="50" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
  },
];
