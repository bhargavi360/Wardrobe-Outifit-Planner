import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({ children, mode }: { children: ReactNode; mode: "login" | "register" }) {
  return (
    <main className={`auth-page auth-editorial-page auth-mode-${mode}`}>
      <section className="auth-login-layout" aria-label={mode === "login" ? "Sign in to Thread" : "Join Thread"}>
        <div className="auth-visual">
          <Image
            src="/images/thread-luxury-editorial.png"
            alt="Ivory tailoring in a warm, thoughtfully curated dressing room."
            fill
            priority
            sizes="(max-width: 767px) 100vw, 54vw"
            className="auth-background-image"
          />
          <Link className="auth-photo-brand" href="/" aria-label="Thread home">Thread<span>.</span></Link>
          <div className="auth-photo-copy">
            <p>THE ART OF EVERYDAY DRESSING</p>
            <h2>A wardrobe.<br /><em>A world of possibility.</em></h2>
            <span>Your pieces. Your point of view.</span>
          </div>
          <span className="auth-photo-index" aria-hidden="true">THREAD / A CONSIDERED COLLECTION</span>
        </div>
        <div className="auth-login-section">
          <section className="auth-card">{children}</section>
          <p className="auth-bottomline">Considered style, every day. <span>© 2026 Thread</span></p>
        </div>
      </section>
    </main>
  );
}
