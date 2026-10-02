import { z } from "zod";

// NEWS

export interface NewsItem {
    title: string;
    description: string;
    source: string;
    publishedAt: string
}

// News item with code-computed scores

export interface ScoredNewsItem extends NewsItem{
    sourceTierWeight: number;
    freshnessScore: number;
    crossSourceCount: number;
    crossSourceMultiplier: number;
}

// Jev judgement on single new article

export const JevNewsClassificationSchema = z.object({
    relevance: z.number().min(0).max(1),
    impactType: z.enum(['MACRO','SECTOR','COMPANY','NOISE']),
    severity: z.enum(['HIGH','MEDIUM','LOW']),
    actionable: z.number().min(0).max(1)
});

export const JevNewsClassificationBatchSchema = z.object({
    classifications: z.array(JevNewsClassificationSchema)
})

export type JevNewsClassification = z.infer<typeof JevNewsClassificationSchema>