"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { apiRequest } from "../../lib/api";
import { useAuth, type User } from "../providers";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout mode="login">
      <p className="auth-eyebrow">YOUR CLOSET, ALL TOGETHER</p>
      <h1 id="login-heading">Welcome back.</h1>
      <p className="auth-description">Sign in to find your next favorite outfit.</p>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <label className="auth-field">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <span className="auth-password-wrap">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={72}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">New to Thread? <Link href="/register">Create an account</Link></p>
    </AuthLayout>
  );
}
