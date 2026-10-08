import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f6f1eb", color: "#382f32" }}>
      <div style={{ textAlign: "center", maxWidth: "460px" }}>
        <p style={{ margin: 0, color: "#aa6f78", letterSpacing: "0.24em", textTransform: "uppercase", fontSize: "10px" }}>
          Thread
        </p>
        <h1 style={{ margin: "18px 0 12px", fontFamily: "Georgia, serif", fontSize: "clamp(2.5rem, 8vw, 4.5rem)", fontWeight: 300, letterSpacing: "-0.05em" }}>
          This page is not in the wardrobe.
        </h1>
        <p style={{ margin: "0 0 28px", color: "#766b6d", lineHeight: 1.7 }}>
          The link may be outdated or the page may have moved. Let&apos;s get you back to your outfit planner.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "42px",
            padding: "0 20px",
            borderRadius: "4px",
            background: "#a76570",
            color: "#fff",
            textDecoration: "none",
            fontSize: "12px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
