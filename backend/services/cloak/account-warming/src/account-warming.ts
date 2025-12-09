/**
 * Account Warming Protocol
 * Gradual automation ramp-up to avoid immediate detection
 */

import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type WarmingPhase = 'manual' | 'light' | 'moderate' | 'full';
export type AccountStatus = 'new' | 'warming' | 'warmed' | 'flagged' | 'banned';

export interface AccountConfig {
    id: string;
    platform: string;
    username: string;
    createdAt: Date;
    status: AccountStatus;
    currentPhase: WarmingPhase;
    phaseStartedAt: Date;
    activityLog: ActivityRecord[];
    limits: AccountLimits;
}

export interface ActivityRecord {
    type: 'browse' | 'like' | 'follow' | 'comment' | 'message' | 'profile_view';
    timestamp: Date;
    automated: boolean;
}

export interface AccountLimits {
    maxActionsPerDay: number;
    maxMessagesPerDay: number;
    maxFollowsPerDay: number;
    maxLikesPerDay: number;
}

export interface WarmingSchedule {
    phase: WarmingPhase;
    durationDays: number;
    limits: AccountLimits;
    allowedActions: string[];
    automationLevel: number; // 0-1, percentage of automated actions
}

const DEFAULT_WARMING_SCHEDULE: WarmingSchedule[] = [
    {
        phase: 'manual',
        durationDays: 14,
        limits: {
            maxActionsPerDay: 20,
            maxMessagesPerDay: 0,
            maxFollowsPerDay: 5,
            maxLikesPerDay: 15,
        },
        allowedActions: ['browse', 'like', 'follow', 'profile_view'],
        automationLevel: 0.0, // 100% manual
    },
    {
        phase: 'light',
        durationDays: 14,
        limits: {
            maxActionsPerDay: 40,
            maxMessagesPerDay: 2,
            maxFollowsPerDay: 10,
            maxLikesPerDay: 25,
        },
        allowedActions: ['browse', 'like', 'follow', 'profile_view', 'comment'],
        automationLevel: 0.3, // 30% automated
    },
    {
        phase: 'moderate',
        durationDays: 14,
        limits: {
            maxActionsPerDay: 60,
            maxMessagesPerDay: 5,
            maxFollowsPerDay: 15,
            maxLikesPerDay: 35,
        },
        allowedActions: ['browse', 'like', 'follow', 'profile_view', 'comment', 'message'],
        automationLevel: 0.6, // 60% automated
    },
    {
        phase: 'full',
        durationDays: Infinity,
        limits: {
            maxActionsPerDay: 100,
            maxMessagesPerDay: 20,
            maxFollowsPerDay: 25,
            maxLikesPerDay: 50,
        },
        allowedActions: ['browse', 'like', 'follow', 'profile_view', 'comment', 'message'],
        automationLevel: 1.0, // 100% automated
    },
];

export class AccountWarmingManager {
    private redis: Redis;
    private warmingSchedule: WarmingSchedule[];

    constructor(redisUrl: string, customSchedule?: WarmingSchedule[]) {
        this.redis = new Redis(redisUrl);
        this.warmingSchedule = customSchedule || DEFAULT_WARMING_SCHEDULE;
    }

    /**
     * Register a new account for warming
     */
    async registerAccount(platform: string, username: string): Promise<AccountConfig> {
        const accountId = `${platform}:${username}`;
        const firstPhase = this.warmingSchedule[0];

        const account: AccountConfig = {
            id: accountId,
            platform,
            username,
            createdAt: new Date(),
            status: 'new',
            currentPhase: firstPhase.phase,
            phaseStartedAt: new Date(),
            activityLog: [],
            limits: firstPhase.limits,
        };

        await this.saveAccount(account);

        logger.info(
            {
                accountId,
                phase: account.currentPhase,
                limits: account.limits,
            },
            'Account registered for warming'
        );

        return account;
    }

    /**
     * Check if account can perform an action
     */
    async canPerformAction(
        accountId: string,
        actionType: string,
        automated: boolean = true
    ): Promise<{ allowed: boolean; reason?: string }> {
        const account = await this.getAccount(accountId);
        if (!account) {
            return { allowed: false, reason: 'Account not found' };
        }

        // Check if account is flagged or banned
        if (account.status === 'flagged' || account.status === 'banned') {
            return { allowed: false, reason: `Account status: ${account.status}` };
        }

        // Get current phase schedule
        const phaseSchedule = this.warmingSchedule.find((s) => s.phase === account.currentPhase);
        if (!phaseSchedule) {
            return { allowed: false, reason: 'Invalid warming phase' };
        }

        // Check if action is allowed in current phase
        if (!phaseSchedule.allowedActions.includes(actionType)) {
            return {
                allowed: false,
                reason: `Action '${actionType}' not allowed in ${account.currentPhase} phase`,
            };
        }

        // Check automation level
        if (automated) {
            const recentAutomatedActions = this.getRecentActions(account, 24).filter((a) => a.automated).length;
            const recentTotalActions = this.getRecentActions(account, 24).length;
            const currentAutomationLevel =
                recentTotalActions > 0 ? recentAutomatedActions / recentTotalActions : 0;

            if (currentAutomationLevel >= phaseSchedule.automationLevel) {
                return {
                    allowed: false,
                    reason: `Automation level limit reached (${Math.round(phaseSchedule.automationLevel * 100)}%)`,
                };
            }
        }

        // Check daily limits
        const todayActions = this.getRecentActions(account, 24);
        const todayCount = todayActions.length;

        if (todayCount >= phaseSchedule.limits.maxActionsPerDay) {
            return { allowed: false, reason: 'Daily action limit reached' };
        }

        // Check specific action limits
        const todayActionCount = todayActions.filter((a) => a.type === actionType).length;

        switch (actionType) {
            case 'message':
                if (todayActionCount >= phaseSchedule.limits.maxMessagesPerDay) {
                    return { allowed: false, reason: 'Daily message limit reached' };
                }
                break;
            case 'follow':
                if (todayActionCount >= phaseSchedule.limits.maxFollowsPerDay) {
                    return { allowed: false, reason: 'Daily follow limit reached' };
                }
                break;
            case 'like':
                if (todayActionCount >= phaseSchedule.limits.maxLikesPerDay) {
                    return { allowed: false, reason: 'Daily like limit reached' };
                }
                break;
        }

        return { allowed: true };
    }

    /**
     * Record an action
     */
    async recordAction(accountId: string, actionType: string, automated: boolean = true): Promise<void> {
        const account = await this.getAccount(accountId);
        if (!account) {
            logger.warn({ accountId }, 'Attempted to record action for unknown account');
            return;
        }

        const activity: ActivityRecord = {
            type: actionType as any,
            timestamp: new Date(),
            automated,
        };

        account.activityLog.push(activity);

        // Keep only last 1000 activities
        if (account.activityLog.length > 1000) {
            account.activityLog = account.activityLog.slice(-1000);
        }

        // Update status to warming if still new
        if (account.status === 'new') {
            account.status = 'warming';
        }

        await this.saveAccount(account);

        logger.debug(
            {
                accountId,
                actionType,
                automated,
                phase: account.currentPhase,
            },
            'Action recorded'
        );
    }

    /**
     * Check and advance warming phase if ready
     */
    async checkPhaseAdvancement(accountId: string): Promise<boolean> {
        const account = await this.getAccount(accountId);
        if (!account) return false;

        const currentPhaseSchedule = this.warmingSchedule.find((s) => s.phase === account.currentPhase);
        if (!currentPhaseSchedule) return false;

        // Calculate days in current phase
        const daysInPhase = (Date.now() - account.phaseStartedAt.getTime()) / (1000 * 60 * 60 * 24);

        // Check if ready to advance
        if (daysInPhase >= currentPhaseSchedule.durationDays) {
            const currentIndex = this.warmingSchedule.findIndex((s) => s.phase === account.currentPhase);
            const nextPhase = this.warmingSchedule[currentIndex + 1];

            if (nextPhase) {
                account.currentPhase = nextPhase.phase;
                account.phaseStartedAt = new Date();
                account.limits = nextPhase.limits;

                if (nextPhase.phase === 'full') {
                    account.status = 'warmed';
                }

                await this.saveAccount(account);

                logger.info(
                    {
                        accountId,
                        oldPhase: currentPhaseSchedule.phase,
                        newPhase: nextPhase.phase,
                        newLimits: nextPhase.limits,
                    },
                    'Account advanced to next warming phase'
                );

                return true;
            }
        }

        return false;
    }

    /**
     * Mark account as flagged
     */
    async markFlagged(accountId: string, reason: string): Promise<void> {
        const account = await this.getAccount(accountId);
        if (!account) return;

        account.status = 'flagged';
        await this.saveAccount(account);

        logger.warn({ accountId, reason }, 'Account marked as flagged');
    }

    /**
     * Get account status summary
     */
    async getAccountStatus(accountId: string): Promise<{
        account: AccountConfig | null;
        daysInPhase: number;
        daysUntilNextPhase: number;
        todayActions: number;
        automationLevel: number;
    } | null> {
        const account = await this.getAccount(accountId);
        if (!account) return null;

        const currentPhaseSchedule = this.warmingSchedule.find((s) => s.phase === account.currentPhase);
        if (!currentPhaseSchedule) return null;

        const daysInPhase = (Date.now() - account.phaseStartedAt.getTime()) / (1000 * 60 * 60 * 24);
        const daysUntilNextPhase = Math.max(0, currentPhaseSchedule.durationDays - daysInPhase);

        const recentActions = this.getRecentActions(account, 24);
        const automatedActions = recentActions.filter((a) => a.automated).length;
        const automationLevel = recentActions.length > 0 ? automatedActions / recentActions.length : 0;

        return {
            account,
            daysInPhase,
            daysUntilNextPhase,
            todayActions: recentActions.length,
            automationLevel,
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private async getAccount(accountId: string): Promise<AccountConfig | null> {
        const key = `account:warming:${accountId}`;
        const data = await this.redis.get(key);

        if (!data) return null;

        try {
            const account = JSON.parse(data);
            // Parse dates
            account.createdAt = new Date(account.createdAt);
            account.phaseStartedAt = new Date(account.phaseStartedAt);
            account.activityLog = account.activityLog.map((a: any) => ({
                ...a,
                timestamp: new Date(a.timestamp),
            }));
            return account;
        } catch (err) {
            logger.error({ err, accountId }, 'Failed to parse account data');
            return null;
        }
    }

    private async saveAccount(account: AccountConfig): Promise<void> {
        const key = `account:warming:${account.id}`;
        await this.redis.set(key, JSON.stringify(account), 'EX', 86400 * 365); // 1 year
    }

    private getRecentActions(account: AccountConfig, hours: number): ActivityRecord[] {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return account.activityLog.filter((a) => a.timestamp.getTime() >= cutoff);
    }

    async cleanup(): Promise<void> {
        await this.redis.quit();
    }
}
