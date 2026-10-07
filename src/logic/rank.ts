import { MAX_RECOMMENDATION, MIN_CONFIDENCE_THRESHOLD, PER_STOCK_BUDGET } from "../config";
import { Recommendation } from "../types";


export function rankAndFilter(recs: Recommendation[]): Recommendation[] {
    return recs
        .filter(r => r.action !== 'AVOID')
        .filter(r => r.confidence >= MIN_CONFIDENCE_THRESHOLD)
        // .sort((a, b) => b.confidence - a.confidence)
        .map((r) => {
            const qty = Math.floor(PER_STOCK_BUDGET / r.currentPrice);
            const profitAmount = qty * (r.targetPrice - r.currentPrice);
            const lossAmount = qty * (r.currentPrice - r.stopLoss);
            const riskReward = lossAmount > 0 ? profitAmount / lossAmount : 0;

            const profitScore = (r.confidence / 100) * profitAmount * Math.min(riskReward, 3);
            return { ...r, profitScore, qty, profitAmount, riskReward };
        })
        .filter((r) => r.qty > 0)
        .sort((a, b) => b.profitScore - a.profitScore)
        .slice(0, MAX_RECOMMENDATION)
}