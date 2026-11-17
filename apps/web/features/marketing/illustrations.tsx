"use client";

import React, { useId } from "react";

// ==========================================
// Scientific illustrations for the landing page.
// Hand-built SVG with soft shading (gradients + highlights) so they read as
// "realistic" at any size. Repeated structures (membranes, spikes, helices)
// are generated, which keeps every drawing consistent.
// ==========================================

type IllustrationProps = { className?: string; title?: string };

/** Unique, url()-safe gradient ids per instance */
const useIds = (...names: string[]) => {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  return Object.fromEntries(names.map((n) => [n, `${n}-${base}`])) as Record<string, string>;
};

const Svg: React.FC<React.PropsWithChildren<IllustrationProps & { viewBox: string }>> = ({
  viewBox,
  className,
  title,
  children,
}) => (
  <svg viewBox={viewBox} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    {children}
  </svg>
);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Animal cell ----------

export const CellIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("cyto", "nuc", "mito", "shine", "soft");
  const beads = range(72).map((i) => {
    const a = (i / 72) * Math.PI * 2;
    return { x: r2(200 + 168 * Math.cos(a)), y: r2(200 + 156 * Math.sin(a)) };
  });
  const mito = (x: number, y: number, rot: number, s = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse rx="36" ry="17" fill={`url(#${id.mito})`} stroke="#c2410c" strokeWidth="3" />
      <path d="M-26 0 l6 -9 l6 16 l6 -16 l6 16 l6 -16 l6 16 l6 -9" fill="none" stroke="#fff7ed" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
  return (
    <Svg viewBox="0 0 400 400" {...props}>
      <defs>
        <radialGradient id={id.cyto} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fff1f7" />
          <stop offset="0.6" stopColor="#fbcfe8" />
          <stop offset="1" stopColor="#f9a8d4" />
        </radialGradient>
        <radialGradient id={id.nuc} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ede9fe" />
          <stop offset="0.55" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
        <linearGradient id={id.mito} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fed7aa" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id={id.shine} cx="30%" cy="22%" r="40%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={id.soft} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#831843" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter={`url(#${id.soft})`}>
        <ellipse cx="200" cy="200" rx="172" ry="160" fill={`url(#${id.cyto})`} stroke="#ec4899" strokeWidth="5" />
      </g>
      {beads.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="3.6" fill="#f472b6" />
      ))}
      {/* Endoplasmic reticulum */}
      <g fill="none" stroke="#c084fc" strokeWidth="5" strokeLinecap="round" opacity="0.75">
        <path d="M105 130 q20 -30 50 -28 q30 2 34 -12" />
        <path d="M95 160 q14 -36 46 -40 q34 -4 52 -26" />
        <path d="M100 255 q22 30 60 26 q30 -4 40 18" />
        <path d="M120 280 q30 26 64 20" />
      </g>
      {/* Nucleus */}
      <ellipse cx="185" cy="192" rx="72" ry="64" fill={`url(#${id.nuc})`} stroke="#6d28d9" strokeWidth="4" />
      {range(18).map((i) => {
        const a = (i / 18) * Math.PI * 2;
        return <circle key={i} cx={r2(185 + 72 * Math.cos(a))} cy={r2(192 + 64 * Math.sin(a))} r="3" fill="#ede9fe" />;
      })}
      <g fill="none" stroke="#ede9fe" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <path d="M150 185 q10 -14 22 -4 t22 -2" />
        <path d="M160 222 q12 10 26 0 t24 4" />
        <path d="M150 205 q8 6 16 -2" />
      </g>
      <ellipse cx="200" cy="180" rx="20" ry="16" fill="#4c1d95" />
      <ellipse cx="195" cy="175" rx="7" ry="5" fill="#a78bfa" opacity="0.7" />
      {/* Organelles */}
      {mito(300, 150, -25)}
      {mito(292, 268, 30, 0.9)}
      {mito(110, 220, 80, 0.8)}
      <g fill="none" stroke="#14b8a6" strokeWidth="7" strokeLinecap="round">
        <path d="M262 214 q22 -14 44 0" />
        <path d="M258 228 q26 -14 52 0" />
        <path d="M262 242 q22 -14 44 0" />
      </g>
      <circle cx="320" cy="214" r="8" fill="#5eead4" stroke="#0d9488" strokeWidth="2.5" />
      <circle cx="248" cy="196" r="6" fill="#5eead4" stroke="#0d9488" strokeWidth="2" />
      <circle cx="232" cy="300" r="15" fill="#fde047" stroke="#ca8a04" strokeWidth="3" />
      <circle cx="140" cy="300" r="9" fill="#93c5fd" stroke="#2563eb" strokeWidth="2.5" />
      <circle cx="260" cy="110" r="7" fill="#93c5fd" stroke="#2563eb" strokeWidth="2" />
      {range(22).map((i) => (
        <circle key={i} cx={110 + ((i * 53) % 200)} cy={110 + ((i * 89) % 190)} r="2" fill="#be185d" opacity="0.45" />
      ))}
      <ellipse cx="200" cy="200" rx="172" ry="160" fill={`url(#${id.shine})`} />
    </Svg>
  );
};

// ---------- Virion ----------

export const VirionIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("body", "spike", "shine", "shadow");
  const spikes = range(16).map((i) => (i / 16) * Math.PI * 2 + 0.1);
  return (
    <Svg viewBox="0 0 300 300" {...props}>
      <defs>
        <radialGradient id={id.body} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffe4e6" />
          <stop offset="0.55" stopColor="#fb7185" />
          <stop offset="1" stopColor="#be123c" />
        </radialGradient>
        <radialGradient id={id.spike} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={id.shine} cx="32%" cy="26%" r="38%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={id.shadow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#881337" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter={`url(#${id.shadow})`}>
        {spikes.map((a, i) => {
          const x1 = 150 + 88 * Math.cos(a);
          const y1 = 150 + 88 * Math.sin(a);
          const x2 = 150 + 122 * Math.cos(a);
          const y2 = 150 + 122 * Math.sin(a);
          const hx = 150 + 130 * Math.cos(a);
          const hy = 150 + 130 * Math.sin(a);
          const deg = (a * 180) / Math.PI + 90;
          return (
            <g key={i}>
              <line x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} stroke="#b45309" strokeWidth="7" strokeLinecap="round" />
              <g transform={`translate(${r2(hx)} ${r2(hy)}) rotate(${r2(deg)})`}>
                <circle cx="-7" cy="2" r="8.5" fill={`url(#${id.spike})`} stroke="#b45309" strokeWidth="2" />
                <circle cx="7" cy="2" r="8.5" fill={`url(#${id.spike})`} stroke="#b45309" strokeWidth="2" />
                <circle cx="0" cy="-7" r="8.5" fill={`url(#${id.spike})`} stroke="#b45309" strokeWidth="2" />
              </g>
            </g>
          );
        })}
        <circle cx="150" cy="150" r="96" fill={`url(#${id.body})`} stroke="#9f1239" strokeWidth="4" />
      </g>
      {range(26).map((i) => {
        const a = (i / 26) * Math.PI * 2;
        return <circle key={i} cx={r2(150 + 90 * Math.cos(a))} cy={r2(150 + 90 * Math.sin(a))} r="3.2" fill="#ffe4e6" opacity="0.85" />;
      })}
      <path
        d="M110 140 q14 -26 34 -8 t34 2 q14 18 -8 32 t-40 6 q-24 -6 -20 -32z"
        fill="none"
        stroke="#fff1f2"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.65"
      />
      <circle cx="150" cy="150" r="96" fill={`url(#${id.shine})`} />
    </Svg>
  );
};

// ---------- Antibody (IgG) ----------

export const AntibodyIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("heavy", "light", "shadow");
  const chain = (x: number, y: number, h: number, fill: string, rot = 0) => (
    <rect x={x - 11} y={y} width="22" height={h} rx="11" fill={fill} stroke="#1e3a8a" strokeWidth="2.5" transform={`rotate(${rot} ${x} ${y + h})`} />
  );
  return (
    <Svg viewBox="0 0 240 240" {...props}>
      <defs>
        <linearGradient id={id.heavy} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={id.light} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
        <filter id={id.shadow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#1e3a8a" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter={`url(#${id.shadow})`}>
        {chain(108, 128, 86, `url(#${id.heavy})`)}
        {chain(132, 128, 86, `url(#${id.heavy})`)}
        {/* Fab arms: heavy chain inside, light chain outside */}
        {chain(104, 50, 86, `url(#${id.heavy})`, -38)}
        {chain(136, 50, 86, `url(#${id.heavy})`, 38)}
        {chain(80, 58, 66, `url(#${id.light})`, -38)}
        {chain(160, 58, 66, `url(#${id.light})`, 38)}
      </g>
      <path d="M108 148 h24 M108 160 h24" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="36" r="9" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />
      <circle cx="200" cy="36" r="9" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />
    </Svg>
  );
};

// ---------- DNA double helix ----------

export const DnaIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("a", "b");
  const H = 360;
  const strand = (phase: number) =>
    range(H / 4 + 1)
      .map((i) => {
        const y = i * 4 + 20;
        const x = 100 + 56 * Math.sin(y / 34 + phase);
        return `${i === 0 ? "M" : "L"}${r2(x)} ${y}`;
      })
      .join(" ");
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];
  return (
    <Svg viewBox="0 0 200 400" {...props}>
      <defs>
        <linearGradient id={id.a} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={id.b} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {range(17).map((i) => {
        const y = 30 + i * 20;
        const s = Math.sin(y / 34);
        const depth = Math.abs(Math.cos(y / 34));
        return (
          <line
            key={i}
            x1={r2(100 + 56 * s)}
            y1={y}
            x2={r2(100 + 56 * Math.sin(y / 34 + Math.PI))}
            y2={y}
            stroke={colors[i % 4]}
            strokeWidth="6"
            strokeLinecap="round"
            opacity={r2(0.45 + 0.55 * depth)}
          />
        );
      })}
      <path d={strand(Math.PI)} fill="none" stroke={`url(#${id.b})`} strokeWidth="9" strokeLinecap="round" opacity="0.85" />
      <path d={strand(0)} fill="none" stroke={`url(#${id.a})`} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
};

// ---------- Neuron ----------

export const NeuronIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("soma", "myelin");
  return (
    <Svg viewBox="0 0 420 240" {...props}>
      <defs>
        <radialGradient id={id.soma} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#e0e7ff" />
          <stop offset="0.6" stopColor="#818cf8" />
          <stop offset="1" stopColor="#4338ca" />
        </radialGradient>
        <linearGradient id={id.myelin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#6366f1" strokeLinecap="round">
        <path d="M86 112 q-30 -30 -62 -36" strokeWidth="7" />
        <path d="M44 82 q-8 -18 -22 -24" strokeWidth="4" />
        <path d="M80 130 q-36 14 -58 46" strokeWidth="7" />
        <path d="M40 160 q-20 -2 -30 8" strokeWidth="4" />
        <path d="M100 92 q-6 -40 10 -70" strokeWidth="6" />
        <path d="M104 50 q14 -10 28 -8" strokeWidth="3.5" />
        <path d="M104 150 q4 40 -12 70" strokeWidth="6" />
        <path d="M150 120 C 200 120, 230 132, 300 128 S 370 120, 384 112" strokeWidth="8" />
        <path d="M384 112 l22 -20 M384 112 l24 6 M384 112 l14 24" strokeWidth="4" />
      </g>
      {[176, 216, 256, 296, 334].map((x, i) => (
        <rect key={i} x={x} y={i < 3 ? 115 : 117 - (i - 2) * 3} width="30" height="20" rx="10" fill={`url(#${id.myelin})`} stroke="#b45309" strokeWidth="2" />
      ))}
      {[
        [406, 92],
        [408, 118],
        [398, 136],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill="#c7d2fe" stroke="#4338ca" strokeWidth="2.5" />
      ))}
      <circle cx="110" cy="120" r="40" fill={`url(#${id.soma})`} stroke="#3730a3" strokeWidth="4" />
      <circle cx="104" cy="114" r="14" fill="#3730a3" />
      <circle cx="100" cy="110" r="5" fill="#a5b4fc" />
    </Svg>
  );
};

// ---------- Heart ----------

export const HeartIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("muscle", "shine");
  return (
    <Svg viewBox="0 0 300 300" {...props}>
      <defs>
        <radialGradient id={id.muscle} cx="38%" cy="35%" r="75%">
          <stop offset="0" stopColor="#fecaca" />
          <stop offset="0.55" stopColor="#ef4444" />
          <stop offset="1" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={id.shine} cx="35%" cy="35%" r="35%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Great vessels */}
      <path d="M142 96 V60 q0 -34 40 -34 q40 0 40 40 v26" fill="none" stroke="#dc2626" strokeWidth="26" strokeLinecap="round" />
      <path d="M142 96 V60 q0 -34 40 -34 q40 0 40 40 v26" fill="none" stroke="#fca5a5" strokeWidth="8" strokeLinecap="round" opacity="0.55" />
      <path d="M118 104 q-6 -46 -44 -50" fill="none" stroke="#2563eb" strokeWidth="22" strokeLinecap="round" />
      <path d="M118 104 q-6 -46 -44 -50" fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
      <path d="M170 36 v-16 M196 30 v-16 M216 40 l10 -12" stroke="#dc2626" strokeWidth="9" strokeLinecap="round" />
      {/* Heart body */}
      <path
        d="M150 270 C 70 222, 44 168, 54 132 C 64 94, 112 82, 140 108 C 160 84, 214 84, 236 118 C 262 160, 228 226, 150 270 Z"
        fill={`url(#${id.muscle})`}
        stroke="#7f1d1d"
        strokeWidth="4"
      />
      <path d="M150 112 C 136 160, 150 210, 186 240" fill="none" stroke="#7f1d1d" strokeWidth="3" opacity="0.5" />
      <g fill="none" strokeLinecap="round" strokeWidth="3.5">
        <path d="M150 116 c -20 30 -30 60 -24 96" stroke="#fde68a" />
        <path d="M126 160 c -14 6 -24 18 -26 30" stroke="#fde68a" />
        <path d="M200 126 c 14 24 16 52 4 80" stroke="#fde68a" />
      </g>
      <path
        d="M150 270 C 70 222, 44 168, 54 132 C 64 94, 112 82, 140 108 C 160 84, 214 84, 236 118 C 262 160, 228 226, 150 270 Z"
        fill={`url(#${id.shine})`}
      />
    </Svg>
  );
};

// ---------- Bacterium ----------

export const BacteriumIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("body", "shine");
  return (
    <Svg viewBox="0 0 360 220" {...props}>
      <defs>
        <linearGradient id={id.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bbf7d0" />
          <stop offset="0.6" stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id={id.shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round">
        <path d="M290 110 q20 -20 36 0 t36 0" />
        <path d="M282 80 q22 -26 40 -10 t30 -16" />
        <path d="M284 142 q24 18 40 4 t32 14" />
      </g>
      {range(14).map((i) => {
        const x = 90 + i * 14;
        return (
          <g key={i} stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
            <line x1={x} y1="62" x2={x - 4} y2="48" />
            <line x1={x} y1="158" x2={x + 4} y2="172" />
          </g>
        );
      })}
      <rect x="60" y="60" width="240" height="100" rx="50" fill={`url(#${id.body})`} stroke="#166534" strokeWidth="4" />
      <rect x="70" y="68" width="220" height="84" rx="42" fill="none" stroke="#dcfce7" strokeWidth="2.5" opacity="0.7" />
      <path d="M110 112 q16 -20 34 -4 t32 -2 t36 6 t30 -8" fill="none" stroke="#14532d" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      {range(16).map((i) => (
        <circle key={i} cx={96 + ((i * 37) % 170)} cy={84 + ((i * 23) % 52)} r="3" fill="#166534" opacity="0.55" />
      ))}
      <rect x="76" y="66" width="208" height="30" rx="15" fill={`url(#${id.shine})`} />
    </Svg>
  );
};

// ---------- Drug molecule + capsule ----------

export const MoleculeIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("capA", "capB", "atom");
  const hex = range(6).map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [r2(120 + 46 * Math.cos(a)), r2(118 + 46 * Math.sin(a))] as const;
  });
  return (
    <Svg viewBox="0 0 320 260" {...props}>
      <defs>
        <linearGradient id={id.capA} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={id.capB} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id={id.atom} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#0ea5e9" />
        </radialGradient>
      </defs>
      <g stroke="#0f172a" strokeWidth="5" strokeLinecap="round">
        {hex.map(([x, y], i) => {
          const [nx, ny] = hex[(i + 1) % 6]!;
          return <line key={i} x1={x} y1={y} x2={nx} y2={ny} />;
        })}
        <line x1={hex[1]![0]} y1={hex[1]![1]} x2="214" y2="76" />
        <line x1={hex[3]![0]} y1={hex[3]![1]} x2="120" y2="214" />
        <line x1={hex[5]![0]} y1={hex[5]![1]} x2="30" y2="80" />
      </g>
      <g stroke="#0f172a" strokeWidth="3" opacity="0.5">
        <line x1="104" y1="95" x2="84" y2="128" />
        <line x1="138" y1="96" x2="158" y2="128" />
      </g>
      {[...hex, [214, 76], [120, 214], [30, 80]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i < 6 ? 12 : 16} fill={i === 7 ? "#ef4444" : i === 8 ? "#3b82f6" : `url(#${id.atom})`} stroke="#0f172a" strokeWidth="2.5" />
      ))}
      <g transform="translate(232 168) rotate(-35)">
        <rect x="-62" y="-24" width="62" height="48" rx="24" fill={`url(#${id.capA})`} stroke="#4c1d95" strokeWidth="3" />
        <rect x="-2" y="-24" width="62" height="48" rx="24" fill={`url(#${id.capB})`} stroke="#475569" strokeWidth="3" />
        <rect x="-50" y="-16" width="42" height="9" rx="4.5" fill="#fff" opacity="0.45" />
      </g>
    </Svg>
  );
};

// ---------- Signaling pathway (mechanism of action) ----------

export const PathwayIllustration: React.FC<IllustrationProps> = (props) => {
  const id = useIds("rec", "kin", "nuc", "drug", "arrow", "bar");
  const heads = range(30).map((i) => 12 + i * 20);
  const kinase = (x: number, y: number, label: string, fill: string) => (
    <g>
      <ellipse cx={x} cy={y} rx="38" ry="22" fill={fill} stroke="#0f172a" strokeOpacity="0.25" strokeWidth="2" />
      <ellipse cx={x - 10} cy={y - 8} rx="18" ry="6" fill="#fff" opacity="0.35" />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
  return (
    <Svg viewBox="0 0 600 420" {...props}>
      <defs>
        <linearGradient id={id.rec} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id={id.nuc} cx="50%" cy="0%" r="100%">
          <stop offset="0" stopColor="#ede9fe" />
          <stop offset="1" stopColor="#c4b5fd" />
        </radialGradient>
        <linearGradient id={id.drug} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fda4af" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <marker id={id.arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#334155" />
        </marker>
        <marker id={id.bar} viewBox="0 0 4 12" refX="2" refY="6" markerWidth="4" markerHeight="12" orient="auto">
          <rect x="0" y="0" width="4" height="12" fill="#e11d48" />
        </marker>
      </defs>
      {/* Plasma membrane (bilayer) */}
      <rect x="0" y="70" width="600" height="44" fill="#fef3c7" />
      {heads.map((x) => (
        <g key={x}>
          <line x1={x} y1="80" x2={x - 3} y2="92" stroke="#d97706" strokeWidth="2" />
          <line x1={x} y1="104" x2={x + 3} y2="92" stroke="#d97706" strokeWidth="2" />
          <circle cx={x} cy="76" r="7" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
          <circle cx={x} cy="108" r="7" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
        </g>
      ))}
      {/* Receptor + ligand */}
      <rect x="236" y="44" width="22" height="104" rx="11" fill={`url(#${id.rec})`} stroke="#1e3a8a" strokeWidth="2" />
      <rect x="262" y="44" width="22" height="104" rx="11" fill={`url(#${id.rec})`} stroke="#1e3a8a" strokeWidth="2" />
      <path d="M248 44 q12 -26 24 0" fill="none" stroke="#1e3a8a" strokeWidth="3" />
      <polygon points="260,6 276,16 276,34 260,44 244,34 244,16" fill="#22c55e" stroke="#15803d" strokeWidth="2.5" />
      <text x="300" y="30" fontSize="14" fontWeight="600" fill="#0f172a" fontFamily="Inter, system-ui, sans-serif">Growth factor</text>
      <text x="300" y="138" fontSize="13" fill="#475569" fontFamily="Inter, system-ui, sans-serif">Receptor tyrosine kinase</text>
      {/* Cascade */}
      <g stroke="#334155" strokeWidth="3" fill="none" markerEnd={`url(#${id.arrow})`}>
        <path d="M260 152 L 160 186" />
        <path d="M196 206 L 290 222" />
        <path d="M330 240 L 420 262" />
        <path d="M444 292 L 444 336" />
      </g>
      {kinase(150, 196, "RAS", "#0ea5e9")}
      {kinase(310, 226, "RAF", "#6366f1")}
      {kinase(444, 270, "MEK", "#8b5cf6")}
      {/* Inhibitor drug */}
      <g transform="translate(560 214)">
        <rect x="-28" y="-14" width="56" height="28" rx="14" fill={`url(#${id.drug})`} stroke="#9f1239" strokeWidth="2" transform="rotate(-20)" />
      </g>
      <path d="M540 226 L 486 256" stroke="#e11d48" strokeWidth="3.5" markerEnd={`url(#${id.bar})`} />
      <text x="510" y="190" fontSize="13" fontWeight="600" fill="#be123c" fontFamily="Inter, system-ui, sans-serif">Inhibitor</text>
      {/* Nucleus */}
      <path d="M200 420 Q 200 344 420 340 Q 640 344 640 420 Z" fill={`url(#${id.nuc})`} stroke="#7c3aed" strokeWidth="3" />
      <path d="M300 392 q14 -16 28 0 t28 0 t28 0 t28 0 t28 0" fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" />
      <text x="452" y="372" fontSize="13" fontWeight="600" fill="#5b21b6" fontFamily="Inter, system-ui, sans-serif">Gene expression</text>
      {[
        [150, 196, 1],
        [310, 226, 2],
        [444, 270, 3],
      ].map(([x, y, n]) => (
        <g key={n}>
          <circle cx={x + 34} cy={y - 22} r="11" fill="#0f172a" />
          <text x={x + 34} y={y - 22} dy="0.35em" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui, sans-serif">
            {n}
          </text>
        </g>
      ))}
    </Svg>
  );
};

// ---------- Brand mark ----------

export const BrandMark: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const id = useIds("g");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id.g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.5" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id.g})`} />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2" opacity="0.9" />
      <circle cx="14" cy="14.5" r="3.6" fill="#fff" />
      <circle cx="20.5" cy="19.5" r="1.6" fill="#fff" opacity="0.85" />
      <circle cx="11" cy="20" r="1.2" fill="#fff" opacity="0.7" />
    </svg>
  );
};
