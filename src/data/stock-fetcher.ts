import YahooFinance from "yahoo-finance2";
import { StockSnapshot } from "../types";


const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });



// Impure functions - await
// async function fetchStockData(tickers: string[]): Promise<StockSnapshot[]> {
export async function fetchStockData(tickers: string[]): Promise<Record<string, any>[]> {
    const rawQuotes: Record<string, any>[] = [];
    // const snapshots: StockSnapshot[] = [];

    for (const ticker of tickers) {
        try {
            const quote = await yahooFinance.quote(ticker);
            // console.log("data: ", quote)
            rawQuotes.push(quote as Record<string, any>);
        } catch (error) {
            console.warn(`Failed to fetch ${ticker}, skipping: `, error)
        }
    }

    return rawQuotes;

}


export function formatStockData(rawQuotes: Record<string, any>[]): StockSnapshot[] {
    return rawQuotes.map((quote) => ({
        ticker: quote.symbol,
        companyName: quote.shortName ?? quote.longName ?? quote.symbol ?? 'Unknown',
        price: quote.regularMarketPrice,
        changePercent: quote.regularMarketChangePercent ?? 0,
        pe: quote.trailingPE ?? null,
        marketCap: quote.marketCap ?? 0,
        volume: quote.regularMarketVolume ?? 0,
        avgVolume: quote.averageDailyVoulme3Month,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
        fiftyDayAvg: quote.fiftyDayAverage ?? 0,
        twoHundredDayAvg: quote.twoHundredDayAvg ?? 0
    }))
}
