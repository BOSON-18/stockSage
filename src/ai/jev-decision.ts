import { MAX_RETRIES, RETRY_DELAY_MS, USE_LOCAL } from "../config";
import { buildBatchJevPrompt, buildNewsClassifyPrompt, buildSingleJevPrompt } from "../prompts";
import { JevBatchResponseSchema, JevDecision, JevDecisionSchema, JevNewsClassification, JevNewsClassificationBatchSchema, ScoredNewsItem, StockAnalysis, StockSnapshot } from "../types";
import { getJevProvider } from "./jev-procider";
import { callLLM } from "./llm-client";



//  NEWS CLASSIFIER v0.4 

export async function jevClassifyNews(
    scoredNews: ScoredNewsItem[]
): Promise<JevNewsClassification[]> {
    if (scoredNews.length === 0) return [];

    // const prompt = buildNewsClassifyPrompt(scoredNews);

    const classifications: JevNewsClassification[] = [];
    const jev = getJevProvider();

    for (const article of scoredNews) {
        try {
            const context = `NEWS ARTICLE FOR CLASSIFICATION:
             Title: ${article.title}
             Desciption: ${article.description}
             Source: ${article.source} (credibility weight: ${article.sourceTierWeight})
             Freshness: ${article.freshnessScore >= 0.8 ? 'Fresh (within hours)' : article.freshnessScore >= 0.5 ? 'Today' : 'Stale (>24hrs)'}
             Cross-source: Reported by ${article.crossSourceCount} source(s)
             
             CLASSIFICATION CONTEXT:
             The Indian stock market (NSE/BSE) includes sectors like Banking, IT, Oil&Gas, Auto, Pharma, Metal, Power, FMCG, Telecom, Defense.
             Global events (US tariffs, crude oil, Fed rates, wars) affect Indian markets heavily.
             Domestic events (RBI decisions, GDP data, govt policy, earnings) directly impact specific stocks. 
             `;

            // const [relevance, impactType, severity, actionable] = await Promise.all([
            //     jev.noul(context, 'Is this news relevant to the Indian stock market (NSE/BSE)?'),
            //     jev.choice(context, 'What type of market impact does this news have?', ['MACRO', 'SECTOR', 'COMPANY', "NOISE"]),
            //     jev.choice(context, 'How severe is the potential market impact?', ['HIGH', 'MEDIUM', 'LOW']),
            //     jev.noul(context, 'is this news actionable for a trader TODAY?')
            // ]);

            const relevance = await jev.noul(
                context,
                'Does this news article have any impact (direct or indirect) on the Indian stock market, its listed companies, or the sectors they operate in?'
            );
            const impactType = await jev.choice(
                context,
                'How much could this news move stock prices? MACRO = affects entire market (e.g. RBI, GDP). SECTOR = affects one industry (e.g. crude oil affects oil stocks). COMPANY = affects specific company (e.g. quarterly results). NOISE = not market relevant.',
                ['MACRO', 'SECTOR', 'COMPANY', 'NOISE']
            )

            const severity = await jev.choice(
                context,
                'How much could this news move stock prices? HIGH = can move stocks 2%+ (e.g. RBI rate change, major policy). MEDIUM = can move 0.5-2% (e.g. sector news). LOW = minor or indirect effect.',
                ['HIGH','MEDIUM','LOW']
            );
            const actionable = await jev.noul(
                context,
                'Should a stock trader act on this news TODAY? Consider: is it fresh enough to not be priced in? Is the impact clear enough to trade on?'
            )

            classifications.push({
                relevance: relevance.probability,
                impactType: impactType.selected as any,
                severity: severity.selected as any,
                actionable: actionable.probability
            })
        } catch (error) {
            console.warn(`Classification failed for : ${article.title.slice(0, 50)}...`)
        }
    }

    // console.log('[Classify News - JEV] Checking for classification', classifications)
    return classifications;

}


// const AVOID_DECISION: JevDecision = {
//     action: 'AVOID',
//     actionProbabilities: { BUY: 0, SELL: 0, HOLD: 0, AVOID: 1 },
//     holdingPeriod: 'INTRADAY',
//     confidence: 0,
//     riskLevel: 'HIGH'
// }


// async function singleJevDecision(stock: StockSnapshot, analysis: StockAnalysis): Promise<JevDecision> {
export async function jevGateStock(context: string): Promise<number> {

    // const prompt = buildSingleJevPrompt(stock, analysis);
    const jev = getJevProvider();

    // for (let attempt = 1; attempt <= 2; attempt++) {
    //     try {

    //         const raw = await callLLM(prompt);
    //         const parsed = JSON.parse(raw);
    //         console.log('[JEV-DECISION] Checking parsed output: \n', parsed)
    //         return JevDecisionSchema.parse(parsed);
    //     } catch (error) {
    //         console.warn(` Jev batch attempt ${attempt} failed:`, error);
    //         if (attempt == 2) {
    //             console.warn(` jev failed for ${stock.ticker}, defaulting to AVOID`)
    //             return AVOID_DECISION;
    //         }
    //     }
    // }

    // throw new Error('Unreachable');

    try {
        const result = await jev.noul(context, 'Is this stock worth deep analysis today? Consider: news catalyst, price movement, volume.');
        return result.probability;
    } catch (error) {
        return 0.5
    }
}


// async function batchJevDecisions(stocks: StockSnapshot[], analyses: StockAnalysis[]): Promise<JevDecision[]> {
//     const prompt = buildBatchJevPrompt(stocks, analyses);

//     for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
//         try {

//             const raw = await callLLM(prompt);
//             const parsed = JSON.parse(raw);
//             const validated = JevBatchResponseSchema.parse(parsed);
//             return validated.decisions;

//         } catch (error) {
//             console.warn(` Jev batch attempt ${attempt} failed:`, error);
//             if (attempt < MAX_RETRIES) {
//                 await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
//             }
//         }
//     }

//     console.warn('All Jev retries failed. Defaulting all stokcs to AVOID');

//     return stocks.map(() => ({
//         ...AVOID_DECISION
//     }))


// }



// export async function runJevDecisions(
//     stocks: StockSnapshot[],
//     analyses: StockAnalysis[]
// ): Promise<JevDecision[]> {

//     if (USE_LOCAL) {
//         const decisions: JevDecision[] = [];

//         for (const stock of stocks) {
//             const analysis = analyses.find((a) => a.ticker === stock.ticker);

//             if (!analysis) {
//                 decisions.push(AVOID_DECISION);
//                 continue;
//             }
//             console.log(` Jev deciding on ${stock.ticker}...`);
//             decisions.push(await singleJevDecision(stock, analysis));
//         }
//         return decisions;
//     } else {
//         return batchJevDecisions(stocks, analyses);
//     }

// }