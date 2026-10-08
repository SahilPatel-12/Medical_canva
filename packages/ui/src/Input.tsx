import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, rightElement, style, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#e4e4e7",
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
          {leftIcon && (
            <span
              style={{
                position: "absolute",
                left: "0.75rem",
                display: "flex",
                alignItems: "center",
                color: "#71717a",
                pointerEvents: "none",
              }}
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            style={{
              width: "100%",
              backgroundColor: "#18181b",
              color: "#f4f4f5",
              border: `1px solid ${error ? "#ef4444" : "#3f3f46"}`,
              borderRadius: "8px",
              padding: leftIcon ? "0.5rem 0.75rem 0.5rem 2.25rem" : "0.5rem 0.75rem",
              fontSize: "0.875rem",
              outline: "none",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              fontFamily: "inherit",
              ...style,
            }}
            {...props}
          />
          {rightElement && (
            <span
              style={{
                position: "absolute",
                right: "0.75rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              {rightElement}
            </span>
          )}
        </div>
        {error ? (
          <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</span>
        ) : helperText ? (
          <span style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
