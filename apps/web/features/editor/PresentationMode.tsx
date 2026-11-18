"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DesignDocument, Page, getPageBackground } from "@design-platform/types";
import { ChevronLeft, ChevronRight, Keyboard, LayoutGrid, Maximize, Minimize, Timer, X } from "lucide-react";
import { PageThumbnailPreview } from "./PageThumbnailPreview";
import { PRESENT_SHORTCUTS, formatKeys } from "./KeyboardShortcuts";

// ==========================================
// Presentation mode: shows the design's pages one at a time, full screen.
// - Next: → ↓ Space Page Down Enter N, a click, or a swipe left
// - Previous: ← ↑ Page Up Backspace P, or a swipe right
// - Number + Enter jumps to a page; Home / End; G overview; B blur; F full screen
// - Esc (or leaving the browser's full screen) stops presenting
// While it is open, every key is kept away from the editor underneath.
// ==========================================

export interface PresentationModeProps {
  document: DesignDocument;
  /** Page to open on */
  startIndex: number;
  /** Called with the page shown last, so the editor can land there */
  onExit: (pageIndex: number) => void;
}

/** Controls and cursor hide after this long without mouse movement */
const IDLE_MS = 2500;
/** Horizontal finger travel that counts as a swipe */
const SWIPE_PX = 50;
const NEXT_KEYS = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"];
const PREV_KEYS = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pad = (n: number) => String(n).padStart(2, "0");
const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const PresentationMode: React.FC<PresentationModeProps> = ({ document: design, startIndex, onExit }) => {
  const pages = design.pages ?? [];
  const count = pages.length;
  const width = design.width || 1200;
  const height = design.height || 800;

  // index === count is the closing "End of presentation" screen.
  // `from` is the page being dissolved away (kept under the new one until its fade ends).
  const [nav, setNav] = useState(() => ({
    index: clamp(startIndex, 0, Math.max(0, count - 1)),
    from: null as number | null,
  }));
  // Pages can be deleted live by collaborators: never point past the end
  const shown = Math.min(nav.index, count);
  const atEnd = shown >= count;

  const [panel, setPanel] = useState<null | "grid" | "help">(null);
  const [blurred, setBlurred] = useState(false);
  const [jump, setJump] = useState("");
  const [idle, setIdle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen] = useState(() => Boolean(window.document.fullscreenEnabled));

  const rootRef = useRef<HTMLDivElement>(null);
  const exitingRef = useRef(false);
  const leavingFullscreenOnPurpose = useRef(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const overControls = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const go = useCallback(
    (to: number) => {
      setJump("");
      setNav((prev) => {
        const cur = Math.min(prev.index, count);
        const next = clamp(to, 0, count);
        return next === cur ? prev : { index: next, from: cur < count ? cur : null };
      });
    },
    [count]
  );

  const exit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (window.document.fullscreenElement) window.document.exitFullscreen().catch(() => {});
    onExit(clamp(shown, 0, Math.max(0, count - 1)));
  }, [onExit, shown, count]);

  const next = useCallback(() => (atEnd ? exit() : go(shown + 1)), [atEnd, exit, go, shown]);
  const prev = useCallback(() => go(shown - 1), [go, shown]);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.document.fullscreenElement) {
      leavingFullscreenOnPurpose.current = true;
      window.document.exitFullscreen().catch(() => {
        leavingFullscreenOnPurpose.current = false;
      });
    } else {
      root.requestFullscreen?.()?.catch(() => {});
    }
  }, []);

  /** Shows the controls; they hide again after a pause (not while the mouse is over them) */
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    if (!overControls.current) idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  const onSlideShown = useCallback(() => setNav((n) => (n.from === null ? n : { ...n, from: null })), []);

  // Latest values for the window listeners registered once
  const latest = useRef({ next, prev, go, exit, toggleFullscreen, panel, blurred, jump, count });
  useLayoutEffect(() => {
    latest.current = { next, prev, go, exit, toggleFullscreen, panel, blurred, jump, count };
  });

  // Take focus, go full screen (the "Present" click allows it), restore focus afterwards
  useEffect(() => {
    const root = rootRef.current;
    const previous = window.document.activeElement as HTMLElement | null;
    root?.focus();
    if (root && !window.document.fullscreenElement) {
      // Unsupported (e.g. iPhone Safari) or refused: stays a full-window overlay
      root.requestFullscreen?.()?.catch(() => {});
    }
    let wasFullscreen = false;
    const onChange = () => {
      const fs = window.document.fullscreenElement === root;
      setIsFullscreen(fs);
      if (fs) {
        wasFullscreen = true;
      } else if (wasFullscreen && !leavingFullscreenOnPurpose.current) {
        // Esc in full screen is taken by the browser; it ends the presentation, as on Canva
        latest.current.exit();
      }
      leavingFullscreenOnPurpose.current = false;
    };
    window.document.addEventListener("fullscreenchange", onChange);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    return () => {
      window.document.removeEventListener("fullscreenchange", onChange);
      window.clearTimeout(idleTimer.current);
      if (window.document.fullscreenElement === root) window.document.exitFullscreen().catch(() => {});
      previous?.focus?.();
    };
  }, []);

  // Keys: capture phase on window, so the editor's own handlers never see them
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.metaKey || e.ctrlKey || e.altKey) return; // browser shortcuts keep working
      const target = e.target as HTMLElement | null;
      // Enter / Space press the focused button inside the overview or help
      if ((e.key === "Enter" || e.key === " ") && target?.closest?.(".pm-panel button")) return;

      const l = latest.current;
      const key = e.key;
      let handled = true;
      if (/^[0-9]$/.test(key)) {
        setJump((j) => (j + key).replace(/^0+/, "").slice(0, 4));
      } else if (key === "Enter" && l.jump) {
        l.go(clamp(Number(l.jump) - 1, 0, l.count - 1));
      } else if (key === "Backspace" && l.jump) {
        setJump((j) => j.slice(0, -1));
      } else if (key === "Escape") {
        if (l.jump) setJump("");
        else if (l.panel) setPanel(null);
        else if (l.blurred) setBlurred(false);
        else l.exit();
      } else if (NEXT_KEYS.includes(key)) {
        setPanel(null);
        l.next();
      } else if (PREV_KEYS.includes(key)) {
        setPanel(null);
        l.prev();
      } else if (key === "Home") {
        l.go(0);
      } else if (key === "End") {
        l.go(l.count - 1);
      } else if (key === "b" || key === "B") {
        setBlurred((b) => !b);
      } else if (key === "g" || key === "G") {
        setPanel((p) => (p === "grid" ? null : "grid"));
      } else if (key === "?") {
        setPanel((p) => (p === "help" ? null : "help"));
      } else if (key === "f" || key === "F") {
        l.toggleFullscreen();
      } else {
        handled = false;
      }
      if (handled) e.preventDefault(); // no page scroll on Space, no history back on Backspace
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // A typed page number is forgotten after a pause
  useEffect(() => {
    if (!jump) return;
    const t = window.setTimeout(() => setJump(""), 3000);
    return () => window.clearTimeout(t);
  }, [jump]);

  // Current page on top, its neighbours preloaded underneath, the previous one dissolving away
  const slideIndexes = new Set<number>();
  for (const i of [nav.from, shown - 1, shown, shown + 1]) {
    if (i !== null && i >= 0 && i < count) slideIndexes.add(i);
  }

  const controlsHidden = idle && !panel;

  return createPortal(
    <div
      ref={rootRef}
      className="pm-root"
      data-idle={controlsHidden}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting ${design.name || "design"}`}
      tabIndex={-1}
      onMouseMove={wake}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
        wake();
      }}
      onTouchEnd={(e) => {
        const s = touchStart.current;
        const t = e.changedTouches[0];
        touchStart.current = null;
        if (!s || !t) return;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
          swiped.current = true;
          if (dx < 0) next();
          else prev();
        }
      }}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        next();
      }}
    >
      <style>{PRESENTATION_CSS}</style>

      <div className="pm-stage" data-blurred={blurred}>
        {[...slideIndexes].map((i) => {
          const page = pages[i]!;
          return (
            <Slide
              key={page.id}
              page={page}
              width={width}
              height={height}
              background={getPageBackground(design, i)}
              state={i === shown ? "current" : i === nav.from ? "behind" : "preload"}
              onShown={onSlideShown}
            />
          );
        })}
      </div>

      {atEnd && (
        <div className="pm-end">
          <strong>End of presentation</strong>
          <span>Click or press Esc to exit · ← to go back</span>
        </div>
      )}

      {jump && (
        <div className="pm-jump" aria-hidden="true">
          Go to page <b>{jump}</b>
          <kbd>{formatKeys("enter")[0]}</kbd>
        </div>
      )}

      {count > 0 && (
        <div className="pm-progress" style={{ width: `${(Math.min(shown + 1, count) / count) * 100}%` }} />
      )}

      <div
        className="pm-controls"
        onClick={stop}
        onTouchEnd={stop}
        onMouseEnter={() => {
          overControls.current = true;
          wake();
        }}
        onMouseLeave={() => {
          overControls.current = false;
          wake();
        }}
      >
        <button type="button" className="pm-btn" onClick={prev} disabled={shown === 0} aria-label="Previous page" title="Previous page (←)">
          <ChevronLeft size={20} />
        </button>
        <span className="pm-count">{atEnd ? "End" : `${shown + 1} / ${count}`}</span>
        <button
          type="button"
          className="pm-btn"
          onClick={next}
          aria-label={atEnd ? "Stop presenting" : "Next page"}
          title={atEnd ? "Stop presenting" : "Next page (→)"}
        >
          <ChevronRight size={20} />
        </button>
        <span className="pm-sep pm-hide-sm" />
        <ElapsedTime />
        <span className="pm-sep" />
        <button
          type="button"
          className="pm-btn"
          onClick={() => setPanel((p) => (p === "grid" ? null : "grid"))}
          aria-pressed={panel === "grid"}
          aria-label="All pages"
          title="All pages (G)"
        >
          <LayoutGrid size={17} />
        </button>
        <button
          type="button"
          className="pm-btn pm-hide-sm"
          onClick={() => setPanel((p) => (p === "help" ? null : "help"))}
          aria-pressed={panel === "help"}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={17} />
        </button>
        {canFullscreen && (
          <button
            type="button"
            className="pm-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            title={isFullscreen ? "Exit full screen (F)" : "Full screen (F)"}
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        )}
        <button type="button" className="pm-btn pm-exit" onClick={exit} title="Stop presenting (Esc)">
          <X size={16} />
          <span>Exit</span>
        </button>
      </div>

      {panel === "grid" && (
        <div
          className="pm-panel"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setPanel(null);
          }}
          onTouchEnd={stop}
        >
          <div className="pm-overview" role="dialog" aria-label="All pages">
            <div className="pm-panel-head">
              <h2>All pages</h2>
              <button type="button" className="pm-btn" onClick={() => setPanel(null)} aria-label="Close" title="Close (Esc)">
                <X size={18} />
              </button>
            </div>
            <div className="pm-grid">
              {pages.map((page, i) => (
                <button
                  key={page.id}
                  type="button"
                  className="pm-thumb"
                  data-current={i === shown}
                  aria-current={i === shown ? "page" : undefined}
                  aria-label={`Go to page ${i + 1}${page.name ? `: ${page.name}` : ""}`}
                  autoFocus={i === shown}
                  onClick={() => {
                    go(i);
                    setPanel(null);
                  }}
                >
                  <span className="pm-thumb-img" style={{ aspectRatio: `${width} / ${height}` }}>
                    <PageThumbnailPreview
                      page={page}
                      docWidth={width}
                      docHeight={height}
                      backgroundColor={getPageBackground(design, i)}
                      radius={0}
                    />
                  </span>
                  <span className="pm-thumb-label">
                    <b>{i + 1}</b>
                    {page.name || `Page ${i + 1}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {panel === "help" && (
        <div
          className="pm-panel"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setPanel(null);
          }}
          onTouchEnd={stop}
        >
          <div className="pm-help" role="dialog" aria-label="Presenting shortcuts">
            <div className="pm-panel-head">
              <h2>Presenting shortcuts</h2>
              <button type="button" className="pm-btn" onClick={() => setPanel(null)} aria-label="Close" title="Close (Esc)">
                <X size={18} />
              </button>
            </div>
            <ul>
              {PRESENT_SHORTCUTS.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <span className="pm-keys">
                    {row.gesture ? (
                      <em>{row.gesture}</em>
                    ) : (
                      row.keys.map((spec, i) => (
                        <React.Fragment key={spec}>
                          {i > 0 && <span className="pm-or">or</span>}
                          {formatKeys(spec).map((k, j) => (
                            <kbd key={j}>{k}</kbd>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p>Click anywhere, or swipe on a touch screen, to change pages.</p>
          </div>
        </div>
      )}

      <div className="pm-sr" aria-live="polite">
        {atEnd ? "End of presentation" : `Page ${shown + 1} of ${count}`}
      </div>
    </div>,
    window.document.body
  );
};

interface SlideProps {
  page: Page;
  width: number;
  height: number;
  background: string;
  state: "current" | "behind" | "preload";
  onShown: () => void;
}

/** One page, as large as the screen allows at the design's aspect ratio */
const Slide = React.memo(function Slide({ page, width, height, background, state, onShown }: SlideProps) {
  const ratio = width / height;
  return (
    <div
      className="pm-slide"
      data-state={state}
      aria-hidden={state !== "current"}
      onAnimationEnd={state === "current" ? onShown : undefined}
      style={{
        width: `min(100vw, calc(100dvh * ${ratio}))`,
        height: `min(100dvh, calc(100vw / ${ratio}))`,
      }}
    >
      <PageThumbnailPreview
        page={page}
        docWidth={width}
        docHeight={height}
        backgroundColor={background}
        preferVector
        radius={0}
      />
    </div>
  );
});

/** Time since presenting started; click to restart it (e.g. for a rehearsal) */
const ElapsedTime: React.FC = () => {
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const label = formatElapsed(now - start);
  return (
    <button
      type="button"
      className="pm-btn pm-time pm-hide-sm"
      onClick={() => {
        const t = Date.now();
        setStart(t);
        setNow(t);
      }}
      aria-label={`Time presenting ${label}. Restart timer`}
      title="Time presenting (click to restart)"
    >
      <Timer size={15} />
      <span>{label}</span>
    </button>
  );
};

// The presenter is always dark (a stage), whatever the app theme
const PRESENTATION_CSS = `
.pm-root {
  position: fixed; inset: 0; z-index: 1000;
  background: #000; color: #fafafa;
  overflow: hidden; outline: none;
  user-select: none; -webkit-user-select: none;
  touch-action: manipulation;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.pm-root[data-idle="true"] { cursor: none; }
.pm-stage { position: absolute; inset: 0; transition: filter 0.3s ease; }
.pm-stage[data-blurred="true"] { filter: blur(32px) brightness(0.85); }
.pm-slide { position: absolute; inset: 0; margin: auto; overflow: hidden; }
.pm-slide[data-state="current"] { z-index: 2; animation: pm-dissolve 0.35s ease-out both; }
.pm-slide[data-state="behind"] { z-index: 1; }
.pm-slide[data-state="preload"] { z-index: 0; visibility: hidden; }
@keyframes pm-dissolve { from { opacity: 0; } to { opacity: 1; } }

.pm-end {
  position: absolute; inset: 0; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: #000; color: #a1a1aa; font-size: 14px; text-align: center; padding: 16px;
  animation: pm-dissolve 0.35s ease-out both;
}
.pm-end strong { color: #fafafa; font-size: 20px; font-weight: 600; }

.pm-jump {
  position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 5;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px;
  background: rgba(24, 24, 27, 0.92); border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px; color: #d4d4d8;
}
.pm-jump b { color: #fafafa; font-variant-numeric: tabular-nums; }

.pm-progress {
  position: absolute; left: 0; bottom: 0; z-index: 5; height: 3px;
  background: #10b981; transition: width 0.3s ease, opacity 0.25s ease;
}
.pm-root[data-idle="true"] .pm-progress { opacity: 0; }

.pm-controls {
  position: absolute; left: 50%; bottom: max(20px, env(safe-area-inset-bottom)); z-index: 6;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px; padding: 5px;
  border-radius: 999px; white-space: nowrap;
  background: rgba(24, 24, 27, 0.86); border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.pm-root[data-idle="true"] .pm-controls { opacity: 0; transform: translate(-50%, 12px); pointer-events: none; }

.pm-btn {
  height: 36px; min-width: 36px; padding: 0; border: 0; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: inherit; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 600;
  transition: background-color 0.15s ease;
}
.pm-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.pm-btn:focus-visible { outline: 2px solid #10b981; outline-offset: 1px; }
.pm-btn:disabled { opacity: 0.35; cursor: default; }
.pm-btn[aria-pressed="true"] { background: rgba(16, 185, 129, 0.22); color: #6ee7b7; }
.pm-time { padding: 0 10px; color: #d4d4d8; font-variant-numeric: tabular-nums; }
.pm-exit { padding: 0 14px 0 10px; background: rgba(255, 255, 255, 0.08); margin-left: 2px; }
.pm-count { min-width: 64px; text-align: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pm-sep { width: 1px; height: 20px; margin: 0 4px; background: rgba(255, 255, 255, 0.14); }

.pm-panel {
  position: absolute; inset: 0; z-index: 7;
  display: flex; align-items: center; justify-content: center; padding: 24px 16px;
  background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  cursor: default; animation: pm-dissolve 0.2s ease-out both;
}
.pm-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.pm-panel-head h2 { margin: 0; font-size: 16px; font-weight: 600; }

.pm-overview { width: 100%; max-width: 1100px; max-height: 100%; display: flex; flex-direction: column; }
.pm-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px;
  overflow-y: auto; padding: 4px; min-height: 0;
}
.pm-thumb {
  display: flex; flex-direction: column; gap: 8px; padding: 0; border: 0;
  background: transparent; color: #d4d4d8; text-align: left; cursor: pointer; font: inherit;
}
.pm-thumb-img {
  display: block; width: 100%; overflow: hidden; border-radius: 8px;
  outline: 2px solid rgba(255, 255, 255, 0.12); outline-offset: 0;
  transition: outline-color 0.15s ease, transform 0.15s ease;
}
.pm-thumb:hover .pm-thumb-img { outline-color: rgba(255, 255, 255, 0.45); }
.pm-thumb[data-current="true"] .pm-thumb-img { outline: 3px solid #10b981; }
.pm-thumb:focus-visible { outline: none; }
.pm-thumb:focus-visible .pm-thumb-img { outline: 3px solid #6ee7b7; outline-offset: 2px; }
.pm-thumb-label { display: flex; gap: 8px; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-thumb-label b { color: #fafafa; }

.pm-help {
  width: min(440px, 100%); max-height: 100%; overflow-y: auto;
  padding: 18px 22px; border-radius: 14px;
  background: #18181b; border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.pm-help ul { list-style: none; margin: 0; padding: 0; }
.pm-help li {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 8px 0; font-size: 13px; color: #d4d4d8;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.pm-help li:first-child { border-top: 0; }
.pm-help p { margin: 12px 0 0; font-size: 12px; color: #a1a1aa; }
.pm-keys { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.pm-keys em { font-style: normal; color: #a1a1aa; }
.pm-or { font-size: 11px; color: #71717a; margin: 0 2px; }
.pm-root kbd {
  display: inline-block; min-width: 22px; padding: 2px 7px; border-radius: 5px; text-align: center;
  background: #27272a; border: 1px solid #3f3f46; border-bottom-width: 2px;
  font: 600 12px/1.4 system-ui, -apple-system, sans-serif; color: #fafafa;
}

.pm-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 520px) {
  .pm-hide-sm { display: none; }
  .pm-count { min-width: 52px; }
}
@media (prefers-reduced-motion: reduce) {
  .pm-slide, .pm-end, .pm-panel { animation: none !important; }
  .pm-controls, .pm-stage, .pm-progress { transition: none; }
}
`;
