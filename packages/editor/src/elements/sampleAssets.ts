import { Asset } from "@design-platform/types";

export const SAMPLE_ASSETS: Asset[] = [
  // ==========================================
  // 1. Cell Types
  // ==========================================
  {
    id: "asset-cell-generic",
    name: "Animal Cell (Organelles)",
    type: "svg",
    category: "Cell Types",
    categorySlug: "cell-types",
    subcategorySlug: "generic-cells",
    subcategoryName: "Generic Cells",
    defaultWidth: 150,
    defaultHeight: 150,
    tags: ["cell", "biology", "membrane", "nucleus", "organelle", "cytoplasm"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <ellipse cx="50" cy="50" rx="44" ry="40" fill="#ec4899" fill-opacity="0.25" stroke="#ec4899" stroke-width="3"/>
      <ellipse cx="46" cy="46" rx="18" ry="16" fill="#ec4899" fill-opacity="0.55" stroke="#db2777" stroke-width="2.5"/>
      <circle cx="44" cy="44" r="7" fill="#be185d"/>
      <circle cx="70" cy="35" r="4" fill="#ec4899"/>
      <circle cx="30" cy="70" r="5" fill="#ec4899"/>
      <ellipse cx="68" cy="65" rx="7" ry="4" fill="#f43f5e" fill-opacity="0.8"/>
      <ellipse cx="28" cy="35" rx="5" ry="3" fill="#8b5cf6" fill-opacity="0.8"/>
    </svg>`,
  },
  {
    id: "asset-cell-neuron",
    name: "Neuron (Multipolar)",
    type: "svg",
    category: "Cell Types",
    categorySlug: "cell-types",
    subcategorySlug: "neural-cells",
    subcategoryName: "Neural Cells",
    defaultWidth: 160,
    defaultHeight: 140,
    tags: ["neuron", "nerve", "soma", "axon", "dendrite", "synapse", "brain"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 12 18 L 30 36 M 16 48 L 30 40 M 36 20 L 36 34 M 40 40 Q 52 42 66 50 T 88 56" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round"/>
      <circle cx="34" cy="38" r="14" fill="#a5b4fc" fill-opacity="0.5" stroke="#6366f1" stroke-width="2.5"/>
      <circle cx="34" cy="38" r="6" fill="#4f46e5"/>
      <rect x="52" y="42" width="8" height="6" rx="2" fill="#818cf8"/>
      <rect x="66" y="48" width="8" height="6" rx="2" fill="#818cf8"/>
      <line x1="88" y1="56" x2="96" y2="48" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="88" y1="56" x2="96" y2="64" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "asset-cell-blood",
    name: "Red & White Blood Cells",
    type: "svg",
    category: "Cell Types",
    categorySlug: "cell-types",
    subcategorySlug: "immune-and-blood-cells",
    subcategoryName: "Immune and Blood Cells",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["erythrocyte", "leukocyte", "blood", "immune", "circulation"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <ellipse cx="38" cy="42" rx="24" ry="18" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
      <ellipse cx="38" cy="42" rx="14" ry="10" fill="#dc2626"/>
      <circle cx="72" cy="66" r="18" fill="#e0e7ff" stroke="#6366f1" stroke-width="3"/>
      <ellipse cx="70" cy="64" rx="7" ry="5" fill="#818cf8"/>
      <ellipse cx="76" cy="70" rx="5" ry="4" fill="#818cf8"/>
    </svg>`,
  },

  // ==========================================
  // 2. Proteins
  // ==========================================
  {
    id: "asset-protein-antibody",
    name: "Antibody (IgG)",
    type: "svg",
    category: "Proteins",
    categorySlug: "proteins",
    subcategorySlug: "antibodies",
    subcategoryName: "Antibodies",
    defaultWidth: 140,
    defaultHeight: 150,
    tags: ["antibody", "igg", "immunoglobulin", "immune", "antigen", "protein"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 32 16 L 32 46 L 46 60 L 46 88 M 68 16 L 68 46 L 54 60 L 54 88" fill="none" stroke="#3b82f6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 22 22 L 22 44 L 34 56 M 78 22 L 78 44 L 66 56" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="38" y1="52" x2="62" y2="52" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "asset-protein-receptor",
    name: "Cell Surface Receptor & Ligand",
    type: "svg",
    category: "Proteins",
    categorySlug: "proteins",
    subcategorySlug: "receptors-and-ligands",
    subcategoryName: "Receptors and Ligands",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["receptor", "ligand", "signaling", "membrane", "transduction", "binding"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 34 68 L 34 38 C 34 26 44 24 50 24 C 56 24 66 26 66 38 L 66 68" fill="none" stroke="#8b5cf6" stroke-width="6" stroke-linecap="round"/>
      <line x1="16" y1="72" x2="84" y2="72" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>
      <circle cx="50" cy="18" r="9" fill="#10b981" stroke="#059669" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "asset-protein-enzyme",
    name: "Enzyme with Substrate Pocket",
    type: "svg",
    category: "Proteins",
    categorySlug: "proteins",
    subcategorySlug: "enzymes",
    subcategoryName: "Enzymes",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["enzyme", "catalysis", "substrate", "active-site", "biochemistry"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 22 28 C 35 14 65 14 78 28 C 92 44 88 74 72 84 C 56 94 34 90 22 78 C 10 64 12 38 22 28 Z" fill="#0284c7" fill-opacity="0.3" stroke="#0284c7" stroke-width="4"/>
      <path d="M 40 20 C 40 38 60 38 60 20" fill="#f8fafc" stroke="#0284c7" stroke-width="3"/>
      <polygon points="50,14 43,26 57,26" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
    </svg>`,
  },

  // ==========================================
  // 3. Nucleic Acids
  // ==========================================
  {
    id: "asset-bio-dna",
    name: "DNA Double Helix",
    type: "svg",
    category: "Nucleic Acids",
    categorySlug: "nucleic-acids",
    subcategorySlug: "dna",
    subcategoryName: "DNA",
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
    id: "asset-dna-plasmid",
    name: "Circular Plasmid Vector",
    type: "svg",
    category: "Nucleic Acids",
    categorySlug: "nucleic-acids",
    subcategorySlug: "plasmids",
    subcategoryName: "Plasmids",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["plasmid", "cloning", "vector", "circular-dna", "promoter", "resistance"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="36" fill="none" stroke="#3b82f6" stroke-width="5"/>
      <path d="M 50 14 A 36 36 0 0 1 84 40" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round"/>
      <path d="M 50 86 A 36 36 0 0 1 20 68" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-dasharray="3,3"/>
    </svg>`,
  },

  // ==========================================
  // 4. Human Anatomy
  // ==========================================
  {
    id: "asset-bio-heart",
    name: "Heart (Cardiac Pulse)",
    type: "svg",
    category: "Human Anatomy",
    categorySlug: "human-anatomy",
    subcategorySlug: "cardiovascular-system",
    subcategoryName: "Cardiovascular System",
    defaultWidth: 130,
    defaultHeight: 120,
    tags: ["heart", "pulse", "cardiology", "vital", "ecg", "health", "anatomy"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 50 85 C 50 85 15 60 15 35 C 15 20 28 12 40 18 C 45 21 50 28 50 28 C 50 28 55 21 60 18 C 72 12 85 20 85 35 C 85 60 50 85 50 85 Z" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
      <path d="M 24 45 L 36 45 L 42 32 L 48 58 L 54 38 L 60 48 L 66 45 L 76 45" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },

  // ==========================================
  // 5. Lab and Objects
  // ==========================================
  {
    id: "asset-bio-flask",
    name: "Erlenmeyer Flask",
    type: "svg",
    category: "Lab and Objects",
    categorySlug: "lab-and-objects",
    subcategorySlug: "beakers-bottles-flasks",
    subcategoryName: "Beakers, Bottles, Flasks",
    defaultWidth: 130,
    defaultHeight: 150,
    tags: ["flask", "beaker", "lab", "chemistry", "experiment"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 42 12 L 58 12 L 58 35 L 85 82 C 88 88 84 92 78 92 L 22 92 C 16 92 12 88 15 82 L 42 35 Z" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="4" stroke-linejoin="round"/>
      <path d="M 27 75 L 73 75 L 82 89 C 83 91 80 92 78 92 L 22 92 C 20 92 17 91 18 89 Z" fill="#10b981" fill-opacity="0.75"/>
      <line x1="38" y1="12" x2="62" y2="12" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
      <circle cx="45" cy="80" r="2.5" fill="#ffffff" fill-opacity="0.8"/>
      <circle cx="55" cy="76" r="2" fill="#ffffff" fill-opacity="0.8"/>
    </svg>`,
  },
  {
    id: "asset-bio-microscope",
    name: "Laboratory Microscope",
    type: "svg",
    category: "Lab and Objects",
    categorySlug: "lab-and-objects",
    subcategorySlug: "microscope-and-optics",
    subcategoryName: "Microscope and Optics",
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
    id: "asset-lab-pipette",
    name: "Micropipette",
    type: "svg",
    category: "Lab and Objects",
    categorySlug: "lab-and-objects",
    subcategorySlug: "tools",
    subcategoryName: "Tools",
    defaultWidth: 120,
    defaultHeight: 160,
    tags: ["pipette", "micropipette", "liquid-handling", "tools", "lab"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="44" y="6" width="12" height="12" rx="3" fill="#3b82f6"/>
      <rect x="42" y="18" width="16" height="48" rx="4" fill="#64748b" stroke="#475569" stroke-width="2"/>
      <rect x="46" y="26" width="8" height="10" rx="1" fill="#ffffff"/>
      <path d="M 46 66 L 54 66 L 52 90 L 48 90 Z" fill="#93c5fd" stroke="#3b82f6" stroke-width="1.5"/>
    </svg>`,
  },

  // ==========================================
  // 6. Species
  // ==========================================
  {
    id: "asset-bio-virus",
    name: "Virus / Pathogen",
    type: "svg",
    category: "Species",
    categorySlug: "species",
    subcategorySlug: "viruses",
    subcategoryName: "Viruses",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["virus", "pathogen", "capsid", "infection", "spikes"],
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
    </svg>`,
  },
  {
    id: "asset-species-bacteria",
    name: "Bacterium (Bacillus)",
    type: "svg",
    category: "Species",
    categorySlug: "species",
    subcategorySlug: "bacteria",
    subcategoryName: "Bacteria",
    defaultWidth: 150,
    defaultHeight: 130,
    tags: ["bacteria", "bacillus", "flagella", "microbe", "prokaryote"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="22" y="32" width="56" height="34" rx="17" fill="#10b981" fill-opacity="0.35" stroke="#059669" stroke-width="3"/>
      <path d="M 32 49 Q 50 38 68 49" fill="none" stroke="#047857" stroke-width="3" stroke-linecap="round"/>
      <path d="M 22 49 Q 10 38 4 48" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 22 43 Q 12 28 6 32" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },

  // ==========================================
  // 8. Membranes
  // ==========================================
  {
    id: "asset-membrane-bilayer",
    name: "Phospholipid Bilayer Segment",
    type: "svg",
    category: "Membranes",
    categorySlug: "membranes",
    subcategorySlug: "phospholipid-bilayer-membranes",
    subcategoryName: "Phospholipid Bilayer Membranes",
    defaultWidth: 170,
    defaultHeight: 110,
    tags: ["membrane", "phospholipid", "bilayer", "lipid", "hydrophobic", "polar"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100" height="60">
      <circle cx="16" cy="14" r="6" fill="#3b82f6"/>
      <path d="M 14 20 L 14 30 M 18 20 L 18 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="36" cy="14" r="6" fill="#3b82f6"/>
      <path d="M 34 20 L 34 30 M 38 20 L 38 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="56" cy="14" r="6" fill="#3b82f6"/>
      <path d="M 54 20 L 54 30 M 58 20 L 58 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="76" cy="14" r="6" fill="#3b82f6"/>
      <path d="M 74 20 L 74 30 M 78 20 L 78 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="16" cy="46" r="6" fill="#3b82f6"/>
      <path d="M 14 40 L 14 30 M 18 40 L 18 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="36" cy="46" r="6" fill="#3b82f6"/>
      <path d="M 34 40 L 34 30 M 38 40 L 38 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="56" cy="46" r="6" fill="#3b82f6"/>
      <path d="M 54 40 L 54 30 M 58 40 L 58 30" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="76" cy="46" r="6" fill="#3b82f6"/>
      <path d="M 74 40 L 74 30 M 78 40 L 78 30" stroke="#f59e0b" stroke-width="2"/>
    </svg>`,
  },

  // ==========================================
  // 9. Cell Structures
  // ==========================================
  {
    id: "asset-structure-mitochondria",
    name: "Mitochondrion (Cristae)",
    type: "svg",
    category: "Cell Structures",
    categorySlug: "cell-structures",
    subcategorySlug: "organelles",
    subcategoryName: "Organelles",
    defaultWidth: 150,
    defaultHeight: 120,
    tags: ["mitochondria", "cristae", "organelle", "atp", "respiration", "energy"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <ellipse cx="50" cy="50" rx="42" ry="24" fill="#f97316" fill-opacity="0.25" stroke="#ea580c" stroke-width="3"/>
      <path d="M 18 50 C 26 42 26 58 34 50 C 42 42 42 58 50 50 C 58 42 58 58 66 50 C 74 42 74 58 82 50" fill="none" stroke="#ea580c" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,
  },

  // ==========================================
  // 12. Chemistry
  // ==========================================
  {
    id: "asset-bio-molecule",
    name: "Chemical Molecule (Benzene Ring)",
    type: "svg",
    category: "Chemistry",
    categorySlug: "chemistry",
    subcategorySlug: "structural-formulas",
    subcategoryName: "Structural Formulas",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["molecule", "chemistry", "structure", "compound", "bond", "benzene"],
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

  // ==========================================
  // 13. Graphs and Symbols
  // ==========================================
  {
    id: "asset-icon-chart",
    name: "Bar Chart / Analytics",
    type: "svg",
    category: "Graphs and Symbols",
    categorySlug: "graphs-and-symbols",
    subcategorySlug: "graph-icons",
    subcategoryName: "Graph Icons",
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
    id: "asset-bio-cross",
    name: "Medical Cross Emblem",
    type: "svg",
    category: "Graphs and Symbols",
    categorySlug: "graphs-and-symbols",
    subcategorySlug: "symbols-and-signs",
    subcategoryName: "Symbols and Signs",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["medical", "health", "hospital", "clinic", "cross"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="38" y="14" width="24" height="72" rx="4" fill="#ef4444"/>
      <rect x="14" y="38" width="72" height="24" rx="4" fill="#ef4444"/>
    </svg>`,
  },
  {
    id: "asset-icon-target",
    name: "Target / Focus Objective",
    type: "svg",
    category: "Graphs and Symbols",
    categorySlug: "graphs-and-symbols",
    subcategorySlug: "symbols-and-signs",
    subcategoryName: "Symbols and Signs",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["target", "aim", "goal", "focus"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#64748b" stroke-width="5"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke="#64748b" stroke-width="5"/>
      <circle cx="50" cy="50" r="12" fill="#ef4444"/>
    </svg>`,
  },

  // ==========================================
  // 14. Arrows and Shapes
  // ==========================================
  {
    id: "asset-shape-rect",
    name: "Rectangle Artboard",
    type: "shape",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 160,
    defaultHeight: 100,
    tags: ["rectangle", "box", "square", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="10" y="20" width="80" height="60" rx="6" fill="#3b82f6"/>
    </svg>`,
  },
  {
    id: "asset-shape-circle",
    name: "Circle Vector",
    type: "shape",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["circle", "round", "oval", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="#10b981"/>
    </svg>`,
  },
  {
    id: "asset-shape-arrow-right",
    name: "Pathway Arrow (Right)",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "arrows-and-lines",
    subcategoryName: "Arrows and lines",
    defaultWidth: 160,
    defaultHeight: 90,
    tags: ["arrow", "right", "direction", "flow", "pointer", "pathway"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 15 42 L 55 42 L 55 24 L 88 50 L 55 76 L 55 58 L 15 58 Z" fill="#8b5cf6"/>
    </svg>`,
  },
  {
    id: "asset-shape-star",
    name: "Star Badge",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 130,
    defaultHeight: 130,
    tags: ["star", "favorite", "badge", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,10 63,38 94,40 70,60 78,90 50,74 22,90 30,60 6,40 37,38" fill="#f59e0b"/>
    </svg>`,
  },
  {
    id: "asset-shape-hexagon",
    name: "Hexagon Ring",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["hexagon", "polygon", "benzene", "structure", "ring"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,12 85,32 85,68 50,88 15,68 15,32" fill="#06b6d4" stroke="#0891b2" stroke-width="3" stroke-linejoin="round"/>
    </svg>`,
  },

  // ==========================================
  // 15. Biomojii
  // ==========================================
  {
    id: "asset-biomojii-happy-cell",
    name: "Happy Bio-Cell",
    type: "svg",
    category: "Biomojii",
    categorySlug: "biomojii",
    subcategorySlug: "biomojii-bodies-cells",
    subcategoryName: "Biomojii Bodies / Cells",
    defaultWidth: 130,
    defaultHeight: 130,
    tags: ["biomojii", "happy", "cell", "cute", "character", "face"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="42" fill="#fed7aa" stroke="#f97316" stroke-width="3.5"/>
      <circle cx="36" cy="42" r="5" fill="#431407"/>
      <circle cx="64" cy="42" r="5" fill="#431407"/>
      <path d="M 38 60 Q 50 72 62 60" fill="none" stroke="#431407" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="52" rx="4" ry="2.5" fill="#f43f5e" fill-opacity="0.6"/>
      <ellipse cx="72" cy="52" rx="4" ry="2.5" fill="#f43f5e" fill-opacity="0.6"/>
    </svg>`,
  },
  // ==========================================
  // 7. Agriculture
  // ==========================================
  {
    id: "asset-agri-chloroplast",
    name: "Chloroplast (Thylakoids & Stroma)",
    type: "svg",
    category: "Agriculture",
    categorySlug: "agriculture",
    subcategorySlug: "plant-anatomy",
    subcategoryName: "Plant Anatomy",
    defaultWidth: 150,
    defaultHeight: 120,
    tags: ["chloroplast", "plant", "photosynthesis", "thylakoid", "stroma", "agriculture"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <ellipse cx="50" cy="50" rx="44" ry="28" fill="#10b981" fill-opacity="0.25" stroke="#059669" stroke-width="3"/>
      <ellipse cx="50" cy="50" rx="38" ry="22" fill="none" stroke="#047857" stroke-width="1.5" stroke-dasharray="3,3"/>
      <rect x="24" y="44" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="24" y="50" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="24" y="56" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="44" y="40" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="44" y="46" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="44" y="52" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="44" y="58" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="64" y="44" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="64" y="50" width="12" height="4" rx="2" fill="#047857"/>
      <rect x="64" y="56" width="12" height="4" rx="2" fill="#047857"/>
      <line x1="36" y1="52" x2="44" y2="52" stroke="#10b981" stroke-width="2"/>
      <line x1="56" y1="50" x2="64" y2="50" stroke="#10b981" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "asset-agri-leaf",
    name: "Plant Leaf (Vascular Veins)",
    type: "svg",
    category: "Agriculture",
    categorySlug: "agriculture",
    subcategorySlug: "plant-anatomy",
    subcategoryName: "Plant Anatomy",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["leaf", "plant", "vein", "vascular", "botany", "crop", "agriculture"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 50 12 C 78 28 85 70 50 88 C 15 70 22 28 50 12 Z" fill="#10b981" fill-opacity="0.3" stroke="#059669" stroke-width="3"/>
      <line x1="50" y1="14" x2="50" y2="92" stroke="#047857" stroke-width="3" stroke-linecap="round"/>
      <line x1="50" y1="36" x2="68" y2="28" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="46" x2="72" y2="40" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="58" x2="70" y2="54" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="36" x2="32" y2="28" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="46" x2="28" y2="40" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="58" x2="30" y2="54" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },

  // ==========================================
  // 10. Epithelium
  // ==========================================
  {
    id: "asset-epithelium-columnar",
    name: "Columnar Epithelial Barrier",
    type: "svg",
    category: "Epithelium",
    categorySlug: "epithelium",
    subcategorySlug: "glandular-epithelia",
    subcategoryName: "Glandular Epithelia",
    defaultWidth: 160,
    defaultHeight: 120,
    tags: ["epithelium", "columnar", "barrier", "junction", "tissue", "histology"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="15" y="24" width="22" height="52" rx="4" fill="#38bdf8" fill-opacity="0.25" stroke="#0284c7" stroke-width="2.5"/>
      <circle cx="26" cy="56" r="6" fill="#0284c7"/>
      <rect x="39" y="24" width="22" height="52" rx="4" fill="#38bdf8" fill-opacity="0.25" stroke="#0284c7" stroke-width="2.5"/>
      <circle cx="50" cy="56" r="6" fill="#0284c7"/>
      <rect x="63" y="24" width="22" height="52" rx="4" fill="#38bdf8" fill-opacity="0.25" stroke="#0284c7" stroke-width="2.5"/>
      <circle cx="74" cy="56" r="6" fill="#0284c7"/>
      <line x1="10" y1="78" x2="90" y2="78" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
      <path d="M 16 24 L 20 18 M 22 24 L 26 18 M 40 24 L 44 18 M 46 24 L 50 18 M 64 24 L 68 18 M 70 24 L 74 18" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },

  // ==========================================
  // 11. Lipids and Carbs
  // ==========================================
  {
    id: "asset-carb-glucose",
    name: "D-Glucose Pyranose Ring",
    type: "svg",
    category: "Lipids and Carbs",
    categorySlug: "lipids-and-carbs",
    subcategorySlug: "carbohydrates",
    subcategoryName: "Carbohydrates",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["glucose", "sugar", "carbohydrate", "pyranose", "monosaccharide", "biochemistry"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,18 78,34 78,66 50,82 22,66 22,34" fill="#fef08a" fill-opacity="0.3" stroke="#ca8a04" stroke-width="3.5" stroke-linejoin="round"/>
      <circle cx="50" cy="18" r="6" fill="#eab308"/>
      <circle cx="78" cy="34" r="6" fill="#eab308"/>
      <circle cx="78" cy="66" r="6" fill="#ca8a04"/>
      <circle cx="50" cy="82" r="6" fill="#eab308"/>
      <circle cx="22" cy="66" r="6" fill="#eab308"/>
      <circle cx="22" cy="34" r="6" fill="#ca8a04"/>
      <line x1="78" y1="34" x2="90" y2="24" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
      <circle cx="92" cy="22" r="4" fill="#ef4444"/>
    </svg>`,
  },
  {
    id: "asset-lipid-micelle",
    name: "Lipid Micelle",
    type: "svg",
    category: "Lipids and Carbs",
    categorySlug: "lipids-and-carbs",
    subcategorySlug: "lipids",
    subcategoryName: "Lipids",
    defaultWidth: 140,
    defaultHeight: 140,
    tags: ["micelle", "lipid", "fatty-acid", "hydrophobic", "surfactant", "amphipathic"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="2,4"/>
      <circle cx="50" cy="18" r="5" fill="#f59e0b"/>
      <line x1="50" y1="23" x2="50" y2="40" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="50" cy="82" r="5" fill="#f59e0b"/>
      <line x1="50" y1="77" x2="50" y2="60" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="18" cy="50" r="5" fill="#f59e0b"/>
      <line x1="23" y1="50" x2="40" y2="50" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="82" cy="50" r="5" fill="#f59e0b"/>
      <line x1="77" y1="50" x2="60" y2="50" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="27" cy="27" r="5" fill="#f59e0b"/>
      <line x1="31" y1="31" x2="42" y2="42" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="73" cy="27" r="5" fill="#f59e0b"/>
      <line x1="69" y1="31" x2="58" y2="42" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="27" cy="73" r="5" fill="#f59e0b"/>
      <line x1="31" y1="69" x2="42" y2="58" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="73" cy="73" r="5" fill="#f59e0b"/>
      <line x1="69" y1="69" x2="58" y2="58" stroke="#f59e0b" stroke-width="2"/>
    </svg>`,
  },
];
