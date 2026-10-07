import YahooFinance from "yahoo-finance2";
import { MarketContext, MarketRegime, StockSnapshot } from "../types";
import { REGIME_THRESHOLD } from "../config";


const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });


// function computeRegime(niftyChangePercent: number): MarketRegime {
//     const absChange = Math.abs(niftyChangePercent);

//     if (absChange < REGIME_THRESHOLD.CALM.maxNiftyChange) return 'CALM';
//     if (absChange < REGIME_THRESHOLD.VOLATILE.maxNiftyChange) return 'VOLATILE';
//     return 'CRASH_OR_RALLY'
// }

// function buildMarketContext(
//     niftyPrice: number,
//     niftyChange: number,
//     sensexChange: number
// ): MarketContext {
//     const regime = computeRegime(niftyChange);

//     const thresholds = REGIME_THRESHOLD[regime];

//     return {
//         niftyPrice,
//         niftyChangePercent: niftyChange,
//         sensexChangePercent: sensexChange,
//         regime,
//         upsideRange: thresholds.upside,
//         downsideRange: thresholds.downside,
//         jevGateThreshold: thresholds.jevGate
//     }
// }

// export async function fetchMarketContext(): Promise<MarketContext> {
//     console.log('[STOCK-FETCHER] fetching market data...')
//     try {
//         const [nifty, sensex] = await Promise.all([
//             yahooFinance.quote('^NSEI'),
//             yahooFinance.quote('^BSESN')
//         ]);

//         const niftyPrice = (nifty as any).regularMarketPrice ?? 0;
//         const niftyChange = (nifty as any).regularMarketChangePercent ?? 0;
//         const sensexChange = (sensex as any).regularMarketChangePercent ?? 0;
//         const marketState = (nifty as any).marketState ?? 'CLOSED';

//         // If market closed used relaxed thresolds
//         if (marketState === 'CLOSED' || marketState == "POSTPOST") {

//             console.log('MARKET is CLOSED - using relaxed thresholds for testing');

//             return {
//                 niftyPrice,
//                 niftyChangePercent: niftyChange,
//                 sensexChangePercent: sensexChange,
//                 regime: 'VOLATILE' as const,
//                 upsideRange: REGIME_THRESHOLD.VOLATILE.upside,
//                 downsideRange: REGIME_THRESHOLD.VOLATILE.downside,
//                 jevGateThreshold: 0.40,
//             }

//         }

//         return buildMarketContext(niftyPrice, niftyChange, sensexChange);

//     } catch (error) {

//         console.warn('Market context fetch failed, using default CALM regime:', error);
//         return {
//             niftyPrice: 0,
//             niftyChangePercent: 0,
//             sensexChangePercent: 0,
//             regime: 'CALM',
//             upsideRange: REGIME_THRESHOLD.CALM.upside,
//             downsideRange: REGIME_THRESHOLD.CALM.downside,
//             jevGateThreshold: REGIME_THRESHOLD.CALM.jevGate
//         }
//     }
// }



// Impure functions - await
export async function fetchStockData(tickers: string[]): Promise<Record<string, any>[]> {
    const rawQuotes: Record<string, any>[] = [];
    // const snapshots: StockSnapshot[] = [];
    console.log('[STOCK-FETCHER] fetching stock data...')
    for (const ticker of tickers) {
        try {
            const quote = await yahooFinance.quote(ticker, {}, { validateResult: false });
            // console.log("data: ", quote)
            if (quote === undefined) continue;
            rawQuotes.push(quote as Record<string, any>);
        } catch (error) {
            console.warn(`Failed to fetch ${ticker}, skipping: `, error)
        }
    }

    return rawQuotes;

}


export function formatStockData(rawQuotes: Record<string, any>[]): StockSnapshot[] {
    return rawQuotes.map((quote) => ({
        ticker: quote.symbol ?? 'UNKNOWN',
        companyName: quote.shortName ?? quote.longName ?? quote.symbol ?? 'Unknown',
        price: quote.regularMarketPrice ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        pe: quote.trailingPE ?? null,
        marketCap: quote.marketCap ?? 0,
        volume: quote.regularMarketVolume ?? 0,
        avgVolume: quote.averageDailyVoulme3Month ?? 0,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
        fiftyDayAvg: quote.fiftyDayAverage ?? 0,
        twoHundredDayAvg: quote.twoHundredDayAvg ?? 0
    }))
}
