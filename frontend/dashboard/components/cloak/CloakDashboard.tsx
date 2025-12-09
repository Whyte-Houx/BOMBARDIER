/**
 * Cloak Dashboard - Anti-Detection Control Panel
 * Unified interface for managing all stealth systems
 */

import { useState, useEffect } from 'react';
import styles from './CloakDashboard.module.css';

interface CloakStatus {
    fingerprint: ModuleStatus;
    proxyManager: ModuleStatus;
    proxyScraper: ModuleStatus;
    timing: ModuleStatus;
    accountWarming: ModuleStatus;
}

interface ModuleStatus {
    enabled: boolean;
    status: 'active' | 'degraded' | 'error' | 'disabled';
    metrics?: Record<string, any>;
}

interface ProxyInfo {
    id: string;
    host: string;
    port: number;
    type: string;
    geography: string;
    status: string;
    successRate: number;
    responseTime: number;
}

interface FingerprintInfo {
    id: string;
    userAgent: string;
    platform: string;
    screen: { width: number; height: number };
    createdAt: string;
}

interface AccountInfo {
    id: string;
    platform: string;
    username: string;
    currentPhase: string;
    daysInPhase: number;
    todayActions: number;
    maxActions: number;
    automationLevel: number;
}

export default function CloakDashboard() {
    const [status, setStatus] = useState<CloakStatus | null>(null);
    const [proxies, setProxies] = useState<ProxyInfo[]>([]);
    const [fingerprints, setFingerprints] = useState<FingerprintInfo[]>([]);
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'proxies' | 'fingerprints' | 'accounts' | 'config'>('overview');
    const [loading, setLoading] = useState(true);

    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050';

    useEffect(() => {
        loadCloakStatus();
        const interval = setInterval(loadCloakStatus, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const loadCloakStatus = async () => {
        try {
            const res = await fetch(`${API}/cloak/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
                setProxies(data.proxies || []);
                setFingerprints(data.fingerprints || []);
                setAccounts(data.accounts || []);
            }
        } catch (err) {
            console.error('Failed to load cloak status:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return '🟢';
            case 'degraded': return '🟡';
            case 'error': return '🔴';
            default: return '⚪';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10b981';
            case 'degraded': return '#f59e0b';
            case 'error': return '#ef4444';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading Cloak System...</p>
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>🎭 Cloak System</h1>
                    <p>Anti-Detection & Stealth Infrastructure</p>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.refreshBtn} onClick={loadCloakStatus}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={activeTab === 'overview' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button
                    className={activeTab === 'proxies' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('proxies')}
                >
                    🌐 Proxies
                </button>
                <button
                    className={activeTab === 'fingerprints' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('fingerprints')}
                >
                    🎭 Fingerprints
                </button>
                <button
                    className={activeTab === 'accounts' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('accounts')}
                >
                    🌱 Account Warming
                </button>
                <button
                    className={activeTab === 'config' ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab('config')}
                >
                    ⚙️ Configuration
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'overview' && (
                    <OverviewTab status={status} getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} />
                )}
                {activeTab === 'proxies' && (
                    <ProxiesTab proxies={proxies} getStatusColor={getStatusColor} />
                )}
                {activeTab === 'fingerprints' && (
                    <FingerprintsTab fingerprints={fingerprints} />
                )}
                {activeTab === 'accounts' && (
                    <AccountsTab accounts={accounts} />
                )}
                {activeTab === 'config' && (
                    <ConfigTab />
                )}
            </div>
        </div>
    );
}

// Overview Tab
function OverviewTab({ status, getStatusIcon, getStatusColor }: any) {
    if (!status) return <div>No status data</div>;

    const modules = [
        { name: 'Fingerprint Engine', key: 'fingerprint', description: 'Browser fingerprint randomization' },
        { name: 'Proxy Manager', key: 'proxyManager', description: 'Paid proxy rotation & health' },
        { name: 'Proxy Scraper', key: 'proxyScraper', description: 'Free proxies + Tor' },
        { name: 'Timing Engine', key: 'timing', description: 'Human-like behavioral pacing' },
        { name: 'Account Warming', key: 'accountWarming', description: 'Gradual automation ramp-up' },
    ];

    return (
        <div className={styles.overview}>
            <h2>System Status</h2>
            <div className={styles.moduleGrid}>
                {modules.map((module) => {
                    const moduleStatus = status[module.key];
                    return (
                        <div key={module.key} className={styles.moduleCard}>
                            <div className={styles.moduleHeader}>
                                <span className={styles.moduleIcon}>{getStatusIcon(moduleStatus?.status)}</span>
                                <h3>{module.name}</h3>
                            </div>
                            <p className={styles.moduleDesc}>{module.description}</p>
                            <div className={styles.moduleStatus}>
                                <span
                                    className={styles.statusBadge}
                                    style={{ backgroundColor: getStatusColor(moduleStatus?.status) }}
                                >
                                    {moduleStatus?.status || 'unknown'}
                                </span>
                            </div>
                            {moduleStatus?.metrics && (
                                <div className={styles.moduleMetrics}>
                                    {Object.entries(moduleStatus.metrics).map(([key, value]) => (
                                        <div key={key} className={styles.metric}>
                                            <span className={styles.metricLabel}>{key}:</span>
                                            <span className={styles.metricValue}>{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Proxies Tab
function ProxiesTab({ proxies, getStatusColor }: any) {
    return (
        <div className={styles.proxies}>
            <h2>Proxy Pool ({proxies.length} proxies)</h2>
            <div className={styles.proxyTable}>
                <table>
                    <thead>
                        <tr>
                            <th>Host:Port</th>
                            <th>Type</th>
                            <th>Geography</th>
                            <th>Status</th>
                            <th>Success Rate</th>
                            <th>Response Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proxies.map((proxy: ProxyInfo) => (
                            <tr key={proxy.id}>
                                <td className={styles.proxyHost}>{proxy.host}:{proxy.port}</td>
                                <td>{proxy.type}</td>
                                <td>{proxy.geography}</td>
                                <td>
                                    <span
                                        className={styles.statusBadge}
                                        style={{ backgroundColor: getStatusColor(proxy.status) }}
                                    >
                                        {proxy.status}
                                    </span>
                                </td>
                                <td>{(proxy.successRate * 100).toFixed(1)}%</td>
                                <td>{proxy.responseTime}ms</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Fingerprints Tab
function FingerprintsTab({ fingerprints }: any) {
    return (
        <div className={styles.fingerprints}>
            <h2>Active Fingerprints ({fingerprints.length})</h2>
            <div className={styles.fingerprintGrid}>
                {fingerprints.map((fp: FingerprintInfo) => (
                    <div key={fp.id} className={styles.fingerprintCard}>
                        <div className={styles.fingerprintHeader}>
                            <span className={styles.fingerprintId}>{fp.id.slice(0, 8)}</span>
                            <span className={styles.fingerprintDate}>
                                {new Date(fp.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <div className={styles.fingerprintDetails}>
                            <p><strong>User Agent:</strong> {fp.userAgent}</p>
                            <p><strong>Platform:</strong> {fp.platform}</p>
                            <p><strong>Screen:</strong> {fp.screen.width}x{fp.screen.height}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Accounts Tab
function AccountsTab({ accounts }: any) {
    return (
        <div className={styles.accounts}>
            <h2>Account Warming ({accounts.length} accounts)</h2>
            <div className={styles.accountsTable}>
                <table>
                    <thead>
                        <tr>
                            <th>Platform</th>
                            <th>Username</th>
                            <th>Phase</th>
                            <th>Days in Phase</th>
                            <th>Today's Actions</th>
                            <th>Automation Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((account: AccountInfo) => (
                            <tr key={account.id}>
                                <td>{account.platform}</td>
                                <td>{account.username}</td>
                                <td>
                                    <span className={styles.phaseBadge}>
                                        {account.currentPhase}
                                    </span>
                                </td>
                                <td>{account.daysInPhase.toFixed(1)} days</td>
                                <td>
                                    {account.todayActions} / {account.maxActions}
                                    <div className={styles.progressBar}>
                                        <div
                                            className={styles.progressFill}
                                            style={{ width: `${(account.todayActions / account.maxActions) * 100}%` }}
                                        ></div>
                                    </div>
                                </td>
                                <td>{(account.automationLevel * 100).toFixed(0)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Config Tab
function ConfigTab() {
    return (
        <div className={styles.config}>
            <h2>Configuration</h2>
            <div className={styles.configSections}>
                <div className={styles.configSection}>
                    <h3>Fingerprint Engine</h3>
                    <label>
                        <input type="checkbox" defaultChecked /> Enable Canvas Noise
                    </label>
                    <label>
                        <input type="checkbox" defaultChecked /> Enable WebGL Spoofing
                    </label>
                    <label>
                        <input type="checkbox" defaultChecked /> Enable Audio Randomization
                    </label>
                </div>

                <div className={styles.configSection}>
                    <h3>Proxy Manager</h3>
                    <label>
                        Rotation Strategy:
                        <select>
                            <option>performance-based</option>
                            <option>round-robin</option>
                            <option>least-used</option>
                        </select>
                    </label>
                    <label>
                        Min Success Rate:
                        <input type="number" defaultValue="0.8" step="0.1" min="0" max="1" />
                    </label>
                </div>

                <div className={styles.configSection}>
                    <h3>Timing Engine</h3>
                    <label>
                        <input type="checkbox" defaultChecked /> Enable Circadian Rhythm
                    </label>
                    <label>
                        <input type="checkbox" defaultChecked /> Enable Session Fatigue
                    </label>
                    <label>
                        Min Delay (ms):
                        <input type="number" defaultValue="1000" />
                    </label>
                    <label>
                        Max Delay (ms):
                        <input type="number" defaultValue="30000" />
                    </label>
                </div>

                <div className={styles.configSection}>
                    <h3>Account Warming</h3>
                    <label>
                        Manual Phase Duration (days):
                        <input type="number" defaultValue="14" />
                    </label>
                    <label>
                        Light Phase Duration (days):
                        <input type="number" defaultValue="14" />
                    </label>
                    <label>
                        Moderate Phase Duration (days):
                        <input type="number" defaultValue="14" />
                    </label>
                </div>
            </div>

            <button className={styles.saveBtn}>💾 Save Configuration</button>
        </div>
    );
}
