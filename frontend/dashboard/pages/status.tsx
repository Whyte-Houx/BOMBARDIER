import { useEffect, useRef, useState } from "react";
import styles from "../styles/status.module.css";

// removed unused Msg type

export default function Status() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const [campaignId, setCampaignId] = useState<string>("");
  const [counts, setCounts] = useState<{
    pending: number;
    approved: number;
    rejected: number;
  }>({ pending: 0, approved: 0, rejected: 0 });
  const [messageCounts, setMessageCounts] = useState<{
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  }>({ pending: 0, sent: 0, delivered: 0, failed: 0 });
  const [history, setHistory] = useState<
    {
      t: number;
      p: number;
      a: number;
      r: number;
      mp: number;
      ms: number;
      md: number;
      mf: number;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("auth_token") || ""
      : "";

  async function load() {
    if (!campaignId) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(
        `${API}/campaigns/${encodeURIComponent(campaignId)}/status`,
        { headers }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setCounts(data.profiles);
      setMessageCounts(data.messages);
      setHistory((h) => {
        const sample = {
          t: Date.now(),
          p: data.profiles.pending,
          a: data.profiles.approved,
          r: data.profiles.rejected,
          mp: data.messages.pending,
          ms: data.messages.sent,
          md: data.messages.delivered,
          mf: data.messages.failed,
        };
        const next = [...h, sample];
        return next.slice(Math.max(0, next.length - 50));
      });
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load status");
    }
  }

  useEffect(() => {
    setHistory([]);
    load();
    if (!campaignId) return;
    try {
      const wsUrl = (() => {
        const u = new URL(API);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = "/tracking/ws";
        if (token) u.searchParams.set("access_token", token);
        return u.toString();
      })();
      const ws = new WebSocket(wsUrl);
      let sse: EventSource | null = null;
      ws.onmessage = (ev) => {
        try {
          const evt = JSON.parse(ev.data as string);
          if (!evt || evt.campaignId !== campaignId) return;
          setError(null);
          if (evt.type === "profile.status") {
            setCounts((c) => ({
              pending: Math.max(0, c.pending - (evt.status === "approved" || evt.status === "rejected" ? 1 : 0)),
              approved: c.approved + (evt.status === "approved" ? 1 : 0),
              rejected: c.rejected + (evt.status === "rejected" ? 1 : 0),
            }));
          }
          if (evt.type === "message.status") {
            setMessageCounts((m) => ({
              pending: Math.max(0, m.pending - (evt.status === "sent" || evt.status === "delivered" || evt.status === "failed" ? 1 : 0)),
              sent: m.sent + (evt.status === "sent" ? 1 : 0),
              delivered: m.delivered + (evt.status === "delivered" ? 1 : 0),
              failed: m.failed + (evt.status === "failed" ? 1 : 0),
            }));
          }
          if (evt.type === "message.create") {
            setMessageCounts((m) => ({ ...m, pending: m.pending + 1 }));
          }
        } catch {}
      };
      ws.onerror = () => {
        setError("WebSocket error, falling back to SSE…");
        try {
          const url = `${API}/tracking/stream${token ? `?access_token=${encodeURIComponent(token)}&intervalMs=1000` : `?intervalMs=1000`}`;
          sse = new EventSource(url);
          sse.addEventListener("update", (ev: MessageEvent) => {
            try {
              const evt = JSON.parse(ev.data);
              if (!evt || evt.campaignId !== campaignId) return;
              setError(null);
              if (evt.type === "profile.status") {
                setCounts((c) => ({
                  pending: Math.max(0, c.pending - (evt.status === "approved" || evt.status === "rejected" ? 1 : 0)),
                  approved: c.approved + (evt.status === "approved" ? 1 : 0),
                  rejected: c.rejected + (evt.status === "rejected" ? 1 : 0),
                }));
              }
              if (evt.type === "message.status") {
                setMessageCounts((m) => ({
                  pending: Math.max(0, m.pending - (evt.status === "sent" || evt.status === "delivered" || evt.status === "failed" ? 1 : 0)),
                  sent: m.sent + (evt.status === "sent" ? 1 : 0),
                  delivered: m.delivered + (evt.status === "delivered" ? 1 : 0),
                  failed: m.failed + (evt.status === "failed" ? 1 : 0),
                }));
              }
              if (evt.type === "message.create") {
                setMessageCounts((m) => ({ ...m, pending: m.pending + 1 }));
              }
            } catch {}
          });
          sse.onerror = () => { setError("Stream disconnected, attempting reconnect…"); };
        } catch {}
      };
      return () => { try { ws.close(); } catch {}; if (sse) sse.close(); };
    } catch {}
  }, [campaignId]);

  const countsRef = useRef(counts);
  const messageCountsRef = useRef(messageCounts);
  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);
  useEffect(() => {
    messageCountsRef.current = messageCounts;
  }, [messageCounts]);
  useEffect(() => {
    const id = setInterval(() => {
      const c = countsRef.current;
      const m = messageCountsRef.current;
      setHistory((h) => {
        const sample = {
          t: Date.now(),
          p: c.pending,
          a: c.approved,
          r: c.rejected,
          mp: m.pending,
          ms: m.sent,
          md: m.delivered,
          mf: m.failed,
        };
        const next = [...h, sample];
        return next.slice(Math.max(0, next.length - 50));
      });
    }, 5000);
    return () => clearInterval(id);
  }, [campaignId]);

  return (
    <div className={styles.container}>
      <h2>Campaign Status</h2>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.controls}>
        <input
          placeholder="Campaign ID"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        />
        <button onClick={load}>Refresh</button>
      </div>
      <section className={styles.section}>
        <h3>Profiles</h3>
        <div className={styles.row}>
          <div>
            <strong>Pending:</strong> {counts.pending}
          </div>
          <div>
            <strong>Approved:</strong> {counts.approved}
          </div>
          <div>
            <strong>Rejected:</strong> {counts.rejected}
          </div>
        </div>
        <div className={styles.chart}>
          <svg
            className={styles.spark}
            width={220}
            height={50}
            viewBox="0 0 220 50">
            {renderSpark(
              history.map((h) => h.p),
              "#ff9800"
            )}
            {renderSpark(
              history.map((h) => h.a),
              "#4caf50"
            )}
            {renderSpark(
              history.map((h) => h.r),
              "#f44336"
            )}
          </svg>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotOrange}`} />
            Pending
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotApproved} />
            Approved
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotRejected} />
            Rejected
          </span>
        </div>
      </section>
      <section className={styles.section}>
        <h3>Messages</h3>
        <div className={styles.row}>
          <div>
            <strong>Pending:</strong> {messageCounts.pending}
          </div>
          <div>
            <strong>Sent:</strong> {messageCounts.sent}
          </div>
          <div>
            <strong>Delivered:</strong> {messageCounts.delivered}
          </div>
          <div>
            <strong>Failed:</strong> {messageCounts.failed}
          </div>
        </div>
        <div className={styles.chart}>
          <svg
            className={styles.spark}
            width={220}
            height={50}
            viewBox="0 0 220 50">
            {renderSpark(
              history.map((h) => h.mp),
              "#9c27b0"
            )}
            {renderSpark(
              history.map((h) => h.ms),
              "#2196f3"
            )}
            {renderSpark(
              history.map((h) => h.md),
              "#00bcd4"
            )}
            {renderSpark(
              history.map((h) => h.mf),
              "#795548"
            )}
          </svg>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendItem}>
            <span className={styles.legendDotPending} />
            Pending
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotSent} />
            Sent
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotDelivered} />
            Delivered
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotFailed} />
            Failed
          </span>
        </div>
      </section>
    </div>
  );
}

function renderSpark(values: number[], color: string) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 220 / (values.length - 1) : 220;
  let d = "";
  values.forEach((v, i) => {
    const x = i * step;
    const y = 50 - (v / max) * 48;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  const last = values[values.length - 1] ?? 0;
  const lastX = (values.length - 1) * step;
  const lastY = 50 - (last / max) * 48;
  return (
    <g>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" />
      <circle cx={lastX} cy={lastY} r={2} fill={color}>
        <title>{String(last)}</title>
      </circle>
    </g>
  );
}
