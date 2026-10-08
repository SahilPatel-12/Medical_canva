"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth,
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "14px",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #27272a",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f4f4f5", margin: 0 }}>
              {title}
            </h2>
            {description && (
              <p
                style={{ fontSize: "0.8125rem", color: "#a1a1aa", marginTop: "0.25rem", margin: 0 }}
              >
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: "4px", color: "#71717a" }}
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem", overflowY: "auto", maxHeight: "calc(80vh - 120px)" }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
              padding: "1rem 1.5rem",
              borderTop: "1px solid #27272a",
              backgroundColor: "#121214",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
