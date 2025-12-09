import { useEffect, useState, useCallback } from "react";
import styles from "../styles/review.module.css";

/**
 * Enhanced Review Queue - Human-in-the-loop Dashboard
 * Per dev_docs - Features:
 * - Gallery/List view toggle
 * - Keyboard shortcuts (A=approve, R=reject, N=next, P=prev)
 * - Batch operations
 * - Profile detail panel
 * - Risk/Quality score display
 */

interface Profile {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  profileUrl?: string;
  interests?: string[];
  riskScore?: number;
  sentiment?: { overall: number; confidence: number };
  metadata?: {
    followers?: number;
    following?: number;
    postsCount?: number;
    verified?: boolean;
    researchData?: {
      communicationStyle?: string;
      activityPattern?: string;
      engagementLevel?: string;
    };
  };
}

export default function Review() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";
  const token = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") || "" : "";
  const role = typeof window !== "undefined" ? window.localStorage.getItem("auth_role") || "viewer" : "viewer";
  const canEdit = role !== "viewer";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(20);
  const [skip, setSkip] = useState<number>(0);
  const [stats, setStats] = useState<{ pending: number; approved: number; rejected: number } | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  async function loadProfiles() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/profiles?status=pending&limit=${limit}&skip=${skip}`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setProfiles(data);
      setSelectedIds(new Set());
      setFocusedIndex(0);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API}/profiles/count`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { }
  }

  useEffect(() => { loadProfiles(); loadStats(); }, [limit, skip]);

  const approve = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/profiles/${id}/approve`, { method: "POST", headers });
      if (!res.ok) throw new Error(`${res.status}`);
      await loadProfiles();
      loadStats();
    } catch (e: any) {
      setError(e.message || "Failed to approve profile");
    } finally {
      setLoading(false);
    }
  }, [API, headers]);

  const reject = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/profiles/${id}/reject`, { method: "POST", headers });
      if (!res.ok) throw new Error(`${res.status}`);
      await loadProfiles();
      loadStats();
    } catch (e: any) {
      setError(e.message || "Failed to reject profile");
    } finally {
      setLoading(false);
    }
  }, [API, headers]);

  // Batch operations
  const batchApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/profiles/batch/approve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await loadProfiles();
      loadStats();
    } catch (e: any) {
      setError(e.message || "Failed to batch approve");
    } finally {
      setLoading(false);
    }
  }, [selectedIds, API, headers]);

  const batchReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/profiles/batch/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await loadProfiles();
      loadStats();
    } catch (e: any) {
      setError(e.message || "Failed to batch reject");
    } finally {
      setLoading(false);
    }
  }, [selectedIds, API, headers]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!canEdit) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "a":
          if (profiles[focusedIndex]) {
            approve(profiles[focusedIndex]._id);
          }
          break;
        case "r":
          if (profiles[focusedIndex]) {
            reject(profiles[focusedIndex]._id);
          }
          break;
        case "n":
        case "arrowdown":
          setFocusedIndex(i => Math.min(profiles.length - 1, i + 1));
          break;
        case "p":
        case "arrowup":
          setFocusedIndex(i => Math.max(0, i - 1));
          break;
        case " ":
          e.preventDefault();
          if (profiles[focusedIndex]) {
            toggleSelect(profiles[focusedIndex]._id);
          }
          break;
        case "d":
          setShowDetail(d => !d);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [profiles, focusedIndex, approve, reject, canEdit]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(profiles.map(p => p._id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const getRiskColor = (score?: number) => {
    if (score === undefined) return "#888";
    if (score > 50) return "#ef4444";
    if (score > 25) return "#f59e0b";
    return "#22c55e";
  };

  const focusedProfile = profiles[focusedIndex];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Review Queue</h2>
        {stats && (
          <div className={styles.stats}>
            <span className={styles.statPending}>{stats.pending || 0} pending</span>
            <span className={styles.statApproved}>{stats.approved || 0} approved</span>
            <span className={styles.statRejected}>{stats.rejected || 0} rejected</span>
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button
            className={viewMode === "list" ? styles.active : ""}
            onClick={() => setViewMode("list")}
          >List</button>
          <button
            className={viewMode === "gallery" ? styles.active : ""}
            onClick={() => setViewMode("gallery")}
          >Gallery</button>
        </div>

        <div className={styles.pagination}>
          <label>
            Per page:
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <button disabled={skip === 0 || loading} onClick={() => setSkip(Math.max(0, skip - limit))}>← Prev</button>
          <span>Page {Math.floor(skip / limit) + 1}</span>
          <button disabled={loading || profiles.length < limit} onClick={() => setSkip(skip + limit)}>Next →</button>
          <button disabled={loading} onClick={loadProfiles}>↻ Refresh</button>
        </div>

        {canEdit && (
          <div className={styles.batchControls}>
            <button onClick={selectAll}>Select All</button>
            <button onClick={selectNone}>Select None</button>
            <button
              disabled={loading || selectedIds.size === 0}
              onClick={batchApprove}
              className={styles.approveBtn}
            >✓ Approve ({selectedIds.size})</button>
            <button
              disabled={loading || selectedIds.size === 0}
              onClick={batchReject}
              className={styles.rejectBtn}
            >✕ Reject ({selectedIds.size})</button>
          </div>
        )}
      </div>

      {canEdit && (
        <div className={styles.shortcuts}>
          <span>Shortcuts:</span>
          <kbd>A</kbd>=Approve
          <kbd>R</kbd>=Reject
          <kbd>↑↓</kbd>=Navigate
          <kbd>Space</kbd>=Select
          <kbd>D</kbd>=Details
        </div>
      )}

      <div className={styles.mainContent}>
        <div className={viewMode === "gallery" ? styles.gallery : styles.list}>
          {loading && profiles.length === 0 ? (
            <p>Loading…</p>
          ) : profiles.length === 0 ? (
            <p className={styles.empty}>No profiles pending review 🎉</p>
          ) : (
            profiles.map((p, idx) => (
              <div
                key={p._id}
                className={`${styles.item} ${idx === focusedIndex ? styles.focused : ""} ${selectedIds.has(p._id) ? styles.selected : ""}`}
                onClick={() => setFocusedIndex(idx)}
              >
                {canEdit && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p._id)}
                    onChange={() => toggleSelect(p._id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div className={styles.avatar}>
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.username} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>{p.username[0]?.toUpperCase()}</div>
                  )}
                </div>

                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <strong>{p.displayName || p.username}</strong>
                    <span className={styles.platform}>{p.platform}</span>
                    {p.metadata?.verified && <span className={styles.verified}>✓</span>}
                  </div>
                  <div className={styles.username}>@{p.username}</div>
                  {p.bio && <div className={styles.bio}>{p.bio.substring(0, 100)}...</div>}
                  {p.interests && p.interests.length > 0 && (
                    <div className={styles.interests}>
                      {p.interests.slice(0, 3).map(i => (
                        <span key={i} className={styles.tag}>{i}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.scores}>
                  {p.riskScore !== undefined && (
                    <div className={styles.score} style={{ color: getRiskColor(p.riskScore) }}>
                      Risk: {p.riskScore}
                    </div>
                  )}
                  {p.metadata?.followers && (
                    <div className={styles.followers}>{p.metadata.followers.toLocaleString()} followers</div>
                  )}
                </div>

                {canEdit && (
                  <div className={styles.actions}>
                    <button disabled={loading} onClick={(e) => { e.stopPropagation(); approve(p._id); }} className={styles.approveBtn}>✓</button>
                    <button disabled={loading} onClick={(e) => { e.stopPropagation(); reject(p._id); }} className={styles.rejectBtn}>✕</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {showDetail && focusedProfile && (
          <div className={styles.detailPanel}>
            <h3>Profile Details</h3>
            <button className={styles.closeDetail} onClick={() => setShowDetail(false)}>✕</button>

            <div className={styles.detailContent}>
              <div className={styles.detailHeader}>
                <div className={styles.detailAvatar}>
                  {focusedProfile.avatarUrl ? (
                    <img src={focusedProfile.avatarUrl} alt={focusedProfile.username} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>{focusedProfile.username[0]?.toUpperCase()}</div>
                  )}
                </div>
                <div>
                  <h4>{focusedProfile.displayName || focusedProfile.username}</h4>
                  <p>@{focusedProfile.username} • {focusedProfile.platform}</p>
                </div>
              </div>

              {focusedProfile.bio && (
                <div className={styles.detailSection}>
                  <h5>Bio</h5>
                  <p>{focusedProfile.bio}</p>
                </div>
              )}

              {focusedProfile.metadata && (
                <div className={styles.detailSection}>
                  <h5>Stats</h5>
                  <div className={styles.detailStats}>
                    <span>{focusedProfile.metadata.followers?.toLocaleString() || 0} followers</span>
                    <span>{focusedProfile.metadata.following?.toLocaleString() || 0} following</span>
                    <span>{focusedProfile.metadata.postsCount?.toLocaleString() || 0} posts</span>
                  </div>
                </div>
              )}

              {focusedProfile.interests && focusedProfile.interests.length > 0 && (
                <div className={styles.detailSection}>
                  <h5>Interests</h5>
                  <div className={styles.interests}>
                    {focusedProfile.interests.map(i => (
                      <span key={i} className={styles.tag}>{i}</span>
                    ))}
                  </div>
                </div>
              )}

              {focusedProfile.metadata?.researchData && (
                <div className={styles.detailSection}>
                  <h5>Analysis</h5>
                  <div className={styles.analysis}>
                    <p><strong>Communication:</strong> {focusedProfile.metadata.researchData.communicationStyle || "Unknown"}</p>
                    <p><strong>Activity:</strong> {focusedProfile.metadata.researchData.activityPattern || "Unknown"}</p>
                    <p><strong>Engagement:</strong> {focusedProfile.metadata.researchData.engagementLevel || "Unknown"}</p>
                  </div>
                </div>
              )}

              <div className={styles.detailSection}>
                <h5>Scores</h5>
                <div className={styles.scoreDisplay}>
                  <div>
                    <strong>Risk Score</strong>
                    <span style={{ color: getRiskColor(focusedProfile.riskScore) }}>
                      {focusedProfile.riskScore ?? "N/A"}
                    </span>
                  </div>
                  {focusedProfile.sentiment && (
                    <div>
                      <strong>Sentiment</strong>
                      <span>{(focusedProfile.sentiment.overall * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {focusedProfile.profileUrl && (
                <a href={focusedProfile.profileUrl} target="_blank" rel="noopener noreferrer" className={styles.viewProfile}>
                  View on {focusedProfile.platform} →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}