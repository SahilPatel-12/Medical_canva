import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "icon";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  children,
  style,
  disabled,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    fontWeight: 500,
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s ease",
    border: "1px solid transparent",
    fontFamily: "inherit",
    outline: "none",
    userSelect: "none",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: { padding: variant === "icon" ? "4px" : "4px 8px", fontSize: "12px", height: "26px" },
    sm: { padding: variant === "icon" ? "6px" : "6px 12px", fontSize: "13px", height: "32px" },
    md: { padding: variant === "icon" ? "8px" : "8px 16px", fontSize: "14px", height: "38px" },
    lg: { padding: variant === "icon" ? "12px" : "12px 20px", fontSize: "15px", height: "46px" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      borderColor: "#2563eb",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
    },
    secondary: {
      backgroundColor: "#27272a",
      color: "#f4f4f5",
      borderColor: "#3f3f46",
    },
    outline: {
      backgroundColor: "transparent",
      color: "#e4e4e7",
      borderColor: "#3f3f46",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#a1a1aa",
      borderColor: "transparent",
    },
    danger: {
      backgroundColor: "#ef4444",
      color: "#ffffff",
      borderColor: "#dc2626",
    },
    icon: {
      backgroundColor: "transparent",
      color: "#d4d4d8",
      borderColor: "transparent",
      borderRadius: "6px",
    },
  };

  return (
    <button
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      disabled={disabled}
      {...props}
    >
      {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
};
