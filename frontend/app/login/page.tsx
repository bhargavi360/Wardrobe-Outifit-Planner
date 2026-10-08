"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useAuth, type User } from "../providers";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const visualSectionRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refreshUser();
      router.replace("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't sign you in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="Thread">
        <Link className="auth-intro-wordmark" href="/" aria-label="Thread">
          <span aria-hidden="true">T</span>
          <span aria-hidden="true">h</span>
          <span aria-hidden="true">r</span>
          <span aria-hidden="true">e</span>
          <span aria-hidden="true">a</span>
          <span aria-hidden="true">d</span>
          <span
            className="auth-intro-period"
            aria-hidden="true"
            onAnimationEnd={() => {
              const visualSection = visualSectionRef.current;
              if (visualSection) {
                window.scrollTo({
                  top: visualSection.offsetTop,
                  behavior: "smooth",
                });
              }
            }}
          >
            .
          </span>
        </Link>
      </section>
      <section ref={visualSectionRef} className="auth-login-layout" aria-label="Sign in to Thread">
        <div className="auth-visual" aria-hidden="true">
          <Image
            src="/images/thread-login-fashion.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
            className="auth-background-image"
          />
        </div>
        <div className="auth-login-section">
          <div className="auth-card">
            <p className="auth-eyebrow">YOUR CLOSET, ALL TOGETHER</p>
            <h1 id="login-heading">Welcome back.</h1>
            <p className="auth-description">Sign in to find your next favorite outfit.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="auth-field">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="auth-switch">New to Thread? <Link href="/register">Create an account</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
