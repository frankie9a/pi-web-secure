"use client";

import { FormEvent, useState } from "react";
import { safeLoginDestination } from "@/lib/login-destination";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/web-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Sign in failed");
      }
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.replace(safeLoginDestination(returnTo, window.location.origin));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-mark" aria-hidden="true">π</div>
        <div className="login-heading">
          <h1 id="login-title">Pi Agent Web</h1>
          <p>Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            disabled={submitting}
          />
          <div className="login-error" role="alert" aria-live="polite">
            {error}
          </div>
          <button type="submit" disabled={submitting || password.length === 0}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
