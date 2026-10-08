"use client";

import React, { useSyncExternalStore } from "react";
import { EditorView } from "../../../features/editor";

const emptySubscribe = () => () => {};

export function EditorClient({ designId }: { designId: string }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#09090b",
          color: "#a1a1aa",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #27272a",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.875rem" }}>Initializing Design Studio...</span>
      </div>
    );
  }

  return <EditorView designId={designId} />;
}
