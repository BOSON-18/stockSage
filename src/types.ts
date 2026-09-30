import { z } from "zod";



// STOCK DATA FROM YAHOO

export interface StockSnapshot {
    ticker: string;
    companyName: string;
    price: number;
    changePercent: number;
    pe: number | null; // null hwne stock has no earning
    marketCap: number;
    volume: number;
    avgVolume: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyDayAvg: number;
    twoHundredDayAvg: number;
}


// NEWS

export interface NewsItem {
    title: string;
    description: string;
    source: string;
    publishedAt: string
}

//  LLM ANALYSIS

export const StockAnalysisSchema = z.object({
    ticker: z.string(),
    companyName: z.string(),
    sentiment: z.enum(['bullish', "bearish", 'neutral']),
    bullCase: z.array(z.string()),
    bearCase: z.array(z.string()),
    thesis: z.string(),
    newsImpact: z.string(),
    // targetPrice: z.number(),
    // stopLoss: z.number(),
    expectedUpsidePercent: z.number(),
    riskDownsidePercent: z.number()
    
});

export const AnalysisResponseSchema = z.object({
    analyses: z.array(StockAnalysisSchema)
})


export type StockAnalysis = z.infer<typeof StockAnalysisSchema>;

// JEV DECISION



//  MOCK JEV Decision Schema
export const JevDecisionSchema = z.object({
    action: z.enum(['BUY', 'SELL', 'HOLD', 'AVOID']),
    actionProbabilities: z.object({
        BUY: z.number(),
        SELL: z.number(),
        HOLD: z.number(),
        AVOID: z.number()
    }),
    holdingPeriod: z.enum(['INTRADAY', 'SWING', 'POSITIONAL']),
    confidence: z.number().min(0).max(100),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});

export type JevDecision = z.infer<typeof JevDecisionSchema>;

export const JevBatchResponseSchema = z.object({
    decisions: z.array(JevDecisionSchema)
})


// FINAL RECOMMENDATION

export interface Recommendation {
    ticker: string;
    companyName: string;
    currentPrice: number;
    targetPrice: number;
    stopLoss: number;
    // From LLM
    sentiment: string;
    bullCase: string[];
    bearCase: string[];
    thesis: string;
    newsImpact: string;
    // FROM DEV
    action: string;
    confidence: number;
    holdingPeriod: string;
    riskLevel: string;
    jevProbabilities: Record<string, number>;
}






