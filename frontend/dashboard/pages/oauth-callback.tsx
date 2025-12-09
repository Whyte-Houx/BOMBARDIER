import { useEffect, useState } from "react";

export default function OAuthCallback() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = new URL(window.location.href);
    const code = u.searchParams.get("code") || "";
    const state = u.searchParams.get("state") || "";
    if (!code || !state) {
      setError("Missing code/state");
      return;
    }
    const provider =
      window.localStorage.getItem(`oauth:provider:${state}`) || "github";
    async function finish() {
      try {
        const url = new URL(`${API}/oauth/${provider}/callback`);
        url.searchParams.set("code", code);
        url.searchParams.set("state", state);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (data?.token) {
          window.localStorage.setItem("auth_token", data.token);
          window.localStorage.setItem("auth_role", data.user?.role || "viewer");
          window.localStorage.setItem("auth_user_id", data.user?.id || "");
          window.location.href = "/";
        } else {
          window.location.href = "/";
        }
      } catch (e: any) {
        setError(e.message || "OAuth failed");
      }
    }
    finish();
  }, []);

  return (
    <div className="oauth-callback-container">
      <h3>Completing OAuth…</h3>
      {error && <p className="oauth-error">{error}</p>}
    </div>
  );
}
