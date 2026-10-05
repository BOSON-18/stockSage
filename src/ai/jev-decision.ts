import { MAX_RETRIES, RETRY_DELAY_MS, USE_LOCAL } from "../config";
import { buildBatchJevPrompt, buildNewsClassifyPrompt, buildSingleJevPrompt } from "../prompts";
import { JevBatchResponseSchema, JevDecision, JevDecisionSchema, JevNewsClassification, JevNewsClassificationBatchSchema, ScoredNewsItem, StockAnalysis, StockSnapshot } from "../types";
import { getJevProvider } from "./jev-procider";




//  NEWS CLASSIFIER v0.4 

export async function jevClassifyNews(
    scoredNews: ScoredNewsItem[]
): Promise<JevNewsClassification[]> {
    if (scoredNews.length === 0) return [];



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
                ['HIGH', 'MEDIUM', 'LOW']
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


    return classifications;

}




export async function jevGateStock(context: string): Promise<number> {


    const jev = getJevProvider();


    try {
        const result = await jev.noul(context, 'Based on the data above, is there a CLEAR trading opportunity in this stock TODAY? Answer YES (high probability) if: the stock has unusual volume (>1.5x average), OR significant price movement (>1%), OR is directly mentioned in today\'s news, OR has strong technical signals. Answer No (low probability) if the stock is flat with normal volume and no catalyst.');
        return result.probability;
    } catch (error: any) {
        console.log('JEV Gate failed: ', error.message);
        return 0.5
    }
}




