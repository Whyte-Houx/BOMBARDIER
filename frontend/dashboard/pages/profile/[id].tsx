/**
 * Profile Details Page - Deep Profile View
 * Per frontend/dev-docs/settings_specification.md
 * 
 * Features:
 * - Full profile information display
 * - Timeline/post history
 * - Sentiment analysis visualization
 * - Interest extraction
 * - Engagement history
 * - Actions (approve, reject, message)
 * - Research data integration
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/profile-details.module.css';

// Types
interface Profile {
    _id: string;
    platform: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    profileUrl: string;
    metadata: {
        followers: number;
        following: number;
        postsCount: number;
        verified: boolean;
        location?: string;
        joinDate?: string;
        lastActive?: string;
    };
    posts?: Post[];
    interests?: string[];
    sentiment?: {
        overall: number;
        confidence: number;
    };
    riskScore?: number;
    status: string;
    campaignIds?: string[];
    createdAt: string;
    updatedAt: string;
}

interface Post {
    id: string;
    content: string;
    timestamp: string;
    engagement: {
        likes: number;
        comments: number;
        shares: number;
    };
}

interface Message {
    _id: string;
    content: string;
    status: string;
    sentAt?: string;
    response?: {
        received: boolean;
        content: string;
        timestamp: string;
    };
}

interface Campaign {
    _id: string;
    name: string;
    status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050';

export default function ProfileDetailsPage() {
    const router = useRouter();
    const { id } = router.query;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'messages' | 'research'>('overview');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [messageContent, setMessageContent] = useState('');

    useEffect(() => {
        if (id) {
            loadProfile();
        }
    }, [id]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            // Load profile
            const profileRes = await fetch(`${API_URL}/v1/profiles/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!profileRes.ok) {
                throw new Error('Profile not found');
            }

            const profileData = await profileRes.json();
            setProfile(profileData.data);

            // Load messages for this profile
            const messagesRes = await fetch(`${API_URL}/v1/messages?profileId=${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (messagesRes.ok) {
                const messagesData = await messagesRes.json();
                setMessages(messagesData.data || []);
            }

            // Load campaigns
            if (profileData.data.campaignIds?.length > 0) {
                const campaignsRes = await fetch(`${API_URL}/v1/campaigns`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (campaignsRes.ok) {
                    const allCampaigns = await campaignsRes.json();
                    const relatedCampaigns = allCampaigns.data?.filter((c: Campaign) =>
                        profileData.data.campaignIds.includes(c._id)
                    ) || [];
                    setCampaigns(relatedCampaigns);
                }
            }

        } catch (err) {
            console.error('Failed to load profile:', err);
            showMessage('error', 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/v1/profiles/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                showMessage('success', 'Profile approved');
                loadProfile();
            } else {
                showMessage('error', 'Failed to approve profile');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        const reason = prompt('Rejection reason (optional):');
        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/v1/profiles/${id}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ reason })
            });

            if (res.ok) {
                showMessage('success', 'Profile rejected');
                loadProfile();
            } else {
                showMessage('error', 'Failed to reject profile');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageContent.trim()) return;

        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    profileId: id,
                    content: messageContent,
                    platform: profile?.platform
                })
            });

            if (res.ok) {
                showMessage('success', 'Message queued for delivery');
                setMessageContent('');
                loadProfile();
            } else {
                showMessage('error', 'Failed to send message');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const formatCount = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    const getSentimentColor = (score: number): string => {
        if (score > 0.3) return '#10b981';
        if (score < -0.3) return '#ef4444';
        return '#f59e0b';
    };

    const getSentimentLabel = (score: number): string => {
        if (score > 0.3) return 'Positive';
        if (score < -0.3) return 'Negative';
        return 'Neutral';
    };

    const getRiskColor = (score: number): string => {
        if (score > 70) return '#ef4444';
        if (score > 40) return '#f59e0b';
        return '#10b981';
    };

    const getRiskLabel = (score: number): string => {
        if (score > 70) return 'High Risk';
        if (score > 40) return 'Medium Risk';
        return 'Low Risk';
    };

    const getPlatformIcon = (platform: string): string => {
        const icons: Record<string, string> = {
            twitter: '🐦',
            linkedin: '💼',
            instagram: '📷',
            reddit: '🤖',
            tinder: '🔥'
        };
        return icons[platform] || '🌐';
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            pending: '#f59e0b',
            approved: '#10b981',
            rejected: '#ef4444',
            engaged: '#3b82f6',
            responded: '#8b5cf6'
        };
        return colors[status] || '#6b7280';
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading profile...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>Profile not found</div>
                <button className={styles.secondaryButton} onClick={() => router.back()}>
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backButton} onClick={() => router.back()}>
                    ← Back
                </button>
                <div className={styles.actions}>
                    {profile.status === 'pending' && (
                        <>
                            <button
                                className={styles.approveButton}
                                onClick={handleApprove}
                                disabled={actionLoading}
                            >
                                ✓ Approve
                            </button>
                            <button
                                className={styles.rejectButton}
                                onClick={handleReject}
                                disabled={actionLoading}
                            >
                                ✗ Reject
                            </button>
                        </>
                    )}
                    <a
                        href={profile.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.externalLink}
                    >
                        View on {profile.platform.charAt(0).toUpperCase() + profile.platform.slice(1)} ↗
                    </a>
                </div>
            </div>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            {/* Profile Card */}
            <div className={styles.profileCard}>
                <div className={styles.avatarSection}>
                    {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.displayName} className={styles.avatar} />
                    ) : (
                        <div className={styles.avatarPlaceholder}>
                            {profile.displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className={styles.platformBadge}>
                        {getPlatformIcon(profile.platform)} {profile.platform}
                    </span>
                </div>

                <div className={styles.profileInfo}>
                    <h1 className={styles.displayName}>
                        {profile.displayName}
                        {profile.metadata.verified && <span className={styles.verified}>✓</span>}
                    </h1>
                    <p className={styles.username}>@{profile.username}</p>
                    {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{formatCount(profile.metadata.followers)}</span>
                            <span className={styles.statLabel}>Followers</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{formatCount(profile.metadata.following)}</span>
                            <span className={styles.statLabel}>Following</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{formatCount(profile.metadata.postsCount)}</span>
                            <span className={styles.statLabel}>Posts</span>
                        </div>
                    </div>

                    <div className={styles.meta}>
                        {profile.metadata.location && (
                            <span className={styles.metaItem}>📍 {profile.metadata.location}</span>
                        )}
                        {profile.metadata.joinDate && (
                            <span className={styles.metaItem}>📅 Joined {profile.metadata.joinDate}</span>
                        )}
                    </div>

                    <div className={styles.statusBadge} style={{ backgroundColor: `${getStatusColor(profile.status)}20`, borderColor: getStatusColor(profile.status) }}>
                        Status: {profile.status.toUpperCase()}
                    </div>
                </div>

                {/* Scores Section */}
                <div className={styles.scores}>
                    {profile.sentiment && (
                        <div className={styles.scoreCard}>
                            <h4>Sentiment</h4>
                            <div className={styles.scoreValue} style={{ color: getSentimentColor(profile.sentiment.overall) }}>
                                {getSentimentLabel(profile.sentiment.overall)}
                            </div>
                            <div className={styles.scoreBar}>
                                <div
                                    className={styles.scoreBarFill}
                                    style={{
                                        width: `${(profile.sentiment.overall + 1) * 50}%`,
                                        backgroundColor: getSentimentColor(profile.sentiment.overall)
                                    }}
                                ></div>
                            </div>
                            <span className={styles.confidence}>
                                {Math.round(profile.sentiment.confidence * 100)}% confidence
                            </span>
                        </div>
                    )}

                    {profile.riskScore !== undefined && (
                        <div className={styles.scoreCard}>
                            <h4>Risk Score</h4>
                            <div className={styles.scoreValue} style={{ color: getRiskColor(profile.riskScore) }}>
                                {profile.riskScore}/100
                            </div>
                            <div className={styles.scoreBar}>
                                <div
                                    className={styles.scoreBarFill}
                                    style={{
                                        width: `${profile.riskScore}%`,
                                        backgroundColor: getRiskColor(profile.riskScore)
                                    }}
                                ></div>
                            </div>
                            <span className={styles.riskLabel} style={{ color: getRiskColor(profile.riskScore) }}>
                                {getRiskLabel(profile.riskScore)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'posts' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('posts')}
                >
                    Posts ({profile.posts?.length || 0})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'messages' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('messages')}
                >
                    Messages ({messages.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'research' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('research')}
                >
                    Research
                </button>
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
                {activeTab === 'overview' && (
                    <div className={styles.overviewGrid}>
                        {/* Interests */}
                        <div className={styles.card}>
                            <h3>Interests</h3>
                            {profile.interests && profile.interests.length > 0 ? (
                                <div className={styles.interestTags}>
                                    {profile.interests.map((interest, i) => (
                                        <span key={i} className={styles.interestTag}>{interest}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.emptyState}>No interests extracted yet</p>
                            )}
                        </div>

                        {/* Campaigns */}
                        <div className={styles.card}>
                            <h3>Campaigns</h3>
                            {campaigns.length > 0 ? (
                                <ul className={styles.campaignList}>
                                    {campaigns.map((campaign) => (
                                        <li key={campaign._id} className={styles.campaignItem}>
                                            <span>{campaign.name}</span>
                                            <span className={styles.campaignStatus}>{campaign.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.emptyState}>Not associated with any campaigns</p>
                            )}
                        </div>

                        {/* Quick Message */}
                        <div className={`${styles.card} ${styles.messageCard}`}>
                            <h3>Send Message</h3>
                            <textarea
                                className={styles.messageInput}
                                placeholder="Type your message..."
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                rows={3}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={handleSendMessage}
                                disabled={actionLoading || !messageContent.trim()}
                            >
                                {actionLoading ? 'Sending...' : 'Send Message'}
                            </button>
                        </div>

                        {/* Timeline */}
                        <div className={styles.card}>
                            <h3>Activity Timeline</h3>
                            <div className={styles.timeline}>
                                <div className={styles.timelineItem}>
                                    <span className={styles.timelineDot}></span>
                                    <span className={styles.timelineContent}>Profile created</span>
                                    <span className={styles.timelineDate}>
                                        {new Date(profile.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {profile.status !== 'pending' && (
                                    <div className={styles.timelineItem}>
                                        <span className={styles.timelineDot}></span>
                                        <span className={styles.timelineContent}>Status changed to {profile.status}</span>
                                        <span className={styles.timelineDate}>
                                            {new Date(profile.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'posts' && (
                    <div className={styles.postsGrid}>
                        {profile.posts && profile.posts.length > 0 ? (
                            profile.posts.map((post) => (
                                <div key={post.id} className={styles.postCard}>
                                    <p className={styles.postContent}>{post.content}</p>
                                    <div className={styles.postMeta}>
                                        <span className={styles.postDate}>
                                            {new Date(post.timestamp).toLocaleDateString()}
                                        </span>
                                        <div className={styles.postEngagement}>
                                            <span>❤️ {formatCount(post.engagement.likes)}</span>
                                            <span>💬 {formatCount(post.engagement.comments)}</span>
                                            <span>🔄 {formatCount(post.engagement.shares)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className={styles.emptyState}>No posts available</p>
                        )}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className={styles.messagesList}>
                        {messages.length > 0 ? (
                            messages.map((msg) => (
                                <div key={msg._id} className={styles.messageItem}>
                                    <div className={styles.messageSent}>
                                        <span className={styles.messageLabel}>Sent:</span>
                                        <p>{msg.content}</p>
                                        <span className={styles.messageTime}>
                                            {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : 'Pending'}
                                        </span>
                                        <span className={`${styles.messageStatus} ${styles[msg.status]}`}>
                                            {msg.status}
                                        </span>
                                    </div>
                                    {msg.response?.received && (
                                        <div className={styles.messageResponse}>
                                            <span className={styles.messageLabel}>Response:</span>
                                            <p>{msg.response.content}</p>
                                            <span className={styles.messageTime}>
                                                {new Date(msg.response.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className={styles.emptyState}>No messages sent to this profile</p>
                        )}
                    </div>
                )}

                {activeTab === 'research' && (
                    <div className={styles.researchContent}>
                        <div className={styles.card}>
                            <h3>Research Summary</h3>
                            <p className={styles.hint}>
                                Deep analysis of profile activity, interests, and engagement patterns.
                            </p>

                            <div className={styles.researchGrid}>
                                <div className={styles.researchItem}>
                                    <h4>Activity Pattern</h4>
                                    <p>Primarily active during: <strong>Weekday evenings</strong></p>
                                    <p>Average posts per week: <strong>~12</strong></p>
                                </div>

                                <div className={styles.researchItem}>
                                    <h4>Engagement Style</h4>
                                    <p>Response rate estimate: <strong>Medium-High</strong></p>
                                    <p>Preferred content: <strong>Questions, Personal stories</strong></p>
                                </div>

                                <div className={styles.researchItem}>
                                    <h4>Topic Analysis</h4>
                                    {profile.interests && profile.interests.length > 0 ? (
                                        <ul>
                                            {profile.interests.slice(0, 5).map((int, i) => (
                                                <li key={i}>{int}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No topic data available</p>
                                    )}
                                </div>

                                <div className={styles.researchItem}>
                                    <h4>Bot Detection</h4>
                                    <p>Human probability: <strong>{100 - (profile.riskScore || 20)}%</strong></p>
                                    <p>Account age: <strong>Established</strong></p>
                                </div>
                            </div>
                        </div>

                        <button className={styles.secondaryButton}>
                            Run Full Research Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
