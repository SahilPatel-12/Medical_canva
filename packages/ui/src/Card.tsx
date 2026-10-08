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
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
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
