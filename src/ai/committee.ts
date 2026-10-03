import { buildFundamentalAgentPrompt, buildJevVotePrompt, buildMacroAgentPrompt, buildNewsAgentPrompt, buildRiskAgentPrompt, buildTechnicalAgentPrompt } from "../prompts";
import { AgentBatchVerdictSchema, AgentVerdict, JevBatchResponseSchema, JevDecision, JevDecisionSchema, MarketContext, ScoredNewsItem, StockSnapshot, TechnicalIndicators } from "../types";
import { callLLM } from "./llm-client";


async function runAgent(
    agentName: string,
    prompt: string
): Promise<AgentVerdict[]> {

    try {

        console.log(` Running ${agentName} ...`);
        const raw = await callLLM(prompt);
        const parsed = JSON.parse(raw);
        const validated = AgentBatchVerdictSchema.parse(parsed);
        console.log(`${agentName}: ${validated.verdicts.length} verdicts`);
        return validated.verdicts;

    } catch (error) {
        console.warn(` ${agentName} failed, skipping: `, error);
        return []
    }
}


export async function runCommittee(
    stocks: StockSnapshot[],
    news: ScoredNewsItem[],
    marketContext: MarketContext,
    indicators?: Record<string, TechnicalIndicators>
): Promise<Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]>> {

    const tickers = stocks.map((s) => s.ticker)
    console.log(' Running 5-agent committee...\n');
    const newsVerdicts = await runAgent('NEWS ANALYST', buildNewsAgentPrompt(tickers, news));
    const techVerdicts = await runAgent('TECHNICAL ANALYST', buildTechnicalAgentPrompt(stocks, indicators));
    const fundVerdicts = await runAgent('FUNDAMENTAL ANALYST', buildFundamentalAgentPrompt(stocks));
    const macroVerdicts = await runAgent('MACRO ANALYST', buildMacroAgentPrompt(tickers, marketContext));
    const riskVerdicts = await runAgent('RISK ANALYST', buildRiskAgentPrompt(stocks, news, marketContext, indicators));

    // Combine all verdicts per stock
    const allAgentResults = [
        { name: 'NEWS', verdicts: newsVerdicts },
        { name: 'TECHNICAL', verdicts: techVerdicts },
        { name: 'FUNDAMENTAL', verdicts: fundVerdicts },
        { name: 'MACRO', verdicts: macroVerdicts },
        { name: 'RISK', verdicts: riskVerdicts }
    ]

    //  Build map: ticker -> all verdicts for that stock

    const verdictMap: Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]> = {};

    for (const ticker of tickers) {
        verdictMap[ticker] = [];

        for (const agentResult of allAgentResults) {
            const verdict = agentResult.verdicts.find((v) => v.ticker === ticker);
            if (verdict) {
                verdictMap[ticker].push({
                    agent: agentResult.name,
                    sentiment: verdict.sentiment,
                    confidence: verdict.confidence,
                    expectedMovePercent: verdict.expectedMovePercent,
                    reasoning: verdict.reasoning
                })
            }
        }
    }

    return verdictMap;
}



// JEV final Vote

export async function jevCommitteeVote(
    stocks: StockSnapshot[],
    verdictMap: Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]>
): Promise<JevDecision[]> {

    const prompt = buildJevVotePrompt(stocks, verdictMap);

    try {

        const raw = await callLLM(prompt);
        const parsed = JSON.parse(raw);
        const validated = JevBatchResponseSchema.parse(parsed);
        return validated.decisions;

    } catch (error) {
        console.warn(` Jev committee vote failed: `, error);

        return stocks.map(() => ({
            action: 'AVOID' as const,
            actionProbabilities: { BUY: 0, SELL: 0, HOLD: 0, AVOID: 1 },
            holdingPeriod: 'INTRADAY' as const,
            confidence: 0,
            riskLevel: 'HIGH' as const
        }))
    }

}
