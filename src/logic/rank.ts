import { Recommendation } from "../types";


export function rankAndFilter(recs: Recommendation[]): Recommendation[] {
    return recs
        .filter(r => r.action !== 'AVOID')
        .filter(r => r.confidence >= 60)
        .sort((a, b) => b.confidence - a.confidence)
}