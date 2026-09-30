import { MAX_RETRIES, RETRY_DELAY_MS, USE_LOCAL } from "../config";
import { buildBatchJevPrompt, buildSingleJevPrompt } from "../prompts";
import { JevBatchResponseSchema, JevDecision, JevDecisionSchema, StockAnalysis, StockSnapshot } from "../types";
import { callLLM } from "./llm-client";


const AVOID_DECISION: JevDecision = {
    action: 'AVOID',
    actionProbabilities: { BUY: 0, SELL: 0, HOLD: 0, AVOID: 1 },
    holdingPeriod: 'INTRADAY',
    confidence: 0,
    riskLevel: 'HIGH'
}


async function singleJevDecision(stock: StockSnapshot, analysis: StockAnalysis): Promise<JevDecision> {
    const prompt = buildSingleJevPrompt(stock, analysis);


    for (let attempt = 1; attempt <= 2; attempt++) {
        try {

            const raw = await callLLM(prompt);
            const parsed = JSON.parse(raw);
            console.log('[JEV-DECISION] Checking parsed output: \n', parsed)
            return JevDecisionSchema.parse(parsed);
        } catch (error) {
            console.warn(` Jev batch attempt ${attempt} failed:`, error);
            if (attempt == 2) {
                console.warn(` jev failed for ${stock.ticker}, defaulting to AVOID`)
                return AVOID_DECISION;
            }
        }
    }

    throw new Error('Unreachable');
}


async function batchJevDecisions(stocks: StockSnapshot[], analyses: StockAnalysis[]): Promise<JevDecision[]> {
    const prompt = buildBatchJevPrompt(stocks, analyses);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {

            const raw = await callLLM(prompt);
            const parsed = JSON.parse(raw);
            const validated = JevBatchResponseSchema.parse(parsed);
            return validated.decisions;

        } catch (error) {
            console.warn(` Jev batch attempt ${attempt} failed:`, error);
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
            }
        }
    }

    console.warn('All Jev retries failed. Defaulting all stokcs to AVOID');

    return stocks.map(() => ({
        ...AVOID_DECISION
    }))


}



export async function runJevDecisions(
    stocks: StockSnapshot[],
    analyses: StockAnalysis[]
): Promise<JevDecision[]> {

    if (USE_LOCAL) {
        const decisions: JevDecision[] = [];

        for (const stock of stocks) {
            const analysis = analyses.find((a) => a.ticker === stock.ticker);

            if (!analysis) {
                decisions.push(AVOID_DECISION);
                continue;
            }
            console.log(` Jev deciding on ${stock.ticker}...`);
            decisions.push(await singleJevDecision(stock, analysis));
        }
        return decisions;
    } else {
        return batchJevDecisions(stocks, analyses);
    }

}