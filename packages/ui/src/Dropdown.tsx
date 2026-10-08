"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = "right" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{ cursor: "pointer", display: "inline-flex" }}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [align]: 0,
            zIndex: 1000,
            minWidth: "160px",
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "8px",
            padding: "4px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            animation: "dropdownFadeIn 0.15s ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "6px 10px",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: item.danger ? "#f87171" : "#e4e4e7",
                cursor: item.disabled ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                opacity: item.disabled ? 0.4 : 1,
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = item.danger
                    ? "rgba(239, 68, 68, 0.15)"
                    : "#27272a";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {item.icon && (
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: "14px" }}>
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
