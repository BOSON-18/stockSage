import YahooFinance from "yahoo-finance2";
import { safeLog } from "../security/sanitizer";
import { Holding, PortfolioSummary } from "../types";


const GROWW_API_KEY = process.env.GROWW_API_KEY || '';
const GROWW_API_SECRET = process.env.GROWW_API_SECRET || '';

const yahooFinance = new YahooFinance()

function hasCredentials(): boolean {
    return GROWW_API_KEY.length > 0 && GROWW_API_SECRET.length > 0
}

export async function fetchPortfolio(): Promise<PortfolioSummary | null> {

    if (!hasCredentials()) {
        console.log(' No Groww credentials - running wihtout portfolio context');
        return null;
    }

    try {
        safeLog('Connecting to Groww (read-only)...');
        const growwModule = await import('growwapi');
        const GrowwAPI = growwModule.GrowwAPI ?? growwModule.default ?? growwModule;

        const groww = new GrowwAPI();


        const holdingsData = await groww.holdings.list().catch(() => null);



        if (!holdingsData) {
            console.warn('Groww Holdings fetch failed');
            return null;

        }

        const rawHoldings = Array.isArray(holdingsData)
            ? holdingsData
            : (holdingsData as any)?.data ?? [];

        if (rawHoldings.length === 0) {
            console.log('No holdings found in Groww Account.')
            return { holdings: [], totalInvested: 0, totalCurrent: 0, overallPnlPercent: 0, availableCash: 0 };
        }

        console.log(`Enriching ${rawHoldings.length} holdings with live prices... `);
        // console.log('Raw Holding', rawHoldings)


        const holdings: Holding[] = [];

        for (const h of rawHoldings) {
            const symbol = h.tradingSymbol ?? h.symbol ?? '';
            if (!symbol) continue;

            const ticker = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
            const qty = h.quantity ?? 0;
            const avgPrice = h.averagePrice ?? h.avgPrice ?? 0;

            let currentPrice = 0;
            let sector = 'Unknown';

            try {
                const quote = await yahooFinance.quote(ticker, {}, { validateResult: false }) as any;
                currentPrice = quote.regularMarketPrice ?? 0;
                sector = quote?.assetProfile?.sector ?? quote.sector ?? quote.industry ?? 'Unknown';
            } catch (error) {
                currentPrice = avgPrice;
            }

            const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

            // console.log('Checking : ', sector, ' ', currentPrice, ' ', qty, ' ', avgPrice);

            holdings.push({
                ticker,
                companyName: h.companyName ?? symbol,
                quantity: qty,
                avgPrice,
                currentPrice,
                pnlPercent,
                sector
            });



        }

        let availableCash = 0;
        try {
            const marginsData = await groww.margins.details().catch(() => null);
            // console.log('margins Data: ', marginsData)
            availableCash = (marginsData as any)?.availableCash ?? (marginsData as any)?.clearCash ?? (marginsData as any)?.availableMargin ?? (marginsData as any)?.data?.availableCash ?? 0;
        } catch (error) {

        }




        // const holdings: Holding[] = (holdingsData as any[]).map((h: any) => ({
        //     ticker: `${h.symbol ?? h.tradingSymbol ?? 'UNKNOWN'}.NS`,
        //     companyName: h.companyName ?? h.symbol ?? 'Unknown',
        //     quantity: h.quantity ?? 0,
        //     avgPrice: h.averagePrice ?? h.avgPrice ?? 0,
        //     currentPrice: h.lastTradedPrice ?? h.ltp ?? 0,
        //     pnlPercent: h.pnlPercentage ?? (
        //         h.averagePrice > 0 ? ((h.lastTradedPrice - h.averagePrice) / h.averagePrice) * 100 : 0
        //     ),
        //     sector: h.sector ?? h.industry ?? 'Unknown'
        // }))

        const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avgPrice), 0);
        const totalCurrent = holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
        const overallPnlPercent = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

        // const availableCash = (marginsData as any)?.availableCash ?? (marginsData as any)?.availableMargin ?? 0;

        const summary: PortfolioSummary = {
            holdings,
            totalInvested,
            totalCurrent,
            overallPnlPercent,
            availableCash
        }

        safeLog(`Portfolio: ${holdings.length} holdings, overalPnL ${overallPnlPercent >= 0 ? '+' : ''}${overallPnlPercent.toFixed(1)}%`);

        return summary;
    } catch (error) {
        console.warn('Groww API error - running without portfolio context')
        return null;
    }
}

