import { z } from "zod";



//  LLM ANALYSIS

export const StockAnalysisSchema = z.object({
    ticker: z.string(),
    companyName: z.string(),
    sentiment: z.enum(['bullish', "bearish", 'neutral']),
    bullCase: z.array(z.string()),
    bearCase: z.array(z.string()),
    thesis: z.string(),
    newsImpact: z.string(),
    expectedUpsidePercent: z.number(),
    riskDownsidePercent: z.number()

});



export const AnalysisResponseSchema = z.object({
    analyses: z.array(StockAnalysisSchema)
})

export type StockAnalysis = z.infer<typeof StockAnalysisSchema>;


// One agent's opinion on one stock (committee system)

export const AgentVerdictSchema = z.object({
    ticker: z.string(),
    sentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION']),
    confidence: z.number().min(0).max(100),
    expectedMovePercent: z.number(),
    reasoning: z.string()
})

export const AgentBatchVerdictSchema = z.object({
    verdicts: z.array(AgentVerdictSchema)
})

export type AgentVerdict = z.infer<typeof AgentVerdictSchema>;