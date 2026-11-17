"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@design-platform/auth";
import { ArrowRight, Check, ChevronRight, Search, Globe, Users, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./landing.module.css";
import {
  AntibodyIllustration,
  BacteriumIllustration,
  BrandMark,
  CellIllustration,
  DnaIllustration,
  HeartIllustration,
  MoleculeIllustration,
  NeuronIllustration,
  PathwayIllustration,
  VirionIllustration,
} from "./illustrations";
import {
  AssetsIcon,
  EditPartsIcon,
  ElementsIcon,
  LayersIcon,
  TextIcon,
  UploadsIcon,
} from "../editor/icons/EditorIcons";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Fades sections in as they scroll into view */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(`.${styles.reveal}`));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add(styles.revealIn));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealIn);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const Reveal: React.FC<React.PropsWithChildren<{ className?: string; delay?: number }>> = ({ className, delay = 0, children }) => (
  <div className={cx(styles.reveal, className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
    {children}
  </div>
);

// ==========================================
// Page
// ==========================================

export const LandingPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const signedIn = !isLoading && Boolean(user);
  useReveal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryCta = signedIn ? { href: "/files", label: "Open your designs" } : { href: "/signup", label: "Start designing free" };

  return (
    <div className={styles.page}>
      {/* ---------- Navigation ---------- */}
      <header className={cx(styles.nav, scrolled && styles.navScrolled)}>
        <div className={cx(styles.container, styles.navInner)}>
          <Link href="/" className={styles.logo} aria-label="BioCanvas home">
            <BrandMark size={32} />
            BioCanvas
          </Link>
          <nav className={styles.navLinks} aria-label="Main">
            <a href="#who">Who it’s for</a>
            <a href="#features">Features</a>
            <a href="#library">Library</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.navActions}>
            {signedIn ? (
              <Link href="/files" className={cx(styles.btn, styles.btnSm, styles.btnPrimary)}>
                Open BioCanvas <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.btnText}>
                  Log in
                </Link>
                <Link href="/signup" className={cx(styles.btn, styles.btnSm, styles.btnPrimary)}>
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Hero primaryCta={primaryCta} signedIn={signedIn} />
        <TrustStrip />
        <Personas primaryCta={primaryCta} />
        <Features />
        <Library />
        <HowItWorks />
        <Privacy />
        <Faq />
        <FinalCta primaryCta={primaryCta} signedIn={signedIn} />
      </main>

      <Footer />
    </div>
  );
};

// ==========================================
// Hero
// ==========================================

const Hero: React.FC<{ primaryCta: { href: string; label: string }; signedIn: boolean }> = ({ primaryCta, signedIn }) => (
  <section className={styles.hero}>
    <div className={styles.heroGrid} />
    <div className={cx(styles.container, styles.heroContent)}>
      <span className={styles.eyebrow}>
        <span className={styles.eyebrowTag}>New</span>
        Edit any illustration down to its smallest part
      </span>
      <h1 className={styles.heroTitle}>
        Turn complex science into <span className={styles.gradientText}>figures everyone understands</span>
      </h1>
      <p className={styles.heroLead}>
        BioCanvas is the visual workspace for doctors, researchers and educators. Drag in accurate biomedical illustrations,
        recolor and rearrange every part, and publish figures, slides and patient materials in minutes — no design skills needed.
      </p>
      <div className={styles.heroCtas}>
        <Link href={primaryCta.href} className={cx(styles.btn, styles.btnLg, styles.btnPrimary)}>
          {primaryCta.label} <ArrowRight size={18} />
        </Link>
        {!signedIn && (
          <Link href="/login" className={cx(styles.btn, styles.btnLg, styles.btnGhostDark)}>
            Log in
          </Link>
        )}
      </div>
      <div className={styles.heroNote}>
        <span>
          <Check size={15} /> Works in your browser
        </span>
        <span>
          <Check size={15} /> Nothing to install
        </span>
        <span>
          <Check size={15} /> Invite your whole lab
        </span>
      </div>

      <ProductStage />
    </div>
  </section>
);

/** A faithful mock of the editor with a mechanism-of-action figure */
const ProductStage: React.FC = () => (
  <div className={styles.stage}>
    <div className={styles.stageGlow} />

    <div className={cx(styles.chip, styles.chipA)}>
      <span className={styles.chipIcon}>
        <VirionIllustration />
      </span>
      <div>
        <small>Editing parts</small>
        <div className={styles.crumbs}>
          Virion <ChevronRight size={12} /> Spike <ChevronRight size={12} /> <b>S1 subunit</b>
        </div>
      </div>
    </div>
    <div className={cx(styles.chip, styles.chipB)}>
      <div>
        <strong>Scientific palettes</strong>
        <div className={styles.paletteRow}>
          <span style={{ background: "#ef4444" }} />
          <span style={{ background: "#3b82f6" }} />
          <span style={{ background: "#8b5cf6" }} />
          <span style={{ background: "#14b8a6" }} />
          <span style={{ background: "#f59e0b" }} />
        </div>
      </div>
    </div>
    <div className={cx(styles.chip, styles.chipC)}>
      <div className={styles.avatars}>
        <span className={styles.avatar} style={{ background: "#0ea5e9", marginLeft: 0 }}>
          MK
        </span>
        <span className={styles.avatar} style={{ background: "#8b5cf6" }}>
          JL
        </span>
        <span className={styles.avatar} style={{ background: "#f97316" }}>
          AR
        </span>
      </div>
      <div>
        <strong>3 people editing</strong>
        <small>Changes sync live</small>
      </div>
    </div>
    <div className={cx(styles.chip, styles.chipD)}>
      <span className={styles.chipIcon} style={{ background: "#ecfdf5" }}>
        <Check size={22} color="#059669" />
      </span>
      <div>
        <strong>figure-2-moa.png</strong>
        <small>Exported · ready for your manuscript</small>
      </div>
    </div>

    <div className={styles.window} aria-label="BioCanvas editor preview" role="img">
      <div className={styles.windowBar}>
        <div className={styles.dots}>
          <i />
          <i />
          <i />
        </div>
        <div className={styles.docTitle}>
          <div className={styles.docName}>MEK inhibitor — mechanism of action</div>
          <div className={styles.docMeta}>Oncology lab · Page 2 of 4</div>
        </div>
        <div className={styles.barSpacer} />
        <div className={styles.avatars}>
          <span className={styles.avatar} style={{ background: "#0ea5e9", marginLeft: 0 }}>
            MK
          </span>
          <span className={styles.avatar} style={{ background: "#8b5cf6" }}>
            JL
          </span>
        </div>
        <span className={styles.shareBtn}>Share</span>
      </div>
      <div className={styles.windowBody}>
        <div className={styles.rail}>
          <span className={cx(styles.railItem, styles.railItemActive, "is-active")}>
            <AssetsIcon size={20} />
            Assets
          </span>
          <span className={styles.railItem}>
            <ElementsIcon size={20} />
            Elements
          </span>
          <span className={styles.railItem}>
            <TextIcon size={20} />
            Text
          </span>
          <span className={styles.railItem}>
            <UploadsIcon size={20} />
            Uploads
          </span>
          <span className={styles.railItem}>
            <LayersIcon size={20} />
            Layers
          </span>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Scientific library</div>
          <div className={styles.panelSearch}>
            <Search size={14} /> Search “antibody”, “neuron”…
          </div>
          <div className={styles.panelLabel}>Popular</div>
          <div className={styles.assetGrid}>
            <span className={styles.assetTile}>
              <CellIllustration />
            </span>
            <span className={styles.assetTile}>
              <VirionIllustration />
            </span>
            <span className={styles.assetTile}>
              <AntibodyIllustration />
            </span>
            <span className={styles.assetTile}>
              <DnaIllustration />
            </span>
            <span className={styles.assetTile}>
              <HeartIllustration />
            </span>
            <span className={styles.assetTile}>
              <MoleculeIllustration />
            </span>
          </div>
        </div>
        <div className={styles.canvasArea}>
          <div className={styles.ctxBar}>
            <span className={styles.swatch} style={{ background: "#0ea5e9" }} />
            <span className={styles.swatch} style={{ background: "#6366f1" }} />
            <span className={styles.swatch} style={{ background: "#8b5cf6" }} />
            <span className={styles.ctxSep} />
            <span className={styles.ctxAccent}>
              <EditPartsIcon size={16} /> Edit parts
            </span>
          </div>
          <div className={styles.artboard}>
            <PathwayIllustration title="Signaling pathway with a MEK inhibitor" />
            <div className={styles.selection} style={{ left: "64%", top: "54%", width: "18%", height: "17%" }}>
              <i style={{ left: -5, top: -5 }} />
              <i style={{ right: -5, top: -5 }} />
              <i style={{ left: -5, bottom: -5 }} />
              <i style={{ right: -5, bottom: -5 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ==========================================
// Trust strip (what people make)
// ==========================================

const TrustStrip: React.FC = () => (
  <div className={styles.strip}>
    <div className={cx(styles.container, styles.stripInner)}>
      <span>Made for</span>
      <span>
        <HeartIllustration /> Clinics &amp; hospitals
      </span>
      <span>
        <CellIllustration /> Research labs
      </span>
      <span>
        <DnaIllustration /> Universities
      </span>
      <span>
        <MoleculeIllustration /> Biotech &amp; pharma
      </span>
      <span>
        <AntibodyIllustration /> Medical education
      </span>
    </div>
  </div>
);

// ==========================================
// Personas
// ==========================================

const PersonaGlyph: React.FC<{ kind: string }> = ({ kind }) => {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "doctors":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 3v5a5 5 0 0 0 10 0V3" />
          <path d="M11 13v2a5 5 0 0 0 10 0v-2" />
          <circle cx="21" cy="11" r="2" fill="currentColor" fillOpacity="0.2" />
          <path d="M4 3h4M14 3h4" />
        </svg>
      );
    case "researchers":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 21h12M9 21v-3M7 18h8" />
          <path d="M10 4l4 1-3 9-4-1z" fill="currentColor" fillOpacity="0.2" />
          <path d="M13 14a5 5 0 0 1 3 4M9 2.5l1 .3" />
        </svg>
      );
    case "physicians":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
          <path d="M12 13v5M9.5 15.5h5" />
        </svg>
      );
    case "educators":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 20l4-4 4 4M7 9h6M7 12h10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill="currentColor" fillOpacity="0.15" />
          <path d="M9.2 7.8l5.7 8.3" />
        </svg>
      );
  }
};

interface Persona {
  id: string;
  title: string;
  short: string;
  heading: string;
  body: string;
  points: string[];
  color: string;
  tint: string;
  board: React.ReactNode;
}

const Lines: React.FC<{ widths: number[] }> = ({ widths }) => (
  <div className={styles.lines}>
    {widths.map((w, i) => (
      <i key={i} style={{ width: `${w}%` }} />
    ))}
  </div>
);

const PERSONAS: Persona[] = [
  {
    id: "doctors",
    title: "Doctors & clinicians",
    short: "Explain diagnoses and procedures visually.",
    heading: "Help patients see what you mean",
    body: "Create clear, friendly visuals for consultations, discharge notes and case presentations — without waiting on a medical illustrator.",
    points: ["Patient-education handouts and leaflets", "Procedure and treatment walk-throughs", "Case presentations and grand rounds slides"],
    color: "#e11d48",
    tint: "#fff1f2",
    board: (
      <div className={styles.boardPage}>
        <div className={styles.boardSub}>Patient guide</div>
        <div className={styles.boardTitle}>Understanding your heart</div>
        <div className={styles.boardArt} style={{ height: 180 }}>
          <HeartIllustration />
        </div>
        <Lines widths={[92, 80, 86, 54]} />
      </div>
    ),
  },
  {
    id: "researchers",
    title: "Researchers & scientists",
    short: "Publication-ready figures and abstracts.",
    heading: "Figures reviewers understand at a glance",
    body: "Build graphical abstracts, mechanism diagrams and protocol figures with consistent styling across every panel of your paper.",
    points: ["Graphical abstracts and multi-panel figures", "Signaling pathways with activation and inhibition arrows", "Protocol and workflow schematics"],
    color: "#2563eb",
    tint: "#eff6ff",
    board: (
      <div className={styles.boardPage}>
        <div className={styles.boardSub}>Graphical abstract</div>
        <div className={styles.boardTitle}>Viral entry into host cells</div>
        <div className={styles.boardArt} style={{ height: 180 }}>
          <div style={{ width: 120, height: 120 }}>
            <VirionIllustration />
          </div>
          <ArrowRight size={28} color="#334155" />
          <div style={{ width: 170, height: 170 }}>
            <CellIllustration />
          </div>
        </div>
        <Lines widths={[88, 62]} />
      </div>
    ),
  },
  {
    id: "physicians",
    title: "Physician-scientists",
    short: "Bridge the bench and the bedside.",
    heading: "From mechanism to clinical trial",
    body: "Show how a therapy works and how it is being tested — mechanisms of action, study designs and grant figures in one workspace.",
    points: ["Clinical-trial designs and study flowcharts", "Mechanism-of-action figures for therapies", "Grant, ethics-board and conference visuals"],
    color: "#7c3aed",
    tint: "#f5f3ff",
    board: (
      <div className={styles.boardPage}>
        <div className={styles.boardSub}>Study design</div>
        <div className={styles.boardTitle}>Randomized, double-blind trial</div>
        <div className={styles.boardArt} style={{ height: 120 }}>
          <div className={styles.flow}>
            <span className={styles.flowBox} style={{ background: "#0ea5e9" }}>
              Screening
            </span>
            <span className={styles.flowArrow}>→</span>
            <span className={styles.flowBox} style={{ background: "#6366f1" }}>
              Randomize
            </span>
            <span className={styles.flowArrow}>→</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={styles.flowBox} style={{ background: "#8b5cf6" }}>
                Drug
              </span>
              <span className={styles.flowBox} style={{ background: "#94a3b8" }}>
                Placebo
              </span>
            </span>
            <span className={styles.flowArrow}>→</span>
            <span className={styles.flowBox} style={{ background: "#14b8a6" }}>
              Follow-up
            </span>
          </div>
        </div>
        <div className={styles.boardArt} style={{ height: 110 }}>
          <MoleculeIllustration />
        </div>
      </div>
    ),
  },
  {
    id: "educators",
    title: "Educators & students",
    short: "Lectures, study guides and posters.",
    heading: "Teach the hard parts beautifully",
    body: "Turn dense topics into memorable lecture slides, revision sheets and posters your students actually want to read.",
    points: ["Lecture slides and multi-page handouts", "Labeled diagrams for exams and study guides", "Conference and classroom posters"],
    color: "#0d9488",
    tint: "#f0fdfa",
    board: (
      <div className={styles.boardPage}>
        <div className={styles.boardSub}>Lecture 4</div>
        <div className={styles.boardTitle}>DNA replication</div>
        <div className={styles.boardArt} style={{ height: 190, justifyContent: "space-between" }}>
          <div style={{ height: 180, width: 90 }}>
            <DnaIllustration />
          </div>
          <div style={{ flex: 1 }}>
            <Lines widths={[90, 76, 84, 60, 70]} />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "pharma",
    title: "Biotech & pharma",
    short: "Mechanisms, pipelines and medical affairs.",
    heading: "Communicate your science with confidence",
    body: "Keep mechanisms of action, pipeline graphics and training material consistent across teams, decks and publications.",
    points: ["Mechanism-of-action and target biology visuals", "Medical-affairs and sales-training material", "Shared workspaces with editor and viewer roles"],
    color: "#ea580c",
    tint: "#fff7ed",
    board: (
      <div className={styles.boardPage}>
        <div className={styles.boardSub}>Mechanism of action</div>
        <div className={styles.boardTitle}>Selective MEK inhibition</div>
        <div className={styles.boardArt} style={{ height: 210 }}>
          <PathwayIllustration />
        </div>
      </div>
    ),
  },
];

const Personas: React.FC<{ primaryCta: { href: string; label: string } }> = ({ primaryCta }) => {
  const [active, setActive] = useState(PERSONAS[0]!.id);
  const persona = PERSONAS.find((p) => p.id === active) || PERSONAS[0]!;
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const i = PERSONAS.findIndex((p) => p.id === active);
    const next = PERSONAS[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : PERSONAS.length - 1)) % PERSONAS.length]!;
    setActive(next.id);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)?.focus();
  };

  return (
    <section id="who" className={cx(styles.section, styles.sectionWash)}>
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <span className={styles.kicker}>Who it’s for</span>
          <h2 className={styles.h2}>Built for everyone who explains medicine</h2>
          <p className={styles.lead}>
            Whether you’re talking to a patient, a reviewer or a lecture hall, BioCanvas gives you accurate visuals that fit the moment.
          </p>
        </Reveal>
        <Reveal className={styles.personas}>
          <div className={styles.personaTabs} role="tablist" aria-label="Audiences" ref={tabsRef} onKeyDown={onKey}>
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                data-id={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === active}
                aria-controls="persona-panel"
                tabIndex={p.id === active ? 0 : -1}
                className={cx(styles.personaTab, p.id === active && styles.personaTabActive)}
                onClick={() => setActive(p.id)}
              >
                <span className={styles.personaIcon} style={{ background: p.tint, color: p.color }}>
                  <PersonaGlyph kind={p.id} />
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <span>{p.short}</span>
                </span>
              </button>
            ))}
          </div>
          <div key={persona.id} id="persona-panel" role="tabpanel" className={styles.personaPanel}>
            <div>
              <h3>{persona.heading}</h3>
              <p>{persona.body}</p>
              <ul className={styles.checks}>
                {persona.points.map((pt) => (
                  <li key={pt}>
                    <Check size={18} /> {pt}
                  </li>
                ))}
              </ul>
              <div className={styles.personaCta}>
                <Link href={primaryCta.href} className={cx(styles.btn, styles.btnLight)}>
                  {primaryCta.label} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className={styles.board} style={{ background: `linear-gradient(160deg, ${persona.tint}, #eef2f7)` }}>
              {persona.board}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ==========================================
// Features (bento)
// ==========================================

const LineSample: React.FC<{ end: "arrow" | "bar"; dashed?: boolean; color: string }> = ({ end, dashed, color }) => (
  <svg viewBox="0 0 200 18" preserveAspectRatio="none">
    <line x1="2" y1="9" x2={end === "arrow" ? 186 : 194} y2="9" stroke={color} strokeWidth="3.5" strokeDasharray={dashed ? "9 6" : undefined} />
    {end === "arrow" ? <path d="M198 9 L184 2 L184 16 Z" fill={color} /> : <rect x="194" y="1" width="4" height="16" fill={color} />}
  </svg>
);

const Features: React.FC = () => (
  <section id="features" className={styles.section}>
    <div className={styles.container}>
      <Reveal className={styles.sectionHead}>
        <span className={styles.kicker}>Features</span>
        <h2 className={styles.h2}>Everything you need to make science visual</h2>
        <p className={styles.lead}>A design tool that understands biology — from the molecule to the manuscript.</p>
      </Reveal>
      <div className={styles.bento}>
        <Reveal className={cx(styles.tile, styles.tileDark, styles.span4)}>
          <h3>Edit illustrations down to the molecule</h3>
          <p>
            Double-click any illustration to select a single part — a spike protein, a receptor, an organelle — then move, resize or
            recolor just that piece. Groups nest just like in pro design tools.
          </p>
          <div className={styles.tileVisual}>
            <div className={styles.partsDemo}>
              <VirionIllustration />
              <span className={styles.partsSel} />
              <span className={styles.partsLabel}>
                Virion › Spike › <b>S1</b>
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.span2)} delay={80}>
          <h3>Pathways in minutes</h3>
          <p>Arrows, inhibition bars and dashed translocations made for biology.</p>
          <div className={styles.tileVisual}>
            <div className={styles.lineDemo}>
              <div className={styles.lineRow}>
                <LineSample end="arrow" color="#334155" /> Activates
              </div>
              <div className={styles.lineRow}>
                <LineSample end="bar" color="#e11d48" /> Inhibits
              </div>
              <div className={styles.lineRow}>
                <LineSample end="arrow" dashed color="#7c3aed" /> Translocates
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.span2)}>
          <h3>Scientific color palettes</h3>
          <p>Recolor a whole figure or a single part with palettes made for biology.</p>
          <div className={styles.tileVisual}>
            <div className={styles.paletteDemo}>
              <VirionIllustration />
              <span style={{ filter: "hue-rotate(200deg) saturate(1.1)", display: "flex" }}>
                <VirionIllustration />
              </span>
              <span style={{ filter: "hue-rotate(110deg)", display: "flex" }}>
                <VirionIllustration />
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.span2)} delay={80}>
          <h3>Labels done right</h3>
          <p>Ready-made styles for the details reviewers notice.</p>
          <div className={styles.tileVisual}>
            <div className={styles.labelDemo}>
              <span className={styles.tag}>Species</span>
              <i style={{ fontSize: 18 }}>Escherichia coli</i>
              <span className={styles.tag}>Gene</span>
              <i style={{ fontSize: 18, fontWeight: 600 }}>TP53</i>
              <span className={styles.tag}>Formula</span>
              <span style={{ fontSize: 18 }}>H₂O + CO₂ → H₂CO₃</span>
              <span className={styles.tag}>Scale</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <i style={{ display: "inline-block", width: 70, height: 6, background: "#0f172a", borderRadius: 2 }} /> 10 µm
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.span2)} delay={160}>
          <h3>Multi-page documents</h3>
          <p>Posters, handouts and lecture decks with pages you can reorder, duplicate and present.</p>
          <div className={styles.tileVisual}>
            <div className={styles.pagesDemo}>
              <div style={{ left: 0, top: 50, transform: "rotate(-8deg)" }}>
                <DnaIllustration />
              </div>
              <div style={{ left: 30, top: 24, transform: "rotate(-2deg)" }}>
                <HeartIllustration />
              </div>
              <div style={{ left: 60, top: 0, transform: "rotate(5deg)" }}>
                <CellIllustration />
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.span3)}>
          <h3>Work together in real time</h3>
          <p>Invite your lab or care team, see who’s editing, and share view-only links with reviewers and patients.</p>
          <div className={styles.tileVisual}>
            <div className={styles.collabDemo}>
              <div className={styles.collabRow}>
                <span className={styles.avatar} style={{ background: "#0ea5e9", marginLeft: 0 }}>
                  MK
                </span>
                Principal investigator <em>Owner</em>
              </div>
              <div className={styles.collabRow}>
                <span className={styles.avatar} style={{ background: "#8b5cf6", marginLeft: 0 }}>
                  JL
                </span>
                Postdoc <em>Can edit</em>
              </div>
              <div className={styles.collabRow}>
                <span className={styles.avatar} style={{ background: "#f97316", marginLeft: 0 }}>
                  AR
                </span>
                Journal reviewer <em>Can view</em>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal className={cx(styles.tile, styles.tileDark, styles.span3)} delay={80}>
          <h3>Export, present and reuse</h3>
          <p>Download high-resolution PNGs for papers and slides, keep speaker notes per page, and reuse figures across projects.</p>
          <div className={styles.tileVisual}>
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {["figure-1.png", "figure-2.png", "poster.png", "lecture-4.png"].map((f) => (
                <span
                  key={f}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Check size={16} color="#5eead4" /> {f}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

// ==========================================
// Library
// ==========================================

const FIELDS: Array<{ title: string; body: string; tint: string; art: React.ReactNode }> = [
  { title: "Cell biology", body: "Cells, organelles, membranes and transport.", tint: "#fdf2f8", art: <CellIllustration /> },
  { title: "Virology", body: "Virions, capsids, spike proteins and entry.", tint: "#fff1f2", art: <VirionIllustration /> },
  { title: "Immunology", body: "Antibodies, receptors and immune cells.", tint: "#eff6ff", art: <AntibodyIllustration /> },
  { title: "Genetics", body: "DNA, RNA, replication and gene expression.", tint: "#ecfeff", art: <DnaIllustration /> },
  { title: "Neuroscience", body: "Neurons, synapses and signaling.", tint: "#eef2ff", art: <NeuronIllustration /> },
  { title: "Cardiology", body: "Heart anatomy, vessels and circulation.", tint: "#fef2f2", art: <HeartIllustration /> },
  { title: "Microbiology", body: "Bacteria, structures and growth.", tint: "#f0fdf4", art: <BacteriumIllustration /> },
  { title: "Pharmacology", body: "Molecules, drug forms and mechanisms.", tint: "#f5f3ff", art: <MoleculeIllustration /> },
];

const Library: React.FC = () => (
  <section id="library" className={cx(styles.section, styles.sectionWash)}>
    <div className={styles.container}>
      <Reveal className={styles.sectionHead}>
        <span className={styles.kicker}>Scientific library</span>
        <h2 className={styles.h2}>A library that speaks medicine</h2>
        <p className={styles.lead}>
          Search by structure, organism or field. Every illustration is a vector you can recolor, resize and take apart.
        </p>
      </Reveal>
      <div className={styles.library}>
        {FIELDS.map((f, i) => (
          <Reveal key={f.title} className={styles.field} delay={(i % 4) * 70}>
            <div className={styles.fieldArt} style={{ background: f.tint }}>
              {f.art}
            </div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

// ==========================================
// How it works
// ==========================================

const HowItWorks: React.FC = () => (
  <section id="how" className={styles.section}>
    <div className={styles.container}>
      <Reveal className={styles.sectionHead}>
        <span className={styles.kicker}>How it works</span>
        <h2 className={styles.h2}>From idea to figure in three steps</h2>
      </Reveal>
      <div className={styles.steps}>
        {[
          ["Start a design", "Pick a page size for a paper figure, slide, poster or handout — or start from a blank canvas."],
          ["Drag, drop and refine", "Add illustrations, shapes, pathway arrows and labels. Double-click to edit any part, recolor with scientific palettes."],
          ["Share and publish", "Invite collaborators, collect feedback with view-only links, and export high-resolution images."],
        ].map(([title, body], i) => (
          <Reveal key={title} className={styles.step} delay={i * 90}>
            <span className={styles.stepNum}>{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

// ==========================================
// Privacy
// ==========================================

const Privacy: React.FC = () => (
  <section className={cx(styles.section, styles.sectionWash)}>
    <div className={cx(styles.container, styles.privacy)}>
      <Reveal>
        <span className={styles.kicker}>Private by default</span>
        <h2 className={styles.h2} style={{ textAlign: "left" }}>
          Your research stays yours
        </h2>
        <p className={styles.lead}>Unpublished data deserves care. You decide who sees each design, and access is easy to change.</p>
        <div className={styles.privacyList} style={{ marginTop: 28 }}>
          {[
            [<Users key="u" size={22} color="#047857" />, "Team workspaces", "Keep lab, department or company projects together in their own workspace."],
            [<ShieldCheck key="s" size={22} color="#0d9488" />, "Roles for every member", "Owners manage access, editors design, viewers can only look."],
            [<Globe key="g" size={22} color="#65a30d" />, "Share links you control", "Send a view-only link to a reviewer or patient — and turn it off anytime."],
          ].map(([icon, title, body]) => (
            <div key={title as string} className={styles.privacyItem}>
              {icon}
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className={styles.roleCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <BrandMark size={28} />
            <strong>Neuro-oncology lab</strong>
          </div>
          {[
            ["MK", "#0ea5e9", "Dr. M. Kim", "Owner", "#064e3b", "#a7f3d0"],
            ["JL", "#8b5cf6", "J. Lopez", "Editor", "#134e4a", "#99f6e4"],
            ["AR", "#f97316", "A. Rao", "Editor", "#134e4a", "#99f6e4"],
            ["RV", "#14b8a6", "Reviewer link", "Viewer", "#334155", "#e2e8f0"],
          ].map(([init, bg, name, role, roleBg, roleFg]) => (
            <div key={name} className={styles.roleRow}>
              <span className={styles.avatar} style={{ background: bg, marginLeft: 0, borderColor: "transparent" }}>
                {init}
              </span>
              {name}
              <span className={styles.roleBadge} style={{ background: roleBg, color: roleFg }}>
                {role}
              </span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  </section>
);

// ==========================================
// FAQ
// ==========================================

const FAQS: Array<[string, string]> = [
  [
    "Do I need design experience?",
    "No. Start from a page size, drag illustrations onto it and adjust colors and labels from simple panels. Everything snaps, aligns and exports for you.",
  ],
  [
    "Can I change parts of an illustration?",
    "Yes. Double-click an illustration to select an individual part — like one spike protein or a single organelle — then move, resize, recolor, duplicate or delete it.",
  ],
  [
    "Can my team work on the same figure?",
    "Yes. Invite people to your workspace as editors or viewers, see who is editing, and share view-only links with people outside your team.",
  ],
  [
    "What can I export?",
    "Download any page as a high-resolution PNG for manuscripts, slides and posters. Multi-page designs keep each page separate so you can export exactly what you need.",
  ],
  [
    "Can I use my own images and SVGs?",
    "Yes. Upload PNG, JPG, WebP or SVG files and use them alongside the library. Uploaded SVGs can be recolored like any other illustration.",
  ],
];

const Faq: React.FC = () => (
  <section id="faq" className={styles.section}>
    <div className={styles.container}>
      <Reveal className={styles.sectionHead}>
        <span className={styles.kicker}>FAQ</span>
        <h2 className={styles.h2}>Questions, answered</h2>
      </Reveal>
      <Reveal className={styles.faq}>
        {FAQS.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </Reveal>
    </div>
  </section>
);

// ==========================================
// Final CTA + footer
// ==========================================

const FinalCta: React.FC<{ primaryCta: { href: string; label: string }; signedIn: boolean }> = ({ primaryCta, signedIn }) => (
  <section className={styles.section} style={{ paddingTop: 0 }}>
    <div className={styles.container}>
      <Reveal className={styles.cta}>
        <div className={cx(styles.ctaArt, styles.ctaArtLeft)}>
          <CellIllustration />
        </div>
        <div className={cx(styles.ctaArt, styles.ctaArtRight)}>
          <VirionIllustration />
        </div>
        <Sparkles size={28} color="#6ee7b7" style={{ position: "relative" }} />
        <h2>Your next figure starts here</h2>
        <p>Join clinicians, researchers and educators who explain science visually with BioCanvas.</p>
        <div className={styles.heroCtas}>
          <Link href={primaryCta.href} className={cx(styles.btn, styles.btnLg, styles.btnPrimary)}>
            {signedIn ? primaryCta.label : "Create your free account"} <ArrowRight size={18} />
          </Link>
          {!signedIn && (
            <Link href="/login" className={cx(styles.btn, styles.btnLg, styles.btnGhostDark)}>
              I already have an account
            </Link>
          )}
        </div>
      </Reveal>
    </div>
  </section>
);

const Footer: React.FC = () => (
  <footer className={styles.footer}>
    <div className={cx(styles.container, styles.footerGrid)}>
      <div className={styles.footerBrand}>
        <Link href="/" className={styles.logoDark}>
          <BrandMark size={30} />
          BioCanvas
        </Link>
        <p>The visual workspace for medical and life-science communication.</p>
      </div>
      <div className={styles.footerCol}>
        <h4>Product</h4>
        <a href="#features">Features</a>
        <a href="#library">Library</a>
        <a href="#how">How it works</a>
      </div>
      <div className={styles.footerCol}>
        <h4>Who it’s for</h4>
        <a href="#who">Doctors &amp; clinicians</a>
        <a href="#who">Researchers</a>
        <a href="#who">Educators</a>
      </div>
      <div className={styles.footerCol}>
        <h4>Account</h4>
        <Link href="/login">Log in</Link>
        <Link href="/signup">Create account</Link>
        <a href="#faq">FAQ</a>
      </div>
    </div>
    <div className={cx(styles.container, styles.footerBottom)}>
      <span>© {new Date().getFullYear()} BioCanvas</span>
      <span>Made for clearer science communication</span>
    </div>
  </footer>
);
