"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  orientation?: "horizontal" | "vertical";
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  orientation = "horizontal",
}) => {
  const isVertical = orientation === "vertical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        gap: "4px",
        backgroundColor: "#18181b",
        padding: "4px",
        borderRadius: "8px",
        border: "1px solid #27272a",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: isVertical ? "flex-start" : "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "#ffffff" : "#a1a1aa",
              backgroundColor: isActive ? "#27272a" : "transparent",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              outline: "none",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {tab.icon && (
              <span style={{ display: "inline-flex", alignItems: "center" }}>{tab.icon}</span>
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
