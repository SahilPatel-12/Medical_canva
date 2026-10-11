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
    borderRadius: "6px",
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
    xs: { padding: variant === "icon" ? "4px" : "3px 8px", fontSize: "12px", height: "26px" },
    sm: { padding: variant === "icon" ? "6px" : "5px 12px", fontSize: "13px", height: "32px" },
    md: { padding: variant === "icon" ? "8px" : "7px 16px", fontSize: "14px", height: "38px" },
    lg: { padding: variant === "icon" ? "12px" : "10px 20px", fontSize: "15px", height: "44px" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      borderColor: "#1d4ed8",
      boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
    },
    secondary: {
      backgroundColor: "#f1f5f9",
      color: "#0f172a",
      borderColor: "#e2e8f0",
    },
    outline: {
      backgroundColor: "#ffffff",
      color: "#334155",
      borderColor: "#cbd5e1",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#475569",
      borderColor: "transparent",
    },
    danger: {
      backgroundColor: "#ef4444",
      color: "#ffffff",
      borderColor: "#dc2626",
    },
    icon: {
      backgroundColor: "transparent",
      color: "#475569",
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
