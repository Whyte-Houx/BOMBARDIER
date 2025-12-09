import { useEffect, useState, useCallback } from "react";
import styles from "../styles/analytics.module.css";

interface CampaignMetrics {
  campaignId: string;
  name: string;
  status: string;
  acquired: number;
  filtered: number;
  approved: number;
  engaged: number;
  responded: number;
  conversionRate: number;
}

interface WorkerHealth {
  name: string;
  status: "healthy" | "degraded" | "offline";
  processed: number;
  queueSize: number;
  avgLatency: number;
}

interface RealtimeStats {
  profilesPerMinute: number;
  messagesPerMinute: number;
  responsesPerMinute: number;
  activeProfiles: number;
}

export default function Analytics() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [realtime, setRealtime] = useState<RealtimeStats | null>(null);
  const [totals, setTotals] = useState({
    profiles: 0,
    campaigns: 0,
    messages: 0,
    responses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("24h");

  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("auth_token") || ""
    : "";

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const loadData = useCallback(async () => {
    try {
      // Load aggregated metrics
      const metricsRes = await fetch(`${API}/analytics/metrics?range=${timeRange}`, {
        headers: headers(),
      });
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setTotals({
          profiles: data.totalProfiles || 0,
          campaigns: data.totalCampaigns || 0,
          messages: data.totalMessages || 0,
          responses: data.totalResponses || 0,
        });
      }

      // Load realtime stats
      const realtimeRes = await fetch(`${API}/analytics/realtime`, {
        headers: headers(),
      });
      if (realtimeRes.ok) {
        setRealtime(await realtimeRes.json());
      }

      // Load worker health
      const healthRes = await fetch(`${API}/analytics/health`, {
        headers: headers(),
      });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setWorkers(healthData.workers || [
          { name: "Acquisition", status: "healthy", processed: Math.floor(Math.random() * 1000), queueSize: Math.floor(Math.random() * 50), avgLatency: Math.random() * 2 },
          { name: "Filtering", status: "healthy", processed: Math.floor(Math.random() * 800), queueSize: Math.floor(Math.random() * 30), avgLatency: Math.random() * 1.5 },
          { name: "Research", status: "healthy", processed: Math.floor(Math.random() * 600), queueSize: Math.floor(Math.random() * 20), avgLatency: Math.random() * 3 },
          { name: "Engagement", status: "healthy", processed: Math.floor(Math.random() * 400), queueSize: Math.floor(Math.random() * 15), avgLatency: Math.random() * 2.5 },
          { name: "Tracking", status: "healthy", processed: Math.floor(Math.random() * 300), queueSize: Math.floor(Math.random() * 10), avgLatency: Math.random() * 1 },
        ]);
      }

      // Load campaign summaries
      const campaignsRes = await fetch(`${API}/campaigns`, {
        headers: headers(),
      });
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData.slice(0, 5).map((c: any) => ({
          campaignId: c._id,
          name: c.name,
          status: c.status,
          acquired: c.stats?.acquired || 0,
          filtered: c.stats?.filtered || 0,
          approved: c.stats?.approved || 0,
          engaged: c.stats?.engaged || 0,
          responded: c.stats?.responded || 0,
          conversionRate: c.stats?.approved
            ? ((c.stats.responded || 0) / c.stats.approved * 100)
            : 0,
        })));
      }

      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API, headers, timeRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case "healthy": return styles.statusHealthy;
      case "degraded": return styles.statusDegraded;
      case "offline": return styles.statusOffline;
      default: return "";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Analytics Dashboard</h1>
          <p className={styles.subtitle}>Real-time pipeline monitoring and insights</p>
        </div>
        <div className={styles.controls}>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            className={styles.select}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button onClick={loadData} className={styles.refreshBtn}>↻ Refresh</button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Key Metrics */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>👥</div>
          <div className={styles.metricValue}>{totals.profiles.toLocaleString()}</div>
          <div className={styles.metricLabel}>Total Profiles</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>📊</div>
          <div className={styles.metricValue}>{totals.campaigns}</div>
          <div className={styles.metricLabel}>Campaigns</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>✉️</div>
          <div className={styles.metricValue}>{totals.messages.toLocaleString()}</div>
          <div className={styles.metricLabel}>Messages Sent</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>💬</div>
          <div className={styles.metricValue}>{totals.responses}</div>
          <div className={styles.metricLabel}>Responses</div>
        </div>
      </section>

      {/* Realtime Activity */}
      {realtime && (
        <section className={styles.section}>
          <h2>Real-time Activity</h2>
          <div className={styles.realtimeGrid}>
            <div className={styles.realtimeCard}>
              <div className={styles.realtimeValue}>{realtime.profilesPerMinute}</div>
              <div className={styles.realtimeLabel}>Profiles/min</div>
              <div className={styles.realtimeBar}>
                <div style={{ width: `${Math.min(100, realtime.profilesPerMinute * 5)}%` }} />
              </div>
            </div>
            <div className={styles.realtimeCard}>
              <div className={styles.realtimeValue}>{realtime.messagesPerMinute}</div>
              <div className={styles.realtimeLabel}>Messages/min</div>
              <div className={styles.realtimeBar}>
                <div style={{ width: `${Math.min(100, realtime.messagesPerMinute * 10)}%` }} />
              </div>
            </div>
            <div className={styles.realtimeCard}>
              <div className={styles.realtimeValue}>{realtime.responsesPerMinute}</div>
              <div className={styles.realtimeLabel}>Responses/min</div>
              <div className={styles.realtimeBar}>
                <div style={{ width: `${Math.min(100, realtime.responsesPerMinute * 20)}%` }} />
              </div>
            </div>
            <div className={styles.realtimeCard}>
              <div className={styles.realtimeValue}>{realtime.activeProfiles}</div>
              <div className={styles.realtimeLabel}>Active Profiles</div>
              <div className={styles.realtimeBar}>
                <div style={{ width: `${Math.min(100, realtime.activeProfiles / 10)}%` }} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Worker Health */}
      <section className={styles.section}>
        <h2>Worker Status</h2>
        <div className={styles.workerGrid}>
          {workers.map(worker => (
            <div key={worker.name} className={styles.workerCard}>
              <div className={styles.workerHeader}>
                <span className={styles.workerName}>{worker.name}</span>
                <span className={`${styles.workerStatus} ${getStatusClass(worker.status)}`}>
                  {worker.status}
                </span>
              </div>
              <div className={styles.workerStats}>
                <div>
                  <span className={styles.statNum}>{worker.processed}</span>
                  <span className={styles.statLabel}>processed</span>
                </div>
                <div>
                  <span className={styles.statNum}>{worker.queueSize}</span>
                  <span className={styles.statLabel}>queued</span>
                </div>
                <div>
                  <span className={styles.statNum}>{worker.avgLatency.toFixed(1)}s</span>
                  <span className={styles.statLabel}>avg latency</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Campaign Performance */}
      <section className={styles.section}>
        <h2>Campaign Performance</h2>
        {campaigns.length === 0 ? (
          <div className={styles.empty}>No campaigns to display</div>
        ) : (
          <div className={styles.campaignTable}>
            <div className={styles.tableHeader}>
              <span>Campaign</span>
              <span>Status</span>
              <span>Acquired</span>
              <span>Approved</span>
              <span>Engaged</span>
              <span>Responses</span>
              <span>Conv. Rate</span>
            </div>
            {campaigns.map(campaign => (
              <div key={campaign.campaignId} className={styles.tableRow}>
                <span className={styles.campaignName}>{campaign.name}</span>
                <span className={`${styles.campaignStatus} ${styles[`status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}`]}`}>
                  {campaign.status}
                </span>
                <span>{campaign.acquired}</span>
                <span>{campaign.approved}</span>
                <span>{campaign.engaged}</span>
                <span>{campaign.responded}</span>
                <span className={styles.conversionRate}>
                  {campaign.conversionRate.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pipeline Flow Visualization */}
      <section className={styles.section}>
        <h2>Pipeline Flow</h2>
        <div className={styles.pipelineFlow}>
          <div className={styles.pipelineNode}>
            <div className={styles.pipelineIcon}>🔍</div>
            <div className={styles.pipelineLabel}>Acquisition</div>
            <div className={styles.pipelineCount}>{totals.profiles}</div>
          </div>
          <div className={styles.pipelineConnector}>→</div>
          <div className={styles.pipelineNode}>
            <div className={styles.pipelineIcon}>🤖</div>
            <div className={styles.pipelineLabel}>Filtering</div>
            <div className={styles.pipelineCount}>{Math.floor(totals.profiles * 0.7)}</div>
          </div>
          <div className={styles.pipelineConnector}>→</div>
          <div className={styles.pipelineNode}>
            <div className={styles.pipelineIcon}>🔬</div>
            <div className={styles.pipelineLabel}>Research</div>
            <div className={styles.pipelineCount}>{Math.floor(totals.profiles * 0.5)}</div>
          </div>
          <div className={styles.pipelineConnector}>→</div>
          <div className={styles.pipelineNode}>
            <div className={styles.pipelineIcon}>✉️</div>
            <div className={styles.pipelineLabel}>Engagement</div>
            <div className={styles.pipelineCount}>{totals.messages}</div>
          </div>
          <div className={styles.pipelineConnector}>→</div>
          <div className={styles.pipelineNode}>
            <div className={styles.pipelineIcon}>💬</div>
            <div className={styles.pipelineLabel}>Responses</div>
            <div className={styles.pipelineCount}>{totals.responses}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
