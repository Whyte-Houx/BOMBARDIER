export enum BombingMethod {
    DR = 'DR', // Dating and Relationship
    IVM = 'IVM' // Investment Method
}

export interface MissionConfig {
    campaignId: string;
    method: BombingMethod;
    targetCriteria: Record<string, any>;
    cloakConfig?: {
        useVpn?: boolean;
        location?: string;
    };
}

export interface MissionStatus {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    currentStage: string;
    results: any;
}
