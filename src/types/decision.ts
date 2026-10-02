import { z } from "zod";

// jev decision

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

