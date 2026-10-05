import { z } from 'zod';
import { CandidateStock, MarketContext, ScoredNewsItem, StockSnapshot } from '../types';
import { buildJevGatePrompt, buildStockExtractPrompt } from '../prompts';
import { callLLM } from './llm-client';
import { MAX_CANDIDATES, MAX_PRICE_PER_STOCK, WATCHLIST } from '../config';
import { jevGateStock } from './jev-decision';




const ExtractResponseSchema = z.object({

    sectors: z.array(z.object({
        sector: z.string(),
        reason: z.string()
    })).optional().default([]),
    companies: z.array(z.object({
        ticker: z.string(),
        reason: z.string()
    })).optional().default([])
    // stocks: z.array(z.object({
    //     ticker: z.string(),
    //     reason: z.string()
    // }))
});

// const JevGateSchema = z.object({
//     gates: z.array(z.object({
//         ticker: z.string(),
//         worthAnalyzing: z.number().min(0).max(1)
//     }))
// });


export async function extractStocksFromNews(
    filteredNews: ScoredNewsItem[], sectorMap?: Record<string, string[]>
): Promise<CandidateStock[]> {

    if (filteredNews.length === 0) return [];

    const prompt = buildStockExtractPrompt(filteredNews, MAX_PRICE_PER_STOCK, sectorMap);
    const candidates: CandidateStock[] = [];

    try {
        const raw = await callLLM(prompt);
        const parsed = JSON.parse(raw);
        const validated = ExtractResponseSchema.parse(parsed);

        if (sectorMap && validated.sectors.length > 0) {
            for (const s of validated.sectors) {
                const tickers = sectorMap[s.sector];
                if (tickers && tickers.length > 0) {
                    for (const ticker of tickers) {
                        if (!candidates.some(c => c.ticker === ticker)) {
                            candidates.push({
                                ticker,
                                source: 'news',
                                reason: `${s.sector}: ${s.reason}`
                            })
                        }
                    }
                    console.log(`Sector "${s.sector}" -> ${tickers.length} tickers`);
                } else {
                    console.log(`Sector "${s.sector}" not found in map`)
                }
            }
        }

        for (const c of validated.companies) {
            if (!c.ticker || c.ticker.length === 0) continue;
            const ticker = c.ticker.endsWith('NS') ? c.ticker : `${c.ticker}.NS`;
            if (!candidates.some(cand => cand.ticker === ticker)) {
                candidates.push(
                    {
                        ticker,
                        source: 'news',
                        reason: c.reason
                    }
                )
            }
        }

        console.log(`Extraction: ${validated.sectors.length} sectors + ${validated.companies.length} companies -> ${candidates.length} tickers`);
        // return validated.stocks.filter((s) => s.ticker && s.ticker.length > 0).map((s) => ({
        //     ticker: s.ticker.endsWith('.NS') ? s.ticker : `${s.ticker}.NS`,
        //     source: 'news' as const,
        //     reason: s.reason
        // }))
    } catch (error) {
        console.warn('Stock extraction from news failed:', error);
        return []
    }

    return candidates;
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
    // console.log('[DISCOVERY] raw data:', raw);
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


    try {

        const threshold = marketContext.jevGateThreshold;
        console.log(`Gate results (threshold ${(threshold * 100).toFixed(0)}%):`);

        const passed: string[] = [];
        const newsHeadlines = filteredNews.map(n => n.title).join('; ').slice(0, 300);

        for (const stock of stocks) {
            const volRatio = stock.avgVolume > 0 ? (stock.volume / stock.avgVolume).toFixed(1) : 'N/A';
            const context = `Stock: ${stock.ticker}, Price: Rs.${stock.price.toFixed(2)}, Change: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%, PE: ${stock.pe?.toFixed(1) ?? 'N/A'}, Vol: ${volRatio}x avg\nMarket: Nifty ${marketContext.niftyChangePercent.toFixed(2)}%, Regime: ${marketContext.regime}\nNews: ${newsHeadlines}`;
            const probability = await jevGateStock(context);

            const status = probability >= threshold ? 'PASS' : 'FAIL';

            console.log(`${status} ${stock.ticker}: ${(probability * 100).toFixed(0)}%`);

            if (probability >= threshold) passed.push(stock.ticker);
        }
        if (passed.length === 0) {
            console.warn('No stocks passed gate - passing all as fallback');
            return stocks.map(s => s.ticker);
        }

        return passed;
    } catch (error) {
        console.warn('Jev gating failed, passing all candidates through:', error);
        return stocks.map((s) => s.ticker);
    }
}