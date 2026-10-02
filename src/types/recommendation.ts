

// FINAL RECOMMENDATION

import { AgentVerdict } from "./analysis";

export interface Recommendation {
    ticker: string;
    companyName: string;
    currentPrice: number;
    targetPrice: number;
    stopLoss: number;
    // From committee agents
    committeeVerdicts: AgentVerdict[];
    // FROM Jev
    action: string;
    confidence: number;
    holdingPeriod: string;
    riskLevel: string;
    jevProbabilities: Record<string, number>;
    // context
    newsContext: string[]
}

