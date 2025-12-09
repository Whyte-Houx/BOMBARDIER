import { useState, useEffect, useCallback } from "react";
import styles from "../styles/campaigns.module.css";

interface Campaign {
  _id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  targetCriteria: {
    platforms?: string[];
    interests?: string[];
    keywords?: string[];
    locations?: string[];
  };
  stats?: {
    acquired: number;
    filtered: number;
    approved: number;
    engaged: number;
    responded: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export default function Campaigns() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    platforms: "twitter,reddit",
    interests: "",
    keywords: "",
    locations: "",
  });

  const role = typeof window !== "undefined"
    ? window.localStorage.getItem("auth_role") || "viewer"
    : "viewer";
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("auth_token") || ""
    : "";

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${API}/campaigns`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Failed to load campaigns: ${res.status}`);
      const data = await res.json();
      setCampaigns(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API, headers]);

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 30000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  // Create campaign
  const createCampaign = async () => {
    try {
      const res = await fetch(`${API}/campaigns`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: formData.name,
          targetCriteria: {
            platforms: formData.platforms.split(",").map(s => s.trim()).filter(Boolean),
            interests: formData.interests.split(",").map(s => s.trim()).filter(Boolean),
            keywords: formData.keywords.split(",").map(s => s.trim()).filter(Boolean),
            locations: formData.locations.split(",").map(s => s.trim()).filter(Boolean),
          },
        }),
      });
      if (!res.ok) throw new Error(`Failed to create campaign: ${res.status}`);
      setShowCreate(false);
      setFormData({ name: "", platforms: "twitter,reddit", interests: "", keywords: "", locations: "" });
      loadCampaigns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Control campaign
  const controlCampaign = async (id: string, action: "start" | "pause" | "complete" | "delete") => {
    try {
      if (action === "delete") {
        if (!confirm("Are you sure you want to delete this campaign?")) return;
        await fetch(`${API}/campaigns/${id}`, { method: "DELETE", headers: headers() });
      } else {
        await fetch(`${API}/campaigns/${id}/${action}`, { method: "POST", headers: headers() });
      }
      loadCampaigns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return styles.statusRunning;
      case "paused": return styles.statusPaused;
      case "completed": return styles.statusCompleted;
      case "failed": return styles.statusFailed;
      default: return styles.statusDraft;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  const canManage = role === "admin" || role === "operator";

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Campaigns</h1>
          <p className={styles.subtitle}>Manage your target acquisition campaigns</p>
        </div>
        {canManage && (
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            + New Campaign
          </button>
        )}
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Campaign List */}
      <div className={styles.campaignGrid}>
        {loading ? (
          <div className={styles.loading}>Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📊</div>
            <p>No campaigns yet</p>
            {canManage && <button onClick={() => setShowCreate(true)}>Create your first campaign</button>}
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign._id} className={styles.campaignCard} onClick={() => setSelectedCampaign(campaign)}>
              <div className={styles.cardHeader}>
                <h3>{campaign.name}</h3>
                <span className={`${styles.status} ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>

              <div className={styles.platforms}>
                {campaign.targetCriteria.platforms?.map(p => (
                  <span key={p} className={styles.platformBadge}>{p}</span>
                ))}
              </div>

              {campaign.stats && (
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{campaign.stats.acquired}</span>
                    <span className={styles.statLabel}>Acquired</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{campaign.stats.approved}</span>
                    <span className={styles.statLabel}>Approved</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{campaign.stats.engaged}</span>
                    <span className={styles.statLabel}>Engaged</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{campaign.stats.responded}</span>
                    <span className={styles.statLabel}>Responses</span>
                  </div>
                </div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.date}>Created {formatDate(campaign.createdAt)}</span>
                {canManage && (
                  <div className={styles.actions}>
                    {campaign.status === "draft" && (
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); controlCampaign(campaign._id, "start"); }}>
                        ▶ Start
                      </button>
                    )}
                    {campaign.status === "running" && (
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); controlCampaign(campaign._id, "pause"); }}>
                        ⏸ Pause
                      </button>
                    )}
                    {campaign.status === "paused" && (
                      <>
                        <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); controlCampaign(campaign._id, "start"); }}>
                          ▶ Resume
                        </button>
                        <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); controlCampaign(campaign._id, "complete"); }}>
                          ✓ Complete
                        </button>
                      </>
                    )}
                    <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={(e) => { e.stopPropagation(); controlCampaign(campaign._id, "delete"); }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>Create New Campaign</h2>

            <div className={styles.formGroup}>
              <label>Campaign Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g., Q1 Tech Outreach"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Platforms (comma-separated)</label>
              <input
                type="text"
                value={formData.platforms}
                onChange={e => setFormData(d => ({ ...d, platforms: e.target.value }))}
                placeholder="twitter, linkedin, reddit, instagram"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Interests (comma-separated)</label>
              <input
                type="text"
                value={formData.interests}
                onChange={e => setFormData(d => ({ ...d, interests: e.target.value }))}
                placeholder="technology, startups, AI"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Keywords (comma-separated)</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={e => setFormData(d => ({ ...d, keywords: e.target.value }))}
                placeholder="machine learning, blockchain"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Locations (comma-separated)</label>
              <input
                type="text"
                value={formData.locations}
                onChange={e => setFormData(d => ({ ...d, locations: e.target.value }))}
                placeholder="San Francisco, New York"
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.submitBtn} onClick={createCampaign} disabled={!formData.name}>
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCampaign(null)}>
          <div className={`${styles.modal} ${styles.detailModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <h2>{selectedCampaign.name}</h2>
              <span className={`${styles.status} ${getStatusColor(selectedCampaign.status)}`}>
                {selectedCampaign.status}
              </span>
            </div>

            <div className={styles.detailSection}>
              <h3>Target Criteria</h3>
              <div className={styles.criteriaGrid}>
                <div>
                  <strong>Platforms:</strong>
                  <div>{selectedCampaign.targetCriteria.platforms?.join(", ") || "None"}</div>
                </div>
                <div>
                  <strong>Interests:</strong>
                  <div>{selectedCampaign.targetCriteria.interests?.join(", ") || "None"}</div>
                </div>
                <div>
                  <strong>Keywords:</strong>
                  <div>{selectedCampaign.targetCriteria.keywords?.join(", ") || "None"}</div>
                </div>
                <div>
                  <strong>Locations:</strong>
                  <div>{selectedCampaign.targetCriteria.locations?.join(", ") || "None"}</div>
                </div>
              </div>
            </div>

            {selectedCampaign.stats && (
              <div className={styles.detailSection}>
                <h3>Pipeline Stats</h3>
                <div className={styles.pipelineVisual}>
                  <div className={styles.pipelineStage}>
                    <div className={styles.pipelineCount}>{selectedCampaign.stats.acquired}</div>
                    <div className={styles.pipelineLabel}>Acquired</div>
                  </div>
                  <div className={styles.pipelineArrow}>→</div>
                  <div className={styles.pipelineStage}>
                    <div className={styles.pipelineCount}>{selectedCampaign.stats.filtered}</div>
                    <div className={styles.pipelineLabel}>Filtered</div>
                  </div>
                  <div className={styles.pipelineArrow}>→</div>
                  <div className={styles.pipelineStage}>
                    <div className={styles.pipelineCount}>{selectedCampaign.stats.approved}</div>
                    <div className={styles.pipelineLabel}>Approved</div>
                  </div>
                  <div className={styles.pipelineArrow}>→</div>
                  <div className={styles.pipelineStage}>
                    <div className={styles.pipelineCount}>{selectedCampaign.stats.engaged}</div>
                    <div className={styles.pipelineLabel}>Engaged</div>
                  </div>
                  <div className={styles.pipelineArrow}>→</div>
                  <div className={styles.pipelineStage}>
                    <div className={styles.pipelineCount}>{selectedCampaign.stats.responded}</div>
                    <div className={styles.pipelineLabel}>Responses</div>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.detailSection}>
              <h3>Actions</h3>
              <div className={styles.detailActions}>
                <a href={`/review?campaignId=${selectedCampaign._id}`} className={styles.linkBtn}>
                  Review Profiles
                </a>
                <a href={`/status?campaignId=${selectedCampaign._id}`} className={styles.linkBtn}>
                  View Status
                </a>
              </div>
            </div>

            <button className={styles.closeBtn} onClick={() => setSelectedCampaign(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
