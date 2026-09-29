import { Button } from "@design-platform/ui";

export default function AdminPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          padding: "2.5rem",
          borderRadius: "12px",
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border)",
        }}
      >
        <h1 style={{ fontSize: "1.875rem", marginBottom: "1rem", fontWeight: 700 }}>Admin Panel</h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Administrative interface placeholder. No functional modules loaded.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Button variant="secondary">Environment: Standalone Admin</Button>
        </div>
      </div>
    </main>
  );
}
