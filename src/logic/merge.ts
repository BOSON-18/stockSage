import { JevDecision, Recommendation, StockAnalysis, StockSnapshot } from "../types";


// Combine Stock data + LLm analysis + Jev Decision

export function mergeResults(
    stocks: StockSnapshot[],
    analyses: StockAnalysis[],
    decisions: JevDecision[]
): Recommendation[] {


    return stocks.map((stock, i) => {
        const analysis = analyses[i];
        const decision = decisions[i];

        // LLM PERCENT
        const upside = analysis?.expectedUpsidePercent ?? 0;
        const downside = analysis?.riskDownsidePercent ?? 0;
        const targetPrice = stock.price * (1 + upside / 100);
        const stopLoss = stock.price * (1 - downside / 100);

        return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            currentPrice: stock.price,
            targetPrice: targetPrice,
            stopLoss: stopLoss,
            // From LLM
            sentiment: analysis?.sentiment ?? 'neutral',
            bullCase: analysis?.bullCase ?? [],
            bearCase: analysis?.bearCase ?? [],
            thesis: analysis?.thesis ?? 'Analysis unavailable',
            newsImpact: analysis?.newsImpact ?? 'No news data',
            // FROM DEV
            action: decision?.action ?? 'AVOID',
            confidence: decision?.confidence ?? 0,
            holdingPeriod: decision?.holdingPeriod ?? 'INTRADAY',
            riskLevel: decision?.riskLevel ?? 'HIGH',
            jevProbabilities: decision?.actionProbabilities ?? {},
        }
    })
}

