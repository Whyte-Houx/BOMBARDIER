/**
 * Human Timing Engine
 * Implements circadian rhythm modeling, Poisson distribution delays,
 * and behavioral pacing to mimic human activity patterns
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface UserProfile {
    timezone: string;
    averageActionInterval: number; // milliseconds
    activityPattern: 'morning' | 'afternoon' | 'evening' | 'night' | 'mixed';
    weekendBehavior: 'active' | 'inactive' | 'similar';
}

export interface Action {
    type: string;
    timestamp: Date;
    duration: number;
}

export interface TimingContext {
    currentTime: Date;
    actionHistory: Action[];
    userProfile: UserProfile;
    sessionStartTime: Date;
}

export class HumanTimingEngine {
    /**
     * Calculate next action delay with human-like variance
     */
    calculateNextActionDelay(context: TimingContext): number {
        // Base delay from Poisson distribution
        const baseDelay = this.poissonSample(context.userProfile.averageActionInterval);

        // Apply circadian rhythm modifier
        const circadianModifier = this.getActivityLevel(context.currentTime, context.userProfile);

        // Apply session fatigue factor
        const fatigueFactor = this.calculateSessionFatigue(context.actionHistory, context.sessionStartTime);

        // Apply weekend modifier
        const weekendModifier = this.getWeekendModifier(context.currentTime, context.userProfile);

        // Combine all factors
        const finalDelay = baseDelay * circadianModifier * fatigueFactor * weekendModifier;

        // Add small random jitter (±10%)
        const jitter = 0.9 + Math.random() * 0.2;

        const result = Math.max(1000, finalDelay * jitter); // Minimum 1 second

        logger.debug(
            {
                baseDelay,
                circadianModifier,
                fatigueFactor,
                weekendModifier,
                finalDelay: result,
            },
            'Calculated next action delay'
        );

        return result;
    }

    /**
     * Generate action cluster timing (batch similar actions)
     */
    generateActionCluster(actionCount: number, baseInterval: number): number[] {
        const delays: number[] = [];

        for (let i = 0; i < actionCount; i++) {
            if (i === 0) {
                // First action: normal delay
                delays.push(this.poissonSample(baseInterval));
            } else {
                // Subsequent actions: shorter delays (rapid succession)
                const clusterDelay = this.poissonSample(baseInterval * 0.3); // 30% of normal
                delays.push(clusterDelay);
            }

            // Occasionally add a longer pause within cluster
            if (Math.random() < 0.2 && i < actionCount - 1) {
                delays.push(this.poissonSample(baseInterval * 2)); // Thinking pause
            }
        }

        return delays;
    }

    /**
     * Determine if it's a good time to perform actions
     */
    isGoodTimeForActivity(currentTime: Date, userProfile: UserProfile): boolean {
        const hour = this.getHourInTimezone(currentTime, userProfile.timezone);

        // Sleep hours (2 AM - 7 AM)
        if (hour >= 2 && hour < 7) {
            return false;
        }

        // Check activity pattern preference
        switch (userProfile.activityPattern) {
            case 'morning':
                return hour >= 7 && hour < 12;
            case 'afternoon':
                return hour >= 12 && hour < 18;
            case 'evening':
                return hour >= 18 && hour < 23;
            case 'night':
                return hour >= 23 || hour < 2;
            case 'mixed':
            default:
                return hour >= 7 && hour < 23; // General active hours
        }
    }

    /**
     * Calculate optimal wait time until next activity window
     */
    calculateWaitUntilActiveHours(currentTime: Date, userProfile: UserProfile): number {
        const hour = this.getHourInTimezone(currentTime, userProfile.timezone);

        // If in sleep hours, wait until 7 AM
        if (hour >= 2 && hour < 7) {
            const hoursUntil7AM = 7 - hour;
            return hoursUntil7AM * 60 * 60 * 1000;
        }

        // If late night (23-2), wait until morning
        if (hour >= 23 || hour < 2) {
            const hoursUntilMorning = hour >= 23 ? 7 + (24 - hour) : 7 - hour;
            return hoursUntilMorning * 60 * 60 * 1000;
        }

        return 0; // Currently in active hours
    }

    /**
     * Generate realistic typing delays for a text string
     */
    generateTypingDelays(text: string, wpm: number, errorRate: number): number[] {
        const delays: number[] = [];
        const avgCharDelay = (60 * 1000) / (wpm * 5); // Average delay per character

        for (let i = 0; i < text.length; i++) {
            // Base delay with variance
            let delay = avgCharDelay * (0.8 + Math.random() * 0.4);

            // Longer delay after punctuation (thinking)
            if (i > 0 && /[.!?,;:]/.test(text[i - 1])) {
                delay *= 2 + Math.random() * 2; // 2-4x longer
            }

            // Longer delay after spaces (word boundaries)
            if (i > 0 && text[i - 1] === ' ') {
                delay *= 1.5 + Math.random();
            }

            // Simulate typing errors (backspace + retype)
            if (Math.random() < errorRate) {
                delays.push(delay);
                delays.push(avgCharDelay * 0.5); // Quick backspace
                delays.push(avgCharDelay * 1.2); // Retype
                continue;
            }

            delays.push(delay);
        }

        return delays;
    }

    /**
     * Generate realistic mouse movement path
     */
    generateMousePath(
        from: { x: number; y: number },
        to: { x: number; y: number },
        style: 'smooth' | 'jittery' | 'precise'
    ): Array<{ x: number; y: number; delay: number }> {
        const path: Array<{ x: number; y: number; delay: number }> = [];
        const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const steps = Math.max(10, Math.floor(distance / 20)); // One step per 20 pixels

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Bezier curve for natural movement
            const controlX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 100;
            const controlY = (from.y + to.y) / 2 + (Math.random() - 0.5) * 100;

            const x = Math.pow(1 - t, 2) * from.x + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * to.x;
            const y = Math.pow(1 - t, 2) * from.y + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * to.y;

            // Add jitter based on style
            let jitterX = 0;
            let jitterY = 0;

            switch (style) {
                case 'jittery':
                    jitterX = (Math.random() - 0.5) * 5;
                    jitterY = (Math.random() - 0.5) * 5;
                    break;
                case 'precise':
                    jitterX = (Math.random() - 0.5) * 1;
                    jitterY = (Math.random() - 0.5) * 1;
                    break;
                case 'smooth':
                default:
                    jitterX = (Math.random() - 0.5) * 2;
                    jitterY = (Math.random() - 0.5) * 2;
                    break;
            }

            path.push({
                x: x + jitterX,
                y: y + jitterY,
                delay: 10 + Math.random() * 20, // 10-30ms between points
            });
        }

        return path;
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Sample from Poisson distribution
     */
    private poissonSample(lambda: number): number {
        // Using inverse transform sampling
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;

        do {
            k++;
            p *= Math.random();
        } while (p > L);

        return (k - 1) * lambda;
    }

    /**
     * Get activity level based on time of day (circadian rhythm)
     */
    private getActivityLevel(currentTime: Date, userProfile: UserProfile): number {
        const hour = this.getHourInTimezone(currentTime, userProfile.timezone);

        // Activity curve throughout the day
        // Low at night, peak during work hours
        const activityCurve: Record<number, number> = {
            0: 0.1, 1: 0.05, 2: 0.02, 3: 0.02, 4: 0.02, 5: 0.05,
            6: 0.2, 7: 0.5, 8: 0.8, 9: 1.0, 10: 1.0, 11: 0.9,
            12: 0.7, 13: 0.8, 14: 0.9, 15: 1.0, 16: 0.9, 17: 0.8,
            18: 0.7, 19: 0.6, 20: 0.5, 21: 0.4, 22: 0.3, 23: 0.2,
        };

        const baseActivity = activityCurve[hour] || 0.5;

        // Adjust based on user's activity pattern
        let modifier = 1.0;
        switch (userProfile.activityPattern) {
            case 'morning':
                modifier = hour >= 7 && hour < 12 ? 1.5 : 0.7;
                break;
            case 'afternoon':
                modifier = hour >= 12 && hour < 18 ? 1.5 : 0.7;
                break;
            case 'evening':
                modifier = hour >= 18 && hour < 23 ? 1.5 : 0.7;
                break;
            case 'night':
                modifier = hour >= 23 || hour < 2 ? 1.5 : 0.7;
                break;
        }

        // Inverse relationship: lower activity = longer delays
        return 1 / (baseActivity * modifier);
    }

    /**
     * Calculate session fatigue (longer sessions = slower actions)
     */
    private calculateSessionFatigue(actionHistory: Action[], sessionStartTime: Date): number {
        const sessionDuration = Date.now() - sessionStartTime.getTime();
        const sessionMinutes = sessionDuration / (60 * 1000);

        // Fatigue increases after 30 minutes
        if (sessionMinutes < 30) {
            return 1.0;
        }

        // Gradual slowdown: 1.0 -> 1.5 over 2 hours
        const fatigueIncrease = Math.min(0.5, (sessionMinutes - 30) / 120);
        return 1.0 + fatigueIncrease;
    }

    /**
     * Get weekend modifier
     */
    private getWeekendModifier(currentTime: Date, userProfile: UserProfile): number {
        const day = currentTime.getDay(); // 0 = Sunday, 6 = Saturday

        const isWeekend = day === 0 || day === 6;

        if (!isWeekend) {
            return 1.0;
        }

        switch (userProfile.weekendBehavior) {
            case 'active':
                return 0.8; // Faster on weekends
            case 'inactive':
                return 1.5; // Slower on weekends
            case 'similar':
            default:
                return 1.0;
        }
    }

    /**
     * Get hour in user's timezone
     */
    private getHourInTimezone(date: Date, timezone: string): number {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                hour12: false,
            });
            const parts = formatter.formatToParts(date);
            const hourPart = parts.find((p) => p.type === 'hour');
            return hourPart ? parseInt(hourPart.value, 10) : date.getHours();
        } catch (err) {
            // Fallback to UTC
            return date.getUTCHours();
        }
    }
}
