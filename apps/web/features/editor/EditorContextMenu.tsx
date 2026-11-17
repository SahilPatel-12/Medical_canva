"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import type { DesignElement } from "@design-platform/types";
import type { GroupEditSession } from "@design-platform/editor";
import {
  AlignIcon,
  ArrangeIcon,
  BringForwardIcon,
  BringToFrontIcon,
  ChevronRightIcon,
  CopyIcon,
  CutIcon,
  DeleteIcon,
  DuplicateIcon,
  EditPartsIcon,
  FitScreenIcon,
  FlipHorizontalIcon,
  FlipIcon,
  FlipVerticalIcon,
  GoInsideIcon,
  GroupIcon,
  LockIcon,
  AddPageIcon,
  PasteIcon,
  SelectAllIcon,
  SelectParentIcon,
  SendBackwardIcon,
  SendToBackIcon,
  TextIcon,
  UngroupIcon,
  UnlockIcon,
  type EditorIconProps,
} from "./icons/EditorIcons";

// ==========================================
// Right-click menu for the canvas.
// What it offers follows what was right-clicked: one element, several elements,
// a part inside an illustration, or the empty canvas.
// ==========================================

export interface MenuAction {
  kind: "action";
  id: string;
  label: string;
  icon?: React.FC<EditorIconProps>;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}
export interface MenuSubmenu {
  kind: "submenu";
  id: string;
  label: string;
  icon?: React.FC<EditorIconProps>;
  disabled?: boolean;
  items: MenuEntry[];
}
export type MenuEntry = MenuAction | MenuSubmenu | { kind: "separator" };

const SEP = { kind: "separator" } as const;

const isMac = () => typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** "⌘X" on Mac, "Ctrl+X" elsewhere; `mod` marks the Cmd/Ctrl key */
function keys(spec: string): string {
  const mac = isMac();
  return spec
    .split("+")
    .map((k) => {
      if (k === "mod") return mac ? "⌘" : "Ctrl+";
      if (k === "shift") return mac ? "⇧" : "Shift+";
      if (k === "alt") return mac ? "⌥" : "Alt+";
      if (k === "del") return mac ? "⌫" : "Del";
      if (k === "enter") return mac ? "↩" : "Enter";
      return k;
    })
    .join("");
}

// ------------------------------------------
// What to offer
// ------------------------------------------

export interface CanvasMenuContext {
  selected: DesignElement[];
  groupEditSession: GroupEditSession | null;
  hasClipboard: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFlip: (el: DesignElement, axis: "horizontal" | "vertical") => boolean;
  canEnterGroup: (id: string) => boolean;
  isTopmost: boolean;
  isBottommost: boolean;
  actions: {
    cut: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    remove: () => void;
    flip: (axis: "horizontal" | "vertical") => void;
    flipPart: (axis: "horizontal" | "vertical") => void;
    duplicatePart: () => void;
    removePart: () => void;
    bringToFront: () => void;
    bringForward: () => void;
    sendBackward: () => void;
    sendToBack: () => void;
    align: (edge: AlignEdge) => void;
    alignToPage: (edge: AlignEdge) => void;
    distribute: (axis: "horizontal" | "vertical") => void;
    group: () => void;
    ungroup: () => void;
    editParts: (id: string) => void;
    goInside: (id: string) => void;
    selectParent: () => void;
    doneEditingParts: () => void;
    ungroupPart: () => void;
    editText: (id: string) => void;
    selectAll: () => void;
    toggleLock: () => void;
    undo: () => void;
    redo: () => void;
    addPage: () => void;
    fitToScreen: () => void;
  };
}

type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

const ALIGN_ITEMS: Array<{ edge: AlignEdge; label: string }> = [
  { edge: "left", label: "Left" },
  { edge: "center", label: "Center" },
  { edge: "right", label: "Right" },
  { edge: "top", label: "Top" },
  { edge: "middle", label: "Middle" },
  { edge: "bottom", label: "Bottom" },
];

function flipMenu(onFlip: (axis: "horizontal" | "vertical") => void, canH: boolean, canV: boolean): MenuSubmenu {
  return {
    kind: "submenu",
    id: "flip",
    label: "Flip",
    icon: FlipIcon,
    disabled: !canH && !canV,
    items: [
      {
        kind: "action",
        id: "flip-h",
        label: "Flip horizontal",
        icon: FlipHorizontalIcon,
        shortcut: keys("shift+H"),
        disabled: !canH,
        onSelect: () => onFlip("horizontal"),
      },
      {
        kind: "action",
        id: "flip-v",
        label: "Flip vertical",
        icon: FlipVerticalIcon,
        shortcut: keys("shift+V"),
        disabled: !canV,
        onSelect: () => onFlip("vertical"),
      },
    ],
  };
}

/** Builds the menu for the current selection */
export function buildCanvasMenu(ctx: CanvasMenuContext): { title: string; entries: MenuEntry[] } {
  const { selected, actions: a, groupEditSession: session } = ctx;

  // A part inside an illustration
  if (session && session.selectedLayerPath) {
    const isGroup = session.selectedLayerIsGroup;
    return {
      title: session.selectedLayerName || "Part",
      entries: [
        { kind: "action", id: "dup-part", label: "Duplicate part", icon: DuplicateIcon, shortcut: keys("mod+D"), onSelect: a.duplicatePart },
        { kind: "action", id: "del-part", label: "Delete part", icon: DeleteIcon, shortcut: keys("del"), danger: true, onSelect: a.removePart },
        SEP,
        flipMenu(a.flipPart, true, true),
        SEP,
        ...(isGroup
          ? ([
              { kind: "action", id: "go-inside", label: "Go inside group", icon: GoInsideIcon, shortcut: keys("enter"), onSelect: () => a.goInside(session.elementId) },
              { kind: "action", id: "ungroup-part", label: "Ungroup part", icon: UngroupIcon, onSelect: a.ungroupPart },
            ] as MenuEntry[])
          : []),
        { kind: "action", id: "parent", label: "Select parent", icon: SelectParentIcon, shortcut: "Esc", onSelect: a.selectParent },
        { kind: "action", id: "done-parts", label: "Done editing parts", icon: EditPartsIcon, onSelect: a.doneEditingParts },
      ],
    };
  }

  // Empty canvas
  if (selected.length === 0) {
    return {
      title: "Page",
      entries: [
        { kind: "action", id: "paste", label: "Paste", icon: PasteIcon, shortcut: keys("mod+V"), disabled: !ctx.hasClipboard, onSelect: a.paste },
        { kind: "action", id: "select-all", label: "Select all", icon: SelectAllIcon, shortcut: keys("mod+A"), onSelect: a.selectAll },
        SEP,
        { kind: "action", id: "undo", label: "Undo", shortcut: keys("mod+Z"), disabled: !ctx.canUndo, onSelect: a.undo },
        { kind: "action", id: "redo", label: "Redo", shortcut: keys("mod+shift+Z"), disabled: !ctx.canRedo, onSelect: a.redo },
        SEP,
        { kind: "action", id: "add-page", label: "Add page", icon: AddPageIcon, onSelect: a.addPage },
        { kind: "action", id: "fit", label: "Fit to screen", icon: FitScreenIcon, shortcut: keys("shift+1"), onSelect: a.fitToScreen },
      ],
    };
  }

  // One or more elements
  const single = selected.length === 1 ? selected[0]! : null;
  const allLocked = selected.every((el) => el.locked);
  const editable = selected.filter((el) => !el.locked);
  const canH = editable.some((el) => ctx.canFlip(el, "horizontal"));
  const canV = editable.some((el) => ctx.canFlip(el, "vertical"));
  const title = single ? single.name || labelForType(single) : `${selected.length} elements`;

  const entries: MenuEntry[] = [
    { kind: "action", id: "cut", label: "Cut", icon: CutIcon, shortcut: keys("mod+X"), disabled: allLocked, onSelect: a.cut },
    { kind: "action", id: "copy", label: "Copy", icon: CopyIcon, shortcut: keys("mod+C"), onSelect: a.copy },
    { kind: "action", id: "paste", label: "Paste", icon: PasteIcon, shortcut: keys("mod+V"), disabled: !ctx.hasClipboard, onSelect: a.paste },
    { kind: "action", id: "duplicate", label: "Duplicate", icon: DuplicateIcon, shortcut: keys("mod+D"), onSelect: a.duplicate },
    { kind: "action", id: "delete", label: "Delete", icon: DeleteIcon, shortcut: keys("del"), danger: true, disabled: allLocked, onSelect: a.remove },
    SEP,
    flipMenu(a.flip, canH, canV),
  ];

  if (single) {
    entries.push({
      kind: "submenu",
      id: "arrange",
      label: "Arrange",
      icon: ArrangeIcon,
      items: [
        { kind: "action", id: "front", label: "Bring to front", icon: BringToFrontIcon, disabled: ctx.isTopmost, onSelect: a.bringToFront },
        { kind: "action", id: "forward", label: "Bring forward", icon: BringForwardIcon, disabled: ctx.isTopmost, onSelect: a.bringForward },
        { kind: "action", id: "backward", label: "Send backward", icon: SendBackwardIcon, disabled: ctx.isBottommost, onSelect: a.sendBackward },
        { kind: "action", id: "back", label: "Send to back", icon: SendToBackIcon, disabled: ctx.isBottommost, onSelect: a.sendToBack },
      ],
    });
  }

  entries.push({
    kind: "submenu",
    id: "align",
    label: single ? "Align to page" : "Align",
    icon: AlignIcon,
    disabled: allLocked,
    items: single
      ? ALIGN_ITEMS.map(({ edge, label }) => ({
          kind: "action" as const,
          id: `page-${edge}`,
          label,
          onSelect: () => a.alignToPage(edge),
        }))
      : [
          ...ALIGN_ITEMS.map(({ edge, label }) => ({
            kind: "action" as const,
            id: `align-${edge}`,
            label,
            onSelect: () => a.align(edge),
          })),
          SEP,
          { kind: "action", id: "dist-h", label: "Space evenly across", disabled: editable.length < 3, onSelect: () => a.distribute("horizontal") },
          { kind: "action", id: "dist-v", label: "Space evenly down", disabled: editable.length < 3, onSelect: () => a.distribute("vertical") },
          SEP,
          ...ALIGN_ITEMS.filter((x) => x.edge === "center" || x.edge === "middle").map(({ edge }) => ({
            kind: "action" as const,
            id: `page-${edge}`,
            label: edge === "center" ? "Center on page" : "Middle of page",
            onSelect: () => a.alignToPage(edge),
          })),
        ],
  });

  const structure: MenuEntry[] = [];
  if (single?.type === "svg" && !single.locked && ctx.canEnterGroup(single.id)) {
    structure.push({ kind: "action", id: "edit-parts", label: "Edit parts", icon: EditPartsIcon, shortcut: keys("enter"), onSelect: () => a.editParts(single.id) });
    structure.push({ kind: "action", id: "ungroup", label: "Split into elements", icon: UngroupIcon, shortcut: keys("mod+shift+G"), onSelect: a.ungroup });
  }
  if (single?.type === "text" && !single.locked) {
    structure.push({ kind: "action", id: "edit-text", label: "Edit text", icon: TextIcon, shortcut: keys("enter"), onSelect: () => a.editText(single.id) });
  }
  if (selected.length > 1 && selected.every((el) => el.type === "svg")) {
    structure.push({ kind: "action", id: "group", label: "Group", icon: GroupIcon, shortcut: keys("mod+G"), onSelect: a.group });
  }
  if (structure.length) entries.push(SEP, ...structure);

  entries.push(
    SEP,
    { kind: "action", id: "select-all", label: "Select all", icon: SelectAllIcon, shortcut: keys("mod+A"), onSelect: a.selectAll },
    {
      kind: "action",
      id: "lock",
      label: allLocked ? "Unlock" : "Lock",
      icon: allLocked ? UnlockIcon : LockIcon,
      shortcut: keys("mod+L"),
      onSelect: a.toggleLock,
    }
  );
  return { title, entries };
}

function labelForType(el: DesignElement): string {
  if (el.type === "svg") return "Illustration";
  if (el.type === "image") return "Image";
  if (el.type === "text") return "Text";
  return "Shape";
}

// ------------------------------------------
// Menu UI
// ------------------------------------------

const MENU_WIDTH = 236;
const EDGE = 8;

/** Index of the next enabled, selectable entry in `dir` (wraps around) */
function nextIndex(entries: MenuEntry[], from: number, dir: 1 | -1): number {
  const n = entries.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    const e = entries[i]!;
    if (e.kind !== "separator" && !e.disabled) return i;
  }
  return from;
}

interface MenuListProps {
  entries: MenuEntry[];
  title?: string;
  /** Anchor in viewport pixels */
  x: number;
  y: number;
  /** For submenus: the parent row, so the list can flip to the left side */
  parentRect?: DOMRect;
  autoFocus: boolean;
  onClose: () => void;
  onBack?: () => void;
  depth: number;
}

const MenuList: React.FC<MenuListProps> = ({ entries, title, x, y, parentRect, autoFocus, onClose, onBack, depth }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(-1);
  const [openSub, setOpenSub] = useState<{ index: number; rect: DOMRect; focus: boolean } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the menu inside the window (measured after layout, positioned imperatively)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout size (the open animation scales the box, which would skew a measured rect)
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (parentRect) {
      left = parentRect.right - 4;
      if (left + width > vw - EDGE) left = parentRect.left - width + 4;
      top = parentRect.top - 6;
    } else if (left + width > vw - EDGE) {
      left = Math.max(EDGE, x - width);
    }
    if (top + height > vh - EDGE) top = Math.max(EDGE, vh - EDGE - height);
    el.style.left = `${Math.max(EDGE, left)}px`;
    el.style.top = `${Math.max(EDGE, top)}px`;
    el.style.visibility = "visible";
    if (autoFocus) {
      const first = rowRefs.current.find((row) => row && row.getAttribute("aria-disabled") !== "true");
      first?.focus();
    } else if (depth === 0) {
      el.focus();
    }
  }, [x, y, parentRect, autoFocus, depth]);

  const openSubmenu = (index: number, focus: boolean) => {
    const row = rowRefs.current[index];
    const entry = entries[index];
    if (!row || !entry || entry.kind !== "submenu" || entry.disabled) return;
    setOpenSub({ index, rect: row.getBoundingClientRect(), focus });
  };

  const activate = (index: number) => {
    const entry = entries[index];
    if (!entry || entry.kind === "separator" || entry.disabled) return;
    if (entry.kind === "submenu") {
      openSubmenu(index, true);
      return;
    }
    onClose();
    entry.onSelect();
  };

  const focusRow = (index: number) => {
    setActive(index);
    rowRefs.current[index]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys pressed in a submenu are handled there
    if (e.target instanceof Node && !ref.current?.contains(e.target)) return;
    // The focused row is the current one (focus may come from hover or from opening the submenu)
    const focused = rowRefs.current.findIndex((row) => row && row === document.activeElement);
    const current = focused >= 0 ? focused : active;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusRow(nextIndex(entries, current, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        focusRow(nextIndex(entries, current < 0 ? 0 : current, -1));
        break;
      case "ArrowRight":
        if (current >= 0 && entries[current]?.kind === "submenu") {
          e.preventDefault();
          openSubmenu(current, true);
        }
        break;
      case "ArrowLeft":
        if (onBack) {
          e.preventDefault();
          onBack();
        }
        break;
      case "Enter":
      case " ":
        if (current >= 0) {
          e.preventDefault();
          activate(current);
        }
        break;
      case "Home":
        e.preventDefault();
        focusRow(nextIndex(entries, -1, 1));
        break;
      case "End":
        e.preventDefault();
        focusRow(nextIndex(entries, 0, -1));
        break;
      default:
        return;
    }
    e.stopPropagation();
  };

  const sub = openSub ? entries[openSub.index] : null;

  return (
    <>
      <div
        ref={ref}
        role="menu"
        aria-label={title || "Options"}
        tabIndex={-1}
        className={`cm${depth > 0 ? " cm-sub" : ""}`}
        style={{ left: x, top: y, width: depth > 0 ? 212 : MENU_WIDTH, visibility: "hidden" }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {title && <div className="cm-title">{title}</div>}
        {entries.map((entry, i) => {
          if (entry.kind === "separator") {
            // No separators at the edges or doubled up
            const prev = entries[i - 1];
            if (i === 0 || i === entries.length - 1 || !prev || prev.kind === "separator") return null;
            return <div key={`sep-${i}`} role="separator" className="cm-sep" />;
          }
          const Icon = entry.icon;
          const isSub = entry.kind === "submenu";
          const expanded = isSub && openSub?.index === i;
          return (
            <button
              key={entry.id}
              ref={(node) => {
                rowRefs.current[i] = node;
              }}
              type="button"
              role="menuitem"
              data-menu-id={entry.id}
              aria-disabled={entry.disabled || undefined}
              aria-haspopup={isSub ? "menu" : undefined}
              aria-expanded={isSub ? expanded : undefined}
              tabIndex={-1}
              className={`cm-item${entry.kind === "action" && entry.danger ? " is-danger" : ""}${
                expanded ? " is-open" : ""
              }${active === i ? " is-active" : ""}`}
              onMouseEnter={() => {
                setActive(i);
                if (!entry.disabled) rowRefs.current[i]?.focus();
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                if (isSub) {
                  hoverTimer.current = setTimeout(() => openSubmenu(i, false), 90);
                } else if (openSub) {
                  hoverTimer.current = setTimeout(() => setOpenSub(null), 160);
                }
              }}
              onMouseLeave={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
              }}
              onClick={() => activate(i)}
            >
              <span className="cm-icon">{Icon ? <Icon size={17} /> : null}</span>
              <span className="cm-label">{entry.label}</span>
              {entry.kind === "action" && entry.shortcut && <kbd className="cm-kbd">{entry.shortcut}</kbd>}
              {isSub && <ChevronRightIcon size={14} className="cm-chevron" />}
            </button>
          );
        })}
      </div>
      {sub && sub.kind === "submenu" && openSub && (
        <MenuList
          key={sub.id}
          entries={sub.items}
          x={openSub.rect.right}
          y={openSub.rect.top}
          parentRect={openSub.rect}
          autoFocus={openSub.focus}
          depth={depth + 1}
          onClose={onClose}
          onBack={() => {
            const idx = openSub.index;
            setOpenSub(null);
            focusRow(idx);
          }}
        />
      )}
    </>
  );
};

export interface EditorContextMenuProps {
  x: number;
  y: number;
  title: string;
  entries: MenuEntry[];
  onClose: () => void;
}

const MENU_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Home", "End", "Tab", "Shift"]);

/** Floating menu at the pointer; closes on Esc, outside click, scroll, zoom or resize */
export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({ x, y, title, entries, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    const close = () => closeRef.current();
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The menu takes Esc: the selection stays as it is
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      // Any other shortcut (Delete, ⌘D…) closes the menu and still runs
      if (!MENU_KEYS.has(e.key)) close();
    };
    const onScroll = (e: Event) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      close();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", close, { passive: true, capture: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", close, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, []);

  return (
    <div ref={rootRef} className="cm-root">
      <MenuList entries={entries} title={title} x={x} y={y} autoFocus={false} depth={0} onClose={onClose} />
    </div>
  );
};
