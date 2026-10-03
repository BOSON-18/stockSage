import { z } from 'zod';
import { CandidateStock, MarketContext, ScoredNewsItem, StockSnapshot } from '../types';
import { buildJevGatePrompt, buildStockExtractPrompt } from '../prompts';
import { callLLM } from './llm-client';
import { MAX_CANDIDATES, MAX_PRICE_PER_STOCK, WATCHLIST } from '../config';




const ExtractedStockSchema = z.object({
    stocks: z.array(z.object({
        ticker: z.string(),
        reason: z.string()
    }))
});

const JevGateSchema = z.object({
    gates: z.array(z.object({
        ticker: z.string(),
        worthAnalyzing: z.number().min(0).max(1)
    }))
});


export async function extractStocksFromNews(
    filteredNews: ScoredNewsItem[], sectorMap?: Record<string, string[]>
): Promise<CandidateStock[]> {

    if (filteredNews.length === 0) return [];

    const prompt = buildStockExtractPrompt(filteredNews, MAX_PRICE_PER_STOCK, sectorMap);

    try {
        const raw = await callLLM(prompt);
        const parsed = JSON.parse(raw);
        const validated = ExtractedStockSchema.parse(parsed);

        return validated.stocks.filter((s) => s.ticker && s.ticker.length > 0).map((s) => ({
            ticker: s.ticker.endsWith('.NS') ? s.ticker : `${s.ticker}.NS`,
            source: 'news' as const,
            reason: s.reason
        }))
    } catch (error) {
        console.warn('Stock extraction from news failed:', error);
        return []
    }
}

const DISCOVERY_POOL = [
    // Banks
    'YESBANK.NS', 'PNB.NS', 'IDFCFIRSTB.NS', 'BANKBARODA.NS', 'CANBK.NS', 'UNIONBANK.NS', 'BANKINDIA.NS',
    'IOB.NS', 'UCOBANK.NS', 'CENTRALBK.NS', 'FEDERALBNK.NS', 'RBLBANK.NS', 'BANDHANBNK.NS', 'SOUTHBANK.NS',
    // Finance / PSU lenders
    'IRFC.NS', 'IREDA.NS', 'HUDCO.NS', 'PFC.NS', 'MANAPPURAM.NS', 'SAMMAANCAP.NS',
    // Power / renewables
    'SUZLON.NS', 'NHPC.NS', 'SJVN.NS', 'JPPOWER.NS', 'RPOWER.NS',
    // Railways / infra
    'RVNL.NS', 'IRCON.NS', 'RAILTEL.NS', 'NBCC.NS', 'GMRAIRPORT.NS',
    // Telecom
    'IDEA.NS', 'HFCL.NS', 'ITI.NS', 'GTLINFRA.NS', 'MTNL.NS',
    // Metals / energy
    'SAIL.NS', 'NMDC.NS', 'NATIONALUM.NS', 'HINDCOPPER.NS', 'TATASTEEL.NS', 'IOC.NS', 'GAIL.NS',
    // Auto / media / others
    'MOTHERSON.NS', 'ASHOKLEY.NS', 'ZEEL.NS', 'TV18BRDCST.NS', 'NETWORK18.NS', 'SPICEJET.NS',
];


async function fetchTopMovers(): Promise<CandidateStock[]> {
    // Dynamic import to avoid circular dependency

    const { fetchStockData, formatStockData } = require('../data/stock-fetcher');
    console.log('[DISCOVERY] fetching top movers...')

    const raw = await fetchStockData(DISCOVERY_POOL);
    console.log('[DISCOVERY] raw data:', raw);
    const stocks = formatStockData(raw);

    return stocks.filter((s: StockSnapshot) => s.price <= MAX_PRICE_PER_STOCK).sort((a: StockSnapshot, b: StockSnapshot) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 10).map((s: StockSnapshot) => ({
        ticker: s.ticker,
        source: 'top_mover' as const,
        reason: `Top mover: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}% today`
    }))
}


export async function buildCandidateList(
    newsStocks: CandidateStock[]
): Promise<CandidateStock[]> {
    const all: CandidateStock[] = [...newsStocks];
    // Add watchliost stock if not present
    for (const ticker of WATCHLIST) {
        if (!all.some((c) => c.ticker === ticker)) {
            all.push({
                ticker,
                source: 'watchlist',
                reason: 'User watchlist'
            })
        }
    }

    // SAFETY NET 
    if (all.length < 5) {
        console.log(`Only ${all.length} candidates - fetching top movers as fallback...`);
        const movers = await fetchTopMovers();
        for (const mover of movers) {
            if (!all.some((c) => c.ticker === mover.ticker)) {
                all.push(mover)
            }
        }

        console.log(`After top movers: ${all.length} candidates`)
    }

    return all.slice(0, MAX_CANDIDATES);
}

export function filterByBudget(stocks: StockSnapshot[]): StockSnapshot[] {
    const affordable = stocks.filter((s) => s.price <= MAX_PRICE_PER_STOCK);

    const skipped = stocks.length - affordable.length;

    if (skipped > 0) {
        console.log(`⚠️  Budget Filter: Skipped ${skipped} stocks priced > ${MAX_PRICE_PER_STOCK}`);
    }
    return affordable;

}


//  Stocks that pass the regime-based threshold - If jev fails - pass all through ( no filtering)

export async function jevGateCandidates(
    stocks: StockSnapshot[],
    filteredNews: ScoredNewsItem[],
    marketContext: MarketContext
): Promise<string[]> {

    if (stocks.length === 0) return [];
    const prompt = buildJevGatePrompt(stocks, filteredNews, marketContext);

    try {
        const raw = await callLLM(prompt);
        const parsed = JSON.parse(raw);

        console.log('[JEV-GATE] Checking parsed output: ', parsed)
        const validated = JevGateSchema.parse(parsed);

        const threshold = marketContext.jevGateThreshold;
        const passed = validated.gates.filter((g) => g.worthAnalyzing >= threshold).map((g) => g.ticker)
        console.log(`Gate results (threshold ${(threshold * 100).toFixed(0)}%):`);
        validated.gates.forEach((g) => {
            const status = g.worthAnalyzing >= threshold ? 'PASS' : 'FAIL';
            console.log(`${status} ${g.ticker}: ${(g.worthAnalyzing * 100).toFixed(0)}%`)
        })
        console.log(`🚀 JEV GATE: Passed ${passed.length}`)

        return passed;
    } catch (error) {
        console.warn('Jev gating failed, passing all candidates through:', error);
        return stocks.map((s) => s.ticker);
    }
}