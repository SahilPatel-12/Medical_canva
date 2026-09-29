import { Button } from "@design-platform/ui";
import { isDefined } from "@design-platform/utils";

export default function HomePage() {
  const isReady = isDefined("Design Platform Web App");

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
        <h1 style={{ fontSize: "1.875rem", marginBottom: "1rem", fontWeight: 700 }}>
          Design Platform
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Customer Web Application bootstrap running on Next.js App Router.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Button variant="primary">Status: {isReady ? "Operational" : "Initializing"}</Button>
        </div>
      </div>
    </main>
  );
}
