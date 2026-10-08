"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useAuth, type User } from "../providers";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Those passwords don’t match.");
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refreshUser();
      router.replace("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't create your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">Thread<span>.</span></Link>
        <p className="auth-eyebrow">A LITTLE MORE LOVELY</p>
        <h1>Make room for you.</h1>
        <p className="auth-description">Create an account to start building a wardrobe that feels like yours.</p>
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
              name="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
          />
          </label>
          <label className="auth-field">
            Confirm password
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <p className="auth-hint">Use at least 8 characters. Passwords are case-sensitive.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">Already part of Thread? <Link href="/login">Sign in</Link></p>
        <Link className="auth-back" href="/">Back to the wardrobe</Link>
      </section>
    </main>
  );
}
