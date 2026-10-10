import YahooFinance from "yahoo-finance2";


const yahooFinance = new YahooFinance();



export interface FiiDiiData {
    fii: { buy: NumberConstructor, sell: number; net: number };
    dii: { buy: NumberConstructor, sell: number; net: number };
    sentimentScore?: number;
    date?: string;
}

export async function fetchFiiDii(): Promise<FiiDiiData | null> {
    try {

        const res = await fetch('https://fii-diidata.mrchartist.com/api/data');
        if (!res.ok) return null;
        const d: any = await res.json();

        return {
            fii: { buy: d.fii_buy ?? d.fb ?? 0, sell: d.fii_sell ?? d.fs ?? 0, net: d.fii_net ?? d.fn ?? 0 },
            dii: { buy: d.dii_buy ?? d.db ?? 0, sell: d.dii_sell ?? d.ds ?? 0, net: d.dii_net ?? d.dn ?? 0 },
            sentimentScore: d.sentiment_score,
            date: d.date ?? d.d

        }
    } catch (error) {

        console.warn('FII/DII fetch failed');
        return null;

    }
}

export function formatFiiDii(data: FiiDiiData): string {
    const fDir = data.fii.net >= 0 ? 'NET BUYERS ✅' : 'NET SELLERS ⚠️';
    const dDir = data.dii.net >= 0 ? 'NET BUYERS ✅' : 'NET SELLERS ⚠️';

    return `FII: ${fDir} (Rs.${Math.abs(data.fii.net).toFixed(0)} Cr) | DII: ${dDir} (Rs.${Math.abs(data.dii.net).toFixed(0)} Cr)`
}


//  =============== EARNINGS CALENDAR ======================

export interface EarningsInfo {
    ticker: string;
    earningsDate: string | null;
    daysUntilEarnings: number | null;
    isUpcoming: boolean;
}

export async function fetchEarningsInfo(ticker: string): Promise<EarningsInfo> {
    try {
        const quote = await yahooFinance.quote(ticker);
        const ts = quote.earningsTimestamp ?? quote.earningsCallTimestampStart;

        if (!ts) return { ticker, earningsDate: null, daysUntilEarnings: null, isUpcoming: false };

        const date = new Date(ts * 1000);
        const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return {
            ticker,
            earningsDate: date.toLocaleDateString('en-IN'),
            daysUntilEarnings: days,
            isUpcoming: days >= 0 && days <= 7
        }

    } catch (error) {
        console.warn('Error in Fetching Earnings Info ');
        return { ticker, earningsDate: null, daysUntilEarnings: null, isUpcoming: false }
    }
}

//  =============== BATCH FETCH ==================

export async function fetchMarketData(tickers: string[]): Promise<{ fiiDii: FiiDiiData | null; earnings: Record<string, EarningsInfo>; }> {

    console.log('Fetching market data (FII/DII + earnings) ...');

    const fiiDii = await fetchFiiDii();
    if (fiiDii) console.log(`${formatFiiDii(fiiDii)}`);

    const earnings: Record<string, EarningsInfo> = {};

    for (const ticker of tickers) {
        const info = await fetchEarningsInfo(ticker);
        earnings[ticker] = info;
        if (info.isUpcoming) {
            console.log(`${ticker}: earnings in ${info.daysUntilEarnings} days (${info.earningsDate})`);
        }
    }

    return { fiiDii, earnings }
}