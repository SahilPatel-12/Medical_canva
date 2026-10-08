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
      backgroundColor: "#27272a",
      color: "#a1a1aa",
      border: "1px solid #3f3f46",
    },
    primary: {
      backgroundColor: "rgba(59, 130, 246, 0.15)",
      color: "#60a5fa",
      border: "1px solid rgba(59, 130, 246, 0.3)",
    },
    success: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      color: "#4ade80",
      border: "1px solid rgba(34, 197, 94, 0.3)",
    },
    warning: {
      backgroundColor: "rgba(234, 179, 8, 0.15)",
      color: "#facc15",
      border: "1px solid rgba(234, 179, 8, 0.3)",
    },
    outline: {
      backgroundColor: "transparent",
      color: "#d4d4d8",
      border: "1px solid #3f3f46",
    },
  };

  return (
    <span style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}>{children}</span>
  );
};
