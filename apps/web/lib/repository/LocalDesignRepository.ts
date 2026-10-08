import { DesignDocument, CreateDesignInput, DesignRepository } from "@design-platform/types";

const STORAGE_KEY = "design_platform_documents_v1";

export class LocalDesignRepository implements DesignRepository {
  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  private getStoredDocs(): DesignDocument[] {
    if (!this.isBrowser()) return [];

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        const seed = this.getSeedDesigns();
        this.saveStoredDocs(seed);
        return seed;
      }
      return JSON.parse(data) as DesignDocument[];
    } catch (err) {
      console.error("Error reading designs from localStorage:", err);
      return [];
    }
  }

  private saveStoredDocs(docs: DesignDocument[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (err) {
      console.error("Error saving designs to localStorage:", err);
    }
  }

  public async list(): Promise<DesignDocument[]> {
    const docs = this.getStoredDocs();
    // Sort by updatedAt DESC (most recently modified first)
    return [...docs].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  public async getById(id: string): Promise<DesignDocument | null> {
    const docs = this.getStoredDocs();
    const found = docs.find((d) => d.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  public async create(input: CreateDesignInput): Promise<DesignDocument> {
    const docs = this.getStoredDocs();
    const now = new Date().toISOString();
    const id = `des_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const newDoc: DesignDocument = {
      id,
      name: input.name.trim() || "Untitled Design",
      width: input.width || 1200,
      height: input.height || 800,
      backgroundColor: input.backgroundColor || "#ffffff",
      createdAt: now,
      updatedAt: now,
      pages:
        input.pages && input.pages.length > 0
          ? input.pages
          : [
              {
                id: `page_${Date.now()}`,
                name: "Page 1",
                elements: [],
              },
            ],
    };

    docs.unshift(newDoc);
    this.saveStoredDocs(docs);
    return newDoc;
  }

  public async update(id: string, updates: Partial<DesignDocument>): Promise<DesignDocument> {
    const docs = this.getStoredDocs();
    const index = docs.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new Error(`Design with id ${id} not found`);
    }

    const current = docs[index];
    if (!current) {
      throw new Error(`Design with id ${id} not found`);
    }

    const updated: DesignDocument = {
      ...current,
      ...updates,
      id: current.id, // prevent overwriting ID
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    docs[index] = updated;
    this.saveStoredDocs(docs);
    return updated;
  }

  public async delete(id: string): Promise<void> {
    const docs = this.getStoredDocs();
    const filtered = docs.filter((d) => d.id !== id);
    this.saveStoredDocs(filtered);
  }

  public async duplicate(id: string): Promise<DesignDocument> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error(`Design with id ${id} not found`);
    }

    const now = new Date().toISOString();
    const newId = `des_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const cloned: DesignDocument = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    const docs = this.getStoredDocs();
    docs.unshift(cloned);
    this.saveStoredDocs(docs);
    return cloned;
  }

  // Pre-populated realistic initial designs for instant demonstration
  private getSeedDesigns(): DesignDocument[] {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 3600000 * 2).toISOString();

    return [
      {
        id: "design-sample-cell-bio",
        name: "Cellular Biology Overview",
        width: 1200,
        height: 800,
        backgroundColor: "#ffffff",
        createdAt: earlier,
        updatedAt: earlier,
        pages: [
          {
            id: "page-seed-1",
            name: "Page 1",
            elements: [
              {
                id: "seed-el-title",
                type: "text",
                name: "Header",
                x: 80,
                y: 60,
                width: 500,
                height: 50,
                rotation: 0,
                opacity: 1,
                properties: {
                  text: "Eukaryotic Cell Structure & DNA",
                  fontSize: 28,
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fill: "#0f172a",
                  fontWeight: "bold",
                  align: "left",
                },
              },
              {
                id: "seed-el-desc",
                type: "text",
                name: "Description",
                x: 80,
                y: 115,
                width: 600,
                height: 40,
                rotation: 0,
                opacity: 1,
                properties: {
                  text: "Key molecular organelles and genomic architecture schematic.",
                  fontSize: 15,
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fill: "#64748b",
                  fontWeight: "normal",
                  align: "left",
                },
              },
              {
                id: "seed-el-cell",
                type: "svg",
                name: "Cell with Nucleus",
                x: 100,
                y: 200,
                width: 280,
                height: 280,
                rotation: 0,
                opacity: 1,
                properties: {
                  originalSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <ellipse cx="50" cy="50" rx="44" ry="40" fill="#ec4899" fill-opacity="0.25" stroke="#ec4899" stroke-width="4"/>
                    <ellipse cx="46" cy="46" rx="20" ry="18" fill="#ec4899" fill-opacity="0.6" stroke="#db2777" stroke-width="3"/>
                    <circle cx="44" cy="44" r="8" fill="#be185d"/>
                  </svg>`,
                  svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <ellipse cx="50" cy="50" rx="44" ry="40" fill="#ec4899" fill-opacity="0.25" stroke="#ec4899" stroke-width="4"/>
                    <ellipse cx="46" cy="46" rx="20" ry="18" fill="#ec4899" fill-opacity="0.6" stroke="#db2777" stroke-width="3"/>
                    <circle cx="44" cy="44" r="8" fill="#be185d"/>
                  </svg>`,
                },
              },
              {
                id: "seed-el-dna",
                type: "svg",
                name: "DNA Helix",
                x: 480,
                y: 220,
                width: 220,
                height: 220,
                rotation: 0,
                opacity: 1,
                properties: {
                  originalSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <path d="M 25 15 C 40 25, 60 25, 75 15 M 25 35 C 40 45, 60 45, 75 35 M 25 55 C 40 65, 60 65, 75 55 M 25 75 C 40 85, 60 85, 75 75" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 25 15 Q 15 45 25 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
                    <path d="M 75 15 Q 85 45 75 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
                  </svg>`,
                  svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <path d="M 25 15 C 40 25, 60 25, 75 15 M 25 35 C 40 45, 60 45, 75 35 M 25 55 C 40 65, 60 65, 75 55 M 25 75 C 40 85, 60 85, 75 75" fill="none" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 25 15 Q 15 45 25 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
                    <path d="M 75 15 Q 85 45 75 85" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>
                  </svg>`,
                },
              },
              {
                id: "seed-el-rect-callout",
                type: "shape",
                name: "Note Card",
                x: 770,
                y: 200,
                width: 320,
                height: 240,
                rotation: 0,
                opacity: 1,
                properties: {
                  shapeType: "rectangle",
                  fill: "#f8fafc",
                  stroke: "#cbd5e1",
                  strokeWidth: 1.5,
                  cornerRadius: 10,
                },
              },
              {
                id: "seed-el-card-text",
                type: "text",
                name: "Card Content",
                x: 795,
                y: 230,
                width: 270,
                height: 160,
                rotation: 0,
                opacity: 1,
                properties: {
                  text: "Key Findings:\n\n• Cellular permeability intact\n• 40% increase in replication\n• Normal mitochondrial count\n• Stable base pairings",
                  fontSize: 15,
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fill: "#334155",
                  fontWeight: "normal",
                  align: "left",
                  lineHeight: 1.5,
                },
              },
            ],
          },
        ],
      },
      {
        id: "design-sample-lab-poster",
        name: "Clinical Assay Report",
        width: 1200,
        height: 800,
        backgroundColor: "#ffffff",
        createdAt: now,
        updatedAt: now,
        pages: [
          {
            id: "page-seed-2",
            name: "Page 1",
            elements: [
              {
                id: "seed-2-banner",
                type: "shape",
                name: "Banner",
                x: 0,
                y: 0,
                width: 1200,
                height: 100,
                rotation: 0,
                opacity: 1,
                properties: {
                  shapeType: "rectangle",
                  fill: "#0f172a",
                  stroke: "transparent",
                  strokeWidth: 0,
                  cornerRadius: 0,
                },
              },
              {
                id: "seed-2-title",
                type: "text",
                name: "Banner Title",
                x: 60,
                y: 35,
                width: 600,
                height: 40,
                rotation: 0,
                opacity: 1,
                properties: {
                  text: "CLINICAL STUDY: PHARMACOKINETICS",
                  fontSize: 22,
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fill: "#ffffff",
                  fontWeight: "bold",
                  align: "left",
                },
              },
              {
                id: "seed-2-flask",
                type: "svg",
                name: "Flask",
                x: 120,
                y: 180,
                width: 200,
                height: 220,
                rotation: 0,
                opacity: 1,
                properties: {
                  originalSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <path d="M 42 12 L 58 12 L 58 35 L 85 82 C 88 88 84 92 78 92 L 22 92 C 16 92 12 88 15 82 L 42 35 Z" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="4" stroke-linejoin="round"/>
                    <path d="M 27 75 L 73 75 L 82 89 C 83 91 80 92 78 92 L 22 92 C 20 92 17 91 18 89 Z" fill="#10b981" fill-opacity="0.75"/>
                  </svg>`,
                  svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <path d="M 42 12 L 58 12 L 58 35 L 85 82 C 88 88 84 92 78 92 L 22 92 C 16 92 12 88 15 82 L 42 35 Z" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="4" stroke-linejoin="round"/>
                    <path d="M 27 75 L 73 75 L 82 89 C 83 91 80 92 78 92 L 22 92 C 20 92 17 91 18 89 Z" fill="#10b981" fill-opacity="0.75"/>
                  </svg>`,
                },
              },
              {
                id: "seed-2-chart",
                type: "svg",
                name: "Chart",
                x: 450,
                y: 190,
                width: 220,
                height: 200,
                rotation: 0,
                opacity: 1,
                properties: {
                  originalSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <rect x="18" y="55" width="16" height="35" rx="3" fill="#3b82f6"/>
                    <rect x="42" y="32" width="16" height="58" rx="3" fill="#60a5fa"/>
                    <rect x="66" y="15" width="16" height="75" rx="3" fill="#2563eb"/>
                    <line x1="12" y1="92" x2="88" y2="92" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
                  </svg>`,
                  svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                    <rect x="18" y="55" width="16" height="35" rx="3" fill="#3b82f6"/>
                    <rect x="42" y="32" width="16" height="58" rx="3" fill="#60a5fa"/>
                    <rect x="66" y="15" width="16" height="75" rx="3" fill="#2563eb"/>
                    <line x1="12" y1="92" x2="88" y2="92" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
                  </svg>`,
                },
              },
            ],
          },
        ],
      },
    ];
  }
}
