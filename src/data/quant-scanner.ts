import YahooFinance from "yahoo-finance2";
import { MAX_PRICE_PER_STOCK } from "../config";
import { CandidateStock } from "../types";



const yahooFinance = new YahooFinance();

interface ScanResult {
    ticker: string;
    price: number;
    changePercent: number;
    volumeRatio: number;
    nearHighPercent: number;
    signals: string[];
    signalScore: number;
}


async function scanStock(ticker: string): Promise<ScanResult | null> {
    try {
        const quote = await yahooFinance.quote(ticker, {}, { validateResult: false }) as any;
        const price = quote.regularMarketPrice ?? 0;
        if (price === 0 || price > MAX_PRICE_PER_STOCK) return null;
        const change = quote.regularMarketChangePercent ?? 0;
        const volume = quote.regularMarketVolume ?? 0;
        const avgVol = quote.averageDailyVolume3Month ?? 0;
        const high52 = quote.fiftyTwoWeekHigh ?? 0;
        const low52 = quote.fiftyTwoWeekLow ?? 0;
        const volRatio = avgVol > 0 ? volume / avgVol : 0;
        const nearHigh = high52 > 0 ? (price / high52) * 100 : 0;

        const signals: string[] = [];
        let score = 0;

        // Signal 1 
        if (Math.abs(change) >= 3) {
            signals.push(`${change >= 0 ? '🚀' : '💥'} ${change >= 0 ? '+' : ''}${change.toFixed(1)}% today`);
            score += Math.abs(change);
        }

        // Signal 2: 52 week high breakout
        if (nearHigh >= 95 && volRatio > 1.2) {
            signals.push(`📈 Near 52W HIGH (${nearHigh.toFixed(0)}%, vol ${volRatio.toFixed(1)}x)`);
            score += 15;
        }

        // Signal 4 Bouncing from 52W low
        if (nearHigh <= 20 && change > 2) {
            signals.push(`🔁 Bounce from 52W low (+${change.toFixed(1)}%)`);
            score += 10;
        }

        // Signal 3: Volume explosion ( > 2x average)
        if (volRatio >= 2) {
            signals.push(`📊 Volume ${volRatio.toFixed(1)}x avg`);
            score += volRatio * 2;
        }

        // Signal 5: Strong momentum (up > 5%)

        if (change >= 5) {
            signals.push(`⚡ Strong momentum +${change.toFixed(1)}%`);
            score += change;
        }

        if (signals.length === 0) return null;

        return {
            ticker, price, changePercent: change, volumeRatio: volRatio, nearHighPercent: nearHigh, signals, signalScore: score
        }

    } catch (error: any) {
        console.warn('Error in Quant Scanner', error.message);
        return null;
    }
}

export async function runQuantScanner(allTickers: string[]): Promise<CandidateStock[]> {
    console.log(`Quant scanner: scanning ${allTickers.length} stocks...`);

    const CHUNK_SIZE = 20;
    const results: ScanResult[] = [];

    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
        const chunk = allTickers.slice(i, i + CHUNK_SIZE);

        // Scan chunk in parallel (within chunk)
        const chunkResults = await Promise.all(chunk.map(t => scanStock(t)));
        for (const r of chunkResults) {
            if (r) results.push(r);
        }

        if ((i + CHUNK_SIZE) % 200 === 0 || i + CHUNK_SIZE >= allTickers.length) {
            console.log(`${Math.min(i + CHUNK_SIZE, allTickers.length)}/${allTickers.length} scanned, ${results.length} with signals`);
        }
    }

    results.sort((a, b) => b.signalScore - a.signalScore);

    const top = results.slice(0, 15);

    if (top.length > 0) {
        console.log(`Scanner found ${results.length} stocks with signals. Top ${top.length}:`);
        top.forEach(r => {
            console.log(`${r.ticker}: Rs.${r.price.toFixed(0)} - ${r.signals.join(' | ')}`);
        })
    } else {
        console.log('Scanner: no strong signals found');
    }


    return top.map(r => ({
        ticker: r.ticker,
        source: 'top_mover' as const,
        reason: r.signals.join(', ')
    }))
}

