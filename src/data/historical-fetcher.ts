import YahooFinance from "yahoo-finance2";
import { OHLCV } from "../types";



const yahooFinance = new YahooFinance();

function getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
}

// async function fetchHistoricalData(
//     ticker: string,
//     months: number = 6
// ): Promise<OHLCV[]> {


//     try {
//         const today = new Date();
//         const startDate = new Date();
//         startDate.setMonth(today.getMonth() - months)

//         const result = await yahooFinance.historical(ticker, {
//             period1: getDateString(startDate),
//             period2: getDateString(today),
//             interval: '1d'
//         }, { validateResult: false })

//         return (result as any[]).map((row: any) => ({
//             date: new Date(row.date),
//             open: row.open ?? 0,
//             high: row.high ?? 0,
//             low: row.low ?? 0,
//             close: row.close ?? 0,
//             volume: row.volume ?? 0,
//         }))
//     } catch (error) {
//         console.warn(`Historical fetch failed for ${ticker}: `, error);
//         return [];
//     }
// }

async function fetchHistoricalData(
    ticker: string,
    months: number = 6
): Promise<OHLCV[]> {
    try {
        // const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate()-1);
        const startDate = new Date();
        startDate.setMonth(yesterday.getMonth() - months);

        const result = await yahooFinance.chart(
            ticker,
            {
                period1: startDate,
                period2: yesterday,
                interval: '1d',
            },
            { validateResult: false }
        ) as any;

        return (result.quotes as any[])
            // incomplete candles skip karo
            .filter((q) => q.close != null && q.open != null && q.high != null && q.low != null)
            .map((q) => ({
                date: new Date(q.date),
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume ?? 0,
            }));
    } catch (error) {
        console.warn(`Historical fetch failed for ${ticker}: `, error);
        return [];
    }
}
export async function fetchHistoricalBatch(
    tickers: string[],
    months: number = 6
): Promise<Record<string, OHLCV[]>> {

    const result: Record<string, OHLCV[]> = {};

    for (const ticker of tickers) {
        console.log(`Fetching history for ${ticker}...`);
        result[ticker] = await fetchHistoricalData(ticker, months);
        console.log(`${ticker}: ${result[ticker].length} data points`);
    }
    return result;
}