import { buildFundamentalAgentPrompt, buildJevVotePrompt, buildMacroAgentPrompt, buildNewsAgentPrompt, buildRiskAgentPrompt, buildTechnicalAgentPrompt } from "../prompts";
import { AgentBatchVerdictSchema, AgentVerdict, JevBatchResponseSchema, JevDecision, JevDecisionSchema, MarketContext, SanitizedPortfoilio, ScoredNewsItem, StockSnapshot, TechnicalIndicators } from "../types";
import { fundamentalAgentjev, macroAgentJev, technicalAgentJev } from "./jev-agents";
import { getJevProvider } from "./jev-procider";
import { callLLM } from "./llm-client";
import { VerfiedClaim, verifyCommitteeResults } from "./verifier";


async function runLLMAgent(
    agentName: string,
    prompt: string
): Promise<AgentVerdict[]> {

    try {

        console.log(` Running ${agentName} (LLM)...`);
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
    indicators?: Record<string, TechnicalIndicators>,
    portfolio?: SanitizedPortfoilio | null
): Promise<{
    verdictMap: Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]>;
    verificationMap: Record<string, VerfiedClaim[]>;
}> {

    const tickers = stocks.map((s) => s.ticker)
    console.log(' Running committee (2LLm + 3Jev Agents)...\n');
    const newsVerdicts = await runLLMAgent('NEWS ANALYST', buildNewsAgentPrompt(tickers, news));
    const riskVerdicts = await runLLMAgent('RISK ANALYST', buildRiskAgentPrompt(stocks, news, marketContext, indicators, portfolio));
    // const techVerdicts = await runLLMAgent('TECHNICAL ANALYST', buildTechnicalAgentPrompt(stocks, indicators));
    // const fundVerdicts = await runLLMAgent('FUNDAMENTAL ANALYST', buildFundamentalAgentPrompt(stocks));
    // const macroVerdicts = await runLLMAgent('MACRO ANALYST', buildMacroAgentPrompt(tickers, marketContext));

    console.log('Running TECHNICAL JEV...');
    const techVerdicts = await technicalAgentJev(stocks, indicators ?? {});
    console.log(`TECHINCAL: ${techVerdicts.length} verdicts`)
    console.log('Running TECHNICAL JEV...');

    const fundVerdicts = await fundamentalAgentjev(stocks);
    console.log(`FUNADMENTAL: ${techVerdicts.length} verdicts`)
    console.log('Running TECHNICAL JEV...');

    const macroVerdicts = await macroAgentJev(stocks, marketContext);
    console.log(`MACRO: ${techVerdicts.length} verdicts`)

    // Combine all verdicts per stock
    // const allAgentResults = [
    //     { name: 'NEWS', verdicts: newsVerdicts },
    //     { name: 'TECHNICAL', verdicts: techVerdicts },
    //     { name: 'FUNDAMENTAL', verdicts: fundVerdicts },
    //     { name: 'MACRO', verdicts: macroVerdicts },
    //     { name: 'RISK', verdicts: riskVerdicts }
    // ]

    //  Build map: ticker -> all verdicts for that stock

    const verdictMap: Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]> = {};

    for (const ticker of tickers) {
        verdictMap[ticker] = [];

        const newsV = newsVerdicts.find((v) => v.ticker === ticker);
        if (newsV) verdictMap[ticker].push({ agent: 'NEWS', sentiment: newsV.sentiment, confidence: newsV.confidence, expectedMovePercent: newsV.expectedMovePercent, reasoning: newsV.reasoning })

        const techV = techVerdicts.find((v) => v.ticker === ticker);
        if (techV) verdictMap[ticker].push(techV);

        const fundV = fundVerdicts.find((v) => v.ticker === ticker);
        if (fundV) verdictMap[ticker].push(fundV);

        const macroV = macroVerdicts.find((v) => v.ticker === ticker);
        if (macroV) verdictMap[ticker].push(macroV);

        const riskV = riskVerdicts.find((v) => v.ticker === ticker);
        if (riskV) verdictMap[ticker].push({ agent: 'RISK', sentiment: riskV.sentiment, confidence: riskV.confidence, expectedMovePercent: riskV.expectedMovePercent, reasoning: riskV.reasoning });

        // for (const agentResult of allAgentResults) {
        //     const verdict = agentResult.verdicts.find((v) => v.ticker === ticker);
        //     if (verdict) {
        //         verdictMap[ticker].push({
        //             agent: agentResult.name,
        //             sentiment: verdict.sentiment,
        //             confidence: verdict.confidence,
        //             expectedMovePercent: verdict.expectedMovePercent,
        //             reasoning: verdict.reasoning
        //         })
        //     }
        // }
    }


    console.log('\n Running claim  verification {Jev)...');
    const dataContexts: Record<string, string> = {};
    for (const stock of stocks) {
        const ind = indicators?.[stock.ticker];
        // dataContexts[stock.ticker] = `Price: Rs.${stock.price}, Change: ${stock.changePercent}%, PE: ${stock.pe ?? 'N/A'}, Volume: ${stock.volume}${ind ? `, RSI: ${ind?.rsi.toFixed(1)}, MACD: ${ind?.macdSignal}` : ''}`
        const volRatio = stock.avgVolume > 0 ? (stock.volume / stock.avgVolume).toFixed(1) : 'N/A';
        dataContexts[stock.ticker] = `VERIFIED DATA FOR ${stock.ticker}:
        Price: Rs.${stock.price.toFixed(2)}, Change today: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%
        PE Ratio: ${stock.pe?.toFixed(1) ?? 'N/A'}, Market Cap: Rs.${(stock.marketCap / 1e7).toFixed(2)} Cr.
        Volume: Rs.${stock.volume.toLocaleString()} (${volRatio}x average)
        52W Range: Rs.${stock.fiftyTwoWeekLow.toFixed(2)} - Rs.${stock.fiftyTwoWeekHigh.toFixed(2)}
        52-DMA: Rs.${stock.fiftyDayAvg.toFixed(2)}, 200-DMA: Rs.${stock.twoHundredDayAvg.toFixed(2)}
        ${ind ? `RSI: ${ind.rsi.toFixed(1)} (${ind.rsiSignal}), MACD: ${ind.macdSignal}, Bollinger: ${ind.bollingerPosition}, ATR: ${ind.atrPercent.toFixed(1)}%` : 'No technical indicators available'}
        `
    }
    const verificationMap = await verifyCommitteeResults(verdictMap, dataContexts);

    const totalClaims = Object.values(verificationMap).flat();
    const verified = totalClaims.filter(c => c.status === 'VERIFIED').length;
    const inferred = totalClaims.filter(c => c.status === 'INFERRED').length;
    const unsupported = totalClaims.filter(c => c.status === 'UNSUPPORTED').length;

    console.log('\n Claim Verification Statistics:');
    console.log(`Total Claims: ${totalClaims.length}`);
    console.log(`Verified: ${verified}`);
    console.log(`Disputed: ${inferred}`);
    console.log(`Invalid: ${unsupported}`);



    return { verdictMap, verificationMap };
}



// JEV final Vote

export async function jevCommitteeVote(
    stocks: StockSnapshot[],
    verdictMap: Record<string, { agent: string; sentiment: string; confidence: number; expectedMovePercent: number; reasoning: string }[]>
): Promise<JevDecision[]> {

    // const prompt = buildJevVotePrompt(stocks, verdictMap);
    const jev = getJevProvider();
    const decisions: JevDecision[] = [];

    for (const stock of stocks) {
        const verdicts = verdictMap[stock.ticker] ?? [];
        const verdictSummary = verdicts.map(v => `${v.agent}: ${v.sentiment} (${v.confidence}%) - ${v.reasoning}`).join('\n');

        const context = `Stock: ${stock.ticker} (Rs.${stock.price.toFixed(2)})\n\nCOMMITTEE VERDICTS:\n${verdictSummary}`

        try {

            // const raw = await callLLM(prompt);
            // const parsed = JSON.parse(raw);
            // const validated = JevBatchResponseSchema.parse(parsed);
            // return validated.decisions;

            const action = await jev.choice(
                context,
                'based on all expert opinions, what action should the trader take?',
                ['BUY', 'SELL', 'HOLD', 'AVOID'],
            );

            const holding = await jev.choice(
                context,
                'What is the optimal holding period for this trade?',
                ['INTRADAY', 'SWING', 'POSITIONAL']
            );

            const risk = await jev.choice(
                context,
                'What is the risk level of this trade?',
                ['LOW', 'MEDIUM', 'HIGH']
            );

            const confidence = await jev.noul(
                context,
                'How confident is this recommendation? (1.0 = very confident, all agents agree; 0.0 = conflicting opinions)'
            )

            decisions.push({
                action: action.selected as any,
                actionProbabilities: action.probabilities as any,
                holdingPeriod: holding.selected as any,
                confidence: Math.round(confidence.probability * 100),
                riskLevel: risk.selected as any
            })

        } catch (error) {
            console.warn(` Jev committee vote failed for ${stock.ticker}, defaulting to AVOID `);

            decisions.push({
                action: 'AVOID',
                actionProbabilities: { BUY: 0, SELL: 0, HOLD: 0, AVOID: 1 },
                holdingPeriod: 'INTRADAY',
                confidence: 0,
                riskLevel: 'HIGH'
            })

        }

    }
    return decisions;


}
