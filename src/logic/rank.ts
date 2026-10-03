import { MIN_CONFIDENCE_THRESHOLD } from "../config";
import { Recommendation } from "../types";


export function rankAndFilter(recs: Recommendation[]): Recommendation[] {
    return recs
        .filter(r => r.action !== 'AVOID')
        .filter(r => r.confidence >= MIN_CONFIDENCE_THRESHOLD)
        .sort((a, b) => b.confidence - a.confidence)
}