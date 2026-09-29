import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
    fontFamily: "inherit",
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: "12px" },
    md: { padding: "8px 16px", fontSize: "14px" },
    lg: { padding: "12px 24px", fontSize: "16px" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      borderColor: "#2563eb",
    },
    secondary: {
      backgroundColor: "#475569",
      color: "#ffffff",
      borderColor: "#475569",
    },
    outline: {
      backgroundColor: "transparent",
      color: "#2563eb",
      borderColor: "#2563eb",
    },
  };

  return (
    <button
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      {...props}
    >
      {children}
    </button>
  );
};
