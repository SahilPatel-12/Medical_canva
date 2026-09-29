import { Button } from "@design-platform/ui";

export default function SuperAdminPage() {
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
        <h1
          style={{ fontSize: "1.875rem", marginBottom: "1rem", fontWeight: 700, color: "#f43f5e" }}
        >
          Super Admin Console
        </h1>
        <p style={{ color: "#a1a1aa", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Platform infrastructure & system management placeholder. No services attached.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Button variant="outline">Access Level: Super Admin</Button>
        </div>
      </div>
    </main>
  );
}
