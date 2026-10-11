import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "outline";
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "sm",
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    fontWeight: 500,
    borderRadius: "9999px",
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: "3px 8px", fontSize: "11px" },
    md: { padding: "4px 10px", fontSize: "12px" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
    },
    primary: {
      backgroundColor: "#eff6ff",
      color: "#2563eb",
      border: "1px solid #bfdbfe",
    },
    success: {
      backgroundColor: "#f0fdf4",
      color: "#16a34a",
      border: "1px solid #bbf7d0",
    },
    warning: {
      backgroundColor: "#fffbeb",
      color: "#d97706",
      border: "1px solid #fde68a",
    },
    outline: {
      backgroundColor: "#ffffff",
      color: "#64748b",
      border: "1px solid #cbd5e1",
    },
  };

  return (
    <span style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}>{children}</span>
  );
};
