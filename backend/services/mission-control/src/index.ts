
import { MissionOrchestrator } from './orchestrator.js';
import { createClient } from 'redis';
import pino from 'pino';

const logger = pino({ name: 'mission-control-service' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
    logger.info('Starting Mission Control Service...');

    const orchestrator = new MissionOrchestrator(REDIS_URL);
    await orchestrator.connect();

    const redis = createClient({ url: REDIS_URL });
    await redis.connect();

    logger.info('Mission Control Service Ready. Listening on queue:mission-control:start');

    while (true) {
        try {
            // Blocking pop
            const result = await redis.blPop('queue:mission-control:start', 0);
            if (result) {
                const payload = JSON.parse(result.element);
                await orchestrator.startMission(payload);
            }
        } catch (err) {
            logger.error('Error processing mission start request', err);
            // Prevent tight loop on error
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main().catch(err => {
    logger.error('Fatal error', err);
    process.exit(1);
});
