import { useEffect, useState } from "react";
import styles from "../styles/index.module.css";

export default function Home() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";

  if (!process.env.NEXT_PUBLIC_API_URL) {
    console.warn(
      "NEXT_PUBLIC_API_URL is not set. Falling back to http://localhost:4050. Please ensure this is correct for your environment."
    );
  }
  const [queues, setQueues] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState<Record<string, number>>({});
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("auth_token") || ""
      : "";

  async function load() {
    try {
      const res = await fetch(`${API}/metrics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      const qSizes: Record<string, number> = {};
      const processedTotals: Record<string, number> = {};
      text.split("\n").forEach((line) => {
        if (line.startsWith("queue_size{")) {
          const m = line.match(/queue=\"([^\"]+)\"\}\s+(\d+)/);
          if (m) qSizes[m[1]] = Number(m[2]);
        }
        if (line.startsWith("worker_processed_total{")) {
          const m = line.match(/queue=\"([^\"]+)\"\}\s+(\d+)/);
          if (m) processedTotals[m[1]] = Number(m[2]);
        }
      });
      setQueues(qSizes);
      setProcessed(processedTotals);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load metrics", err);
      setError(err.message || "Network error");
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.container}>
      <h1>Bombardier Dashboard</h1>
      <nav className={styles.nav}>
        <a href="/campaigns">Campaigns</a>
        <a href="/review">Review</a>
        <a href="/analytics">Analytics</a>
        <a href="/status">Status</a>
        <a href="/login" className={styles.pushRight}>
          Login
        </a>
      </nav>

      <section>
        <h2>Queue Health</h2>
        {error ? (
          <p className={styles.error}>Failed to load metrics: {error}</p>
        ) : Object.keys(queues).length === 0 ? (
          <p>Loading metrics…</p>
        ) : (
          <div>
            {Object.entries(queues).map(([q, v]) => (
              <div key={q} className={styles.queueItem}>
                <strong>{q}</strong>
                <span>size: {v}</span>
                <span>processed: {processed[q] ?? 0}</span>
                <div className={styles.progressBarBackground}>
                  <div
                    className={styles.progressBarForeground}
                    data-progress={Math.min(200, v * 20)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
