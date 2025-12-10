/**
 * Settings Page - Complete Settings Management
 * Per frontend/dev-docs/settings_specification.md
 * 
 * Features:
 * - Account settings
 * - Security (password change, 2FA)
 * - OAuth connections
 * - API Keys management
 * - Cloak configuration
 * - Proxy management
 * - Worker settings
 * - Display preferences
 * - Webhooks management
 * - Danger zone
 */

import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/settings.module.css';

// Types
interface User {
    id: string;
    email: string;
    username: string;
    role: string;
    profile: {
        firstName: string;
        lastName: string;
        avatar?: string;
    };
    createdAt: string;
}

interface ApiKey {
    id: string;
    name: string;
    keyPreview: string;
    permissions: string[];
    lastUsed?: string;
    createdAt: string;
}

interface OAuthConnection {
    provider: string;
    connected: boolean;
    email?: string;
    connectedAt?: string;
}

interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
    lastTriggered?: string;
}

interface ProxyConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    type: 'http' | 'socks5' | 'residential';
    active: boolean;
    lastTested?: string;
    latency?: number;
}

type SettingsTab = 'account' | 'security' | 'oauth' | 'apikeys' | 'cloak' | 'proxies' | 'workers' | 'display' | 'webhooks' | 'danger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Data states
    const [user, setUser] = useState<User | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [oauthConnections, setOauthConnections] = useState<OAuthConnection[]>([]);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [proxies, setProxies] = useState<ProxyConfig[]>([]);

    // Form states
    const [accountForm, setAccountForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        username: ''
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [displaySettings, setDisplaySettings] = useState({
        theme: 'dark',
        profilesPerPage: 50,
        showBotScores: true,
        compactMode: false,
        autoRefresh: true,
        refreshInterval: 30
    });
    const [workerSettings, setWorkerSettings] = useState({
        acquisitionEnabled: true,
        filteringEnabled: true,
        engagementEnabled: true,
        trackingEnabled: true,
        maxConcurrentJobs: 5,
        retryAttempts: 3
    });
    const [cloakSettings, setCloakSettings] = useState({
        fingerprintEnabled: true,
        proxyRotation: true,
        stealthMode: true,
        humanSimulation: true,
        sessionPersistence: true
    });

    // New item forms
    const [newApiKeyForm, setNewApiKeyForm] = useState({ name: '', permissions: [] as string[] });
    const [newWebhookForm, setNewWebhookForm] = useState({ name: '', url: '', events: [] as string[] });
    const [newProxyForm, setNewProxyForm] = useState({ name: '', host: '', port: 1080, type: 'http' as const });

    // Load data on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            // Load user data
            const userRes = await fetch(`${API_URL}/v1/auth/profile`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData.data);
                setAccountForm({
                    firstName: userData.data.profile?.firstName || '',
                    lastName: userData.data.profile?.lastName || '',
                    email: userData.data.email,
                    username: userData.data.username
                });
            }

            // Load API keys
            const keysRes = await fetch(`${API_URL}/v1/settings/api-keys`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (keysRes.ok) {
                const keysData = await keysRes.json();
                setApiKeys(keysData.data || []);
            }

            // Load OAuth connections
            const oauthRes = await fetch(`${API_URL}/v1/settings/oauth`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (oauthRes.ok) {
                const oauthData = await oauthRes.json();
                setOauthConnections(oauthData.data || [
                    { provider: 'google', connected: false },
                    { provider: 'github', connected: false }
                ]);
            } else {
                // Default OAuth state
                setOauthConnections([
                    { provider: 'google', connected: false },
                    { provider: 'github', connected: false }
                ]);
            }

            // Load webhooks
            const webhooksRes = await fetch(`${API_URL}/v1/webhooks`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (webhooksRes.ok) {
                const webhooksData = await webhooksRes.json();
                setWebhooks(webhooksData.data || []);
            }

            // Load proxies
            const proxiesRes = await fetch(`${API_URL}/v1/cloak/proxies`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (proxiesRes.ok) {
                const proxiesData = await proxiesRes.json();
                setProxies(proxiesData.data || []);
            }

        } catch (err) {
            console.error('Failed to load settings:', err);
            showMessage('error', 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // Account actions
    const saveAccountSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/v1/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    profile: {
                        firstName: accountForm.firstName,
                        lastName: accountForm.lastName
                    }
                })
            });

            if (res.ok) {
                showMessage('success', 'Account settings saved');
                loadSettings();
            } else {
                showMessage('error', 'Failed to save account settings');
            }
        } finally {
            setSaving(false);
        }
    };

    // Password change
    const changePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showMessage('error', 'Passwords do not match');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            showMessage('error', 'Password must be at least 8 characters');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/v1/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });

            if (res.ok) {
                showMessage('success', 'Password changed successfully');
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                const data = await res.json();
                showMessage('error', data.message || 'Failed to change password');
            }
        } finally {
            setSaving(false);
        }
    };

    // API Key management
    const createApiKey = async () => {
        if (!newApiKeyForm.name) {
            showMessage('error', 'API key name is required');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/v1/settings/api-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newApiKeyForm)
            });

            if (res.ok) {
                const data = await res.json();
                showMessage('success', `API key created: ${data.key} (save this, it won't be shown again)`);
                setNewApiKeyForm({ name: '', permissions: [] });
                loadSettings();
            } else {
                showMessage('error', 'Failed to create API key');
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteApiKey = async (keyId: string) => {
        if (!confirm('Are you sure you want to delete this API key?')) return;

        try {
            const res = await fetch(`${API_URL}/v1/settings/api-keys/${keyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                showMessage('success', 'API key deleted');
                loadSettings();
            } else {
                showMessage('error', 'Failed to delete API key');
            }
        } catch (err) {
            showMessage('error', 'Failed to delete API key');
        }
    };

    // Webhook management
    const createWebhook = async () => {
        if (!newWebhookForm.name || !newWebhookForm.url) {
            showMessage('error', 'Webhook name and URL are required');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/v1/webhooks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ...newWebhookForm,
                    enabled: true
                })
            });

            if (res.ok) {
                showMessage('success', 'Webhook created');
                setNewWebhookForm({ name: '', url: '', events: [] });
                loadSettings();
            } else {
                showMessage('error', 'Failed to create webhook');
            }
        } finally {
            setSaving(false);
        }
    };

    const toggleWebhook = async (webhookId: string, enabled: boolean) => {
        try {
            await fetch(`${API_URL}/v1/webhooks/${webhookId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ enabled })
            });
            loadSettings();
        } catch (err) {
            showMessage('error', 'Failed to update webhook');
        }
    };

    const deleteWebhook = async (webhookId: string) => {
        if (!confirm('Are you sure you want to delete this webhook?')) return;

        try {
            await fetch(`${API_URL}/v1/webhooks/${webhookId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            showMessage('success', 'Webhook deleted');
            loadSettings();
        } catch (err) {
            showMessage('error', 'Failed to delete webhook');
        }
    };

    // OAuth actions
    const connectOAuth = (provider: string) => {
        window.location.href = `${API_URL}/oauth/${provider}`;
    };

    const disconnectOAuth = async (provider: string) => {
        if (!confirm(`Disconnect ${provider}?`)) return;

        try {
            await fetch(`${API_URL}/v1/settings/oauth/${provider}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            showMessage('success', `${provider} disconnected`);
            loadSettings();
        } catch (err) {
            showMessage('error', `Failed to disconnect ${provider}`);
        }
    };

    // Danger zone actions
    const deleteAccount = async () => {
        const confirmation = prompt('Type "DELETE" to permanently delete your account:');
        if (confirmation !== 'DELETE') return;

        try {
            const res = await fetch(`${API_URL}/v1/auth/account`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            } else {
                showMessage('error', 'Failed to delete account');
            }
        } catch (err) {
            showMessage('error', 'Failed to delete account');
        }
    };

    const exportData = async () => {
        try {
            const res = await fetch(`${API_URL}/v1/auth/export`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'bombardier-data-export.json';
                a.click();
                showMessage('success', 'Data exported');
            } else {
                showMessage('error', 'Failed to export data');
            }
        } catch (err) {
            showMessage('error', 'Failed to export data');
        }
    };

    // Render tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'account':
                return (
                    <div className={styles.tabContent}>
                        <h2>Account Settings</h2>
                        <div className={styles.formGroup}>
                            <label>First Name</label>
                            <input
                                type="text"
                                value={accountForm.firstName}
                                onChange={(e) => setAccountForm({ ...accountForm, firstName: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Last Name</label>
                            <input
                                type="text"
                                value={accountForm.lastName}
                                onChange={(e) => setAccountForm({ ...accountForm, lastName: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Email</label>
                            <input type="email" value={accountForm.email} disabled />
                            <span className={styles.hint}>Contact support to change email</span>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Username</label>
                            <input type="text" value={accountForm.username} disabled />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Role</label>
                            <input type="text" value={user?.role || 'user'} disabled />
                        </div>
                        <button className={styles.primaryButton} onClick={saveAccountSettings} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                );

            case 'security':
                return (
                    <div className={styles.tabContent}>
                        <h2>Security</h2>
                        <h3>Change Password</h3>
                        <div className={styles.formGroup}>
                            <label>Current Password</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>New Password</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            />
                        </div>
                        <button className={styles.primaryButton} onClick={changePassword} disabled={saving}>
                            {saving ? 'Changing...' : 'Change Password'}
                        </button>

                        <hr className={styles.divider} />

                        <h3>Two-Factor Authentication</h3>
                        <p className={styles.hint}>2FA adds an extra layer of security to your account.</p>
                        <button className={styles.secondaryButton}>Enable 2FA</button>

                        <hr className={styles.divider} />

                        <h3>Active Sessions</h3>
                        <div className={styles.sessionList}>
                            <div className={styles.sessionItem}>
                                <span>Current session</span>
                                <span className={styles.badge}>Active</span>
                            </div>
                        </div>
                        <button className={styles.dangerButton}>Sign Out All Other Sessions</button>
                    </div>
                );

            case 'oauth':
                return (
                    <div className={styles.tabContent}>
                        <h2>OAuth Connections</h2>
                        <p className={styles.hint}>Connect third-party accounts for quick login.</p>
                        <div className={styles.oauthList}>
                            {oauthConnections.map((conn) => (
                                <div key={conn.provider} className={styles.oauthItem}>
                                    <div className={styles.oauthInfo}>
                                        <span className={styles.oauthProvider}>
                                            {conn.provider.charAt(0).toUpperCase() + conn.provider.slice(1)}
                                        </span>
                                        {conn.connected && (
                                            <span className={styles.oauthEmail}>{conn.email}</span>
                                        )}
                                    </div>
                                    {conn.connected ? (
                                        <button
                                            className={styles.dangerButton}
                                            onClick={() => disconnectOAuth(conn.provider)}
                                        >
                                            Disconnect
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.primaryButton}
                                            onClick={() => connectOAuth(conn.provider)}
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'apikeys':
                return (
                    <div className={styles.tabContent}>
                        <h2>API Keys</h2>
                        <p className={styles.hint}>Manage API keys for programmatic access.</p>

                        <div className={styles.createForm}>
                            <h3>Create New API Key</h3>
                            <div className={styles.inlineForm}>
                                <input
                                    type="text"
                                    placeholder="Key name (e.g., Production)"
                                    value={newApiKeyForm.name}
                                    onChange={(e) => setNewApiKeyForm({ ...newApiKeyForm, name: e.target.value })}
                                />
                                <button className={styles.primaryButton} onClick={createApiKey} disabled={saving}>
                                    Create
                                </button>
                            </div>
                        </div>

                        <div className={styles.keyList}>
                            {apiKeys.length === 0 ? (
                                <p className={styles.emptyState}>No API keys yet</p>
                            ) : (
                                apiKeys.map((key) => (
                                    <div key={key.id} className={styles.keyItem}>
                                        <div className={styles.keyInfo}>
                                            <span className={styles.keyName}>{key.name}</span>
                                            <code className={styles.keyPreview}>{key.keyPreview}...</code>
                                            <span className={styles.keyMeta}>
                                                Created: {new Date(key.createdAt).toLocaleDateString()}
                                                {key.lastUsed && ` | Last used: ${new Date(key.lastUsed).toLocaleDateString()}`}
                                            </span>
                                        </div>
                                        <button
                                            className={styles.dangerButton}
                                            onClick={() => deleteApiKey(key.id)}
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );

            case 'cloak':
                return (
                    <div className={styles.tabContent}>
                        <h2>Cloak Settings</h2>
                        <p className={styles.hint}>Configure anti-detection and stealth features.</p>

                        <div className={styles.toggleList}>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Fingerprint Randomization</span>
                                    <span className={styles.toggleHint}>Randomize browser fingerprint per session</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={cloakSettings.fingerprintEnabled}
                                        onChange={(e) => setCloakSettings({ ...cloakSettings, fingerprintEnabled: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Proxy Rotation</span>
                                    <span className={styles.toggleHint}>Automatically rotate proxies</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={cloakSettings.proxyRotation}
                                        onChange={(e) => setCloakSettings({ ...cloakSettings, proxyRotation: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Stealth Mode</span>
                                    <span className={styles.toggleHint}>Enable Playwright stealth plugins</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={cloakSettings.stealthMode}
                                        onChange={(e) => setCloakSettings({ ...cloakSettings, stealthMode: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Human Simulation</span>
                                    <span className={styles.toggleHint}>Simulate human behavior patterns</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={cloakSettings.humanSimulation}
                                        onChange={(e) => setCloakSettings({ ...cloakSettings, humanSimulation: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Session Persistence</span>
                                    <span className={styles.toggleHint}>Maintain cookies across sessions</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={cloakSettings.sessionPersistence}
                                        onChange={(e) => setCloakSettings({ ...cloakSettings, sessionPersistence: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>

                        <button className={styles.primaryButton}>Save Cloak Settings</button>
                    </div>
                );

            case 'proxies':
                return (
                    <div className={styles.tabContent}>
                        <h2>Proxy Management</h2>
                        <p className={styles.hint}>Configure proxy servers for acquisition workers.</p>

                        <div className={styles.createForm}>
                            <h3>Add Proxy</h3>
                            <div className={styles.proxyForm}>
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newProxyForm.name}
                                    onChange={(e) => setNewProxyForm({ ...newProxyForm, name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Host"
                                    value={newProxyForm.host}
                                    onChange={(e) => setNewProxyForm({ ...newProxyForm, host: e.target.value })}
                                />
                                <input
                                    type="number"
                                    placeholder="Port"
                                    value={newProxyForm.port}
                                    onChange={(e) => setNewProxyForm({ ...newProxyForm, port: parseInt(e.target.value) })}
                                />
                                <select
                                    value={newProxyForm.type}
                                    onChange={(e) => setNewProxyForm({ ...newProxyForm, type: e.target.value as any })}
                                >
                                    <option value="http">HTTP</option>
                                    <option value="socks5">SOCKS5</option>
                                    <option value="residential">Residential</option>
                                </select>
                                <button className={styles.primaryButton}>Add</button>
                            </div>
                        </div>

                        <div className={styles.proxyList}>
                            {proxies.length === 0 ? (
                                <p className={styles.emptyState}>No proxies configured</p>
                            ) : (
                                proxies.map((proxy) => (
                                    <div key={proxy.id} className={styles.proxyItem}>
                                        <div className={styles.proxyInfo}>
                                            <span className={styles.proxyName}>{proxy.name}</span>
                                            <span className={styles.proxyHost}>{proxy.host}:{proxy.port}</span>
                                            <span className={`${styles.proxyBadge} ${styles[proxy.type]}`}>
                                                {proxy.type}
                                            </span>
                                            {proxy.latency && (
                                                <span className={styles.proxyLatency}>{proxy.latency}ms</span>
                                            )}
                                        </div>
                                        <div className={styles.proxyActions}>
                                            <button className={styles.secondaryButton}>Test</button>
                                            <button className={styles.dangerButton}>Remove</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );

            case 'workers':
                return (
                    <div className={styles.tabContent}>
                        <h2>Worker Settings</h2>
                        <p className={styles.hint}>Configure background worker behavior.</p>

                        <div className={styles.toggleList}>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Acquisition Worker</span>
                                    <span className={styles.toggleHint}>Collect profiles from platforms</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={workerSettings.acquisitionEnabled}
                                        onChange={(e) => setWorkerSettings({ ...workerSettings, acquisitionEnabled: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Filtering Worker</span>
                                    <span className={styles.toggleHint}>AI-powered profile filtering</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={workerSettings.filteringEnabled}
                                        onChange={(e) => setWorkerSettings({ ...workerSettings, filteringEnabled: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Engagement Worker</span>
                                    <span className={styles.toggleHint}>Send messages to profiles</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={workerSettings.engagementEnabled}
                                        onChange={(e) => setWorkerSettings({ ...workerSettings, engagementEnabled: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Tracking Worker</span>
                                    <span className={styles.toggleHint}>Monitor responses and status</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={workerSettings.trackingEnabled}
                                        onChange={(e) => setWorkerSettings({ ...workerSettings, trackingEnabled: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>

                        <hr className={styles.divider} />

                        <div className={styles.formGroup}>
                            <label>Max Concurrent Jobs</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={workerSettings.maxConcurrentJobs}
                                onChange={(e) => setWorkerSettings({ ...workerSettings, maxConcurrentJobs: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Retry Attempts</label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                value={workerSettings.retryAttempts}
                                onChange={(e) => setWorkerSettings({ ...workerSettings, retryAttempts: parseInt(e.target.value) })}
                            />
                        </div>

                        <button className={styles.primaryButton}>Save Worker Settings</button>
                    </div>
                );

            case 'display':
                return (
                    <div className={styles.tabContent}>
                        <h2>Display Settings</h2>

                        <div className={styles.formGroup}>
                            <label>Theme</label>
                            <select
                                value={displaySettings.theme}
                                onChange={(e) => setDisplaySettings({ ...displaySettings, theme: e.target.value })}
                            >
                                <option value="dark">Dark (Neon Command)</option>
                                <option value="light">Light</option>
                                <option value="system">System</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Profiles Per Page</label>
                            <select
                                value={displaySettings.profilesPerPage}
                                onChange={(e) => setDisplaySettings({ ...displaySettings, profilesPerPage: parseInt(e.target.value) })}
                            >
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>

                        <div className={styles.toggleList}>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Show Bot Scores</span>
                                    <span className={styles.toggleHint}>Display bot detection scores on profiles</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={displaySettings.showBotScores}
                                        onChange={(e) => setDisplaySettings({ ...displaySettings, showBotScores: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Compact Mode</span>
                                    <span className={styles.toggleHint}>Reduce spacing for more content</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={displaySettings.compactMode}
                                        onChange={(e) => setDisplaySettings({ ...displaySettings, compactMode: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleItem}>
                                <div>
                                    <span className={styles.toggleLabel}>Auto Refresh</span>
                                    <span className={styles.toggleHint}>Automatically refresh data</span>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={displaySettings.autoRefresh}
                                        onChange={(e) => setDisplaySettings({ ...displaySettings, autoRefresh: e.target.checked })}
                                    />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>

                        {displaySettings.autoRefresh && (
                            <div className={styles.formGroup}>
                                <label>Refresh Interval (seconds)</label>
                                <input
                                    type="number"
                                    min="10"
                                    max="300"
                                    value={displaySettings.refreshInterval}
                                    onChange={(e) => setDisplaySettings({ ...displaySettings, refreshInterval: parseInt(e.target.value) })}
                                />
                            </div>
                        )}

                        <button className={styles.primaryButton}>Save Display Settings</button>
                    </div>
                );

            case 'webhooks':
                return (
                    <div className={styles.tabContent}>
                        <h2>Webhooks</h2>
                        <p className={styles.hint}>Receive real-time notifications for events.</p>

                        <div className={styles.createForm}>
                            <h3>Create Webhook</h3>
                            <div className={styles.webhookForm}>
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newWebhookForm.name}
                                    onChange={(e) => setNewWebhookForm({ ...newWebhookForm, name: e.target.value })}
                                />
                                <input
                                    type="url"
                                    placeholder="https://your-server.com/webhook"
                                    value={newWebhookForm.url}
                                    onChange={(e) => setNewWebhookForm({ ...newWebhookForm, url: e.target.value })}
                                />
                                <button className={styles.primaryButton} onClick={createWebhook} disabled={saving}>
                                    Create
                                </button>
                            </div>
                            <div className={styles.eventSelector}>
                                <span>Events:</span>
                                {['profile.created', 'profile.approved', 'message.sent', 'message.response', 'campaign.completed'].map((event) => (
                                    <label key={event} className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={newWebhookForm.events.includes(event)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewWebhookForm({ ...newWebhookForm, events: [...newWebhookForm.events, event] });
                                                } else {
                                                    setNewWebhookForm({ ...newWebhookForm, events: newWebhookForm.events.filter(ev => ev !== event) });
                                                }
                                            }}
                                        />
                                        {event}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={styles.webhookList}>
                            {webhooks.length === 0 ? (
                                <p className={styles.emptyState}>No webhooks configured</p>
                            ) : (
                                webhooks.map((webhook) => (
                                    <div key={webhook.id} className={styles.webhookItem}>
                                        <div className={styles.webhookInfo}>
                                            <span className={styles.webhookName}>{webhook.name}</span>
                                            <span className={styles.webhookUrl}>{webhook.url}</span>
                                            <div className={styles.webhookEvents}>
                                                {webhook.events.map((event) => (
                                                    <span key={event} className={styles.eventBadge}>{event}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={styles.webhookActions}>
                                            <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={webhook.enabled}
                                                    onChange={(e) => toggleWebhook(webhook.id, e.target.checked)}
                                                />
                                                <span className={styles.slider}></span>
                                            </label>
                                            <button className={styles.secondaryButton}>Test</button>
                                            <button
                                                className={styles.dangerButton}
                                                onClick={() => deleteWebhook(webhook.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );

            case 'danger':
                return (
                    <div className={styles.tabContent}>
                        <h2 className={styles.dangerTitle}>⚠️ Danger Zone</h2>
                        <p className={styles.dangerHint}>These actions are irreversible. Proceed with caution.</p>

                        <div className={styles.dangerSection}>
                            <h3>Export Data</h3>
                            <p>Download all your data including profiles, campaigns, and messages.</p>
                            <button className={styles.secondaryButton} onClick={exportData}>
                                Export All Data
                            </button>
                        </div>

                        <div className={styles.dangerSection}>
                            <h3>Delete All Campaigns</h3>
                            <p>Permanently delete all campaigns and associated data.</p>
                            <button className={styles.dangerButton}>Delete All Campaigns</button>
                        </div>

                        <div className={styles.dangerSection}>
                            <h3>Delete Account</h3>
                            <p>Permanently delete your account and all associated data. This cannot be undone.</p>
                            <button className={styles.dangerButton} onClick={deleteAccount}>
                                Delete My Account
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading settings...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Settings</h1>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            <div className={styles.layout}>
                <nav className={styles.sidebar}>
                    {[
                        { id: 'account', label: 'Account', icon: '👤' },
                        { id: 'security', label: 'Security', icon: '🔒' },
                        { id: 'oauth', label: 'OAuth', icon: '🔗' },
                        { id: 'apikeys', label: 'API Keys', icon: '🔑' },
                        { id: 'cloak', label: 'Cloak', icon: '🎭' },
                        { id: 'proxies', label: 'Proxies', icon: '🌐' },
                        { id: 'workers', label: 'Workers', icon: '⚙️' },
                        { id: 'display', label: 'Display', icon: '🎨' },
                        { id: 'webhooks', label: 'Webhooks', icon: '🪝' },
                        { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''} ${tab.id === 'danger' ? styles.dangerNav : ''}`}
                            onClick={() => setActiveTab(tab.id as SettingsTab)}
                        >
                            <span className={styles.navIcon}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <main className={styles.content}>
                    {renderTabContent()}
                </main>
            </div>
        </div>
    );
}
