
import { BombingMethod, MissionConfig } from './types.js';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'mission-control' });

export class MissionOrchestrator {
    private redis: Redis;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.redis.on('error', (err: Error) => logger.error('Redis Client Error', err));
    }

    async connect(): Promise<void> {
        // ioredis auto-connects, just wait for ready
        if (this.redis.status === 'ready') return;
        return new Promise((resolve, reject) => {
            this.redis.once('ready', resolve);
            this.redis.once('error', reject);
        });
    }

    async startMission(config: MissionConfig) {
        logger.info(`Starting mission ${config.campaignId} with method ${config.method}`);

        const workflow = this.buildWorkflow(config.method);

        if (workflow.length === 0) {
            throw new Error(`Invalid workflow for method ${config.method}`);
        }

        const firstStep = workflow[0];
        const initialPayload = {
            campaignId: config.campaignId,
            criteria: config.targetCriteria,
            workflow: workflow, // Pass the entire workflow
            currentStepIndex: 0,
            cloakConfig: config.cloakConfig
        };

        // Push to the first queue
        await this.redis.rpush(`queue:${firstStep}`, JSON.stringify(initialPayload));
        logger.info(`Mission started. Dispatched to queue:${firstStep}`);
    }

    private buildWorkflow(method: BombingMethod): string[] {
        switch (method) {
            case BombingMethod.DR:
                // DR: acquisition -> filtering -> research -> engagement -> tracking
                return ['acquisition', 'filtering', 'research', 'engagement', 'tracking'];

            case BombingMethod.IVM:
                // IVM: acquisition -> research -> filtering -> (optional engagement)
                // For now, let's assume filtering is the end of the required chain, 
                // and engagement might be triggered manually or via specific criteria later.
                // Or we can include it. User said "working together with the rest services optional".
                return ['acquisition', 'research', 'filtering'];

            default:
                return [];
        }
    }
}
