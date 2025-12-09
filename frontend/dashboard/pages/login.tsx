import { useState } from "react";
import styles from "../styles/login.module.css";

export default function Login() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email || !password) { setError("Email and password are required"); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      window.localStorage.setItem("auth_token", data.token);
      window.localStorage.setItem("auth_role", data.user?.role || "viewer");
      window.localStorage.setItem("auth_user_id", data.user?.id || "");
      setError(null);
      const redirect = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("redirect") : null;
      window.location.href = redirect || "/";
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function oauthStart(provider: string) {
    try {
      setLoading(true);
      const res = await fetch(`${API}/oauth/${encodeURIComponent(provider)}/start?mode=login`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data?.state) {
        try { window.localStorage.setItem(`oauth:provider:${data.state}`, provider); } catch {}
      }
      window.location.href = data.authorizeUrl;
    } catch (e: any) {
      setError(e.message || "OAuth start failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2>Login</h2>
      {error && <p className={styles.error}>{error}</p>}
      <form className={styles.form} onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className={styles.passwordRow}>
          <input placeholder="Password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className={styles.toggle} onClick={() => setShow(s => !s)}>{show ? "Hide" : "Show"}</button>
        </div>
        <button type="submit" disabled={loading || !email || !password}>{loading ? "Signing in…" : "Login"}</button>
      </form>
      <div className={styles.oauthRow}>
        <button type="button" onClick={() => oauthStart("github")} disabled={loading}>Login with GitHub</button>
        <button type="button" onClick={() => oauthStart("google")} disabled={loading}>Login with Google</button>
      </div>
    </div>
  );
}