import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  style,
  className,
  ...props
}) => {
  return (
    <div
      style={{
        backgroundColor: "var(--card-bg, var(--surface, #ffffff))",
        border: "1px solid var(--border, #e2e8f0)",
        color: "var(--foreground, #0f172a)",
        borderRadius: "12px",
        overflow: "hidden",
        transition: interactive
          ? "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease"
          : undefined,
        cursor: interactive ? "pointer" : "default",
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};
