import { redactURL } from "openai/internal/utils/log";
import YahooFinance from "yahoo-finance2";


const yahooFinance = new YahooFinance();


export interface StockFinancials {
    ticker: string;
    // Earnings
    revenueGrowthYoy: number | null;
    earningsGrowthYoy: number | null;
    profitMargin: number | null;
    operatingMargin: number | null;
    // balance Sheet
    debtToEquity: number | null;
    currentRatio: number | null;
    returnOnEquity: number | null;
    // Dividends
    dividendYield: number | null;
    // Analyst
    targetMeanPrice: number | null;
    recommendationMean: number | null;
    numberOfAnalysts: number | null

}


export async function fetchFinancials(ticker: string): Promise<StockFinancials | null> {
    try {
        const summary = await yahooFinance.quoteSummary(ticker, {
            modules: ['financialData', 'defaultKeyStatistics']
        }) as any;

        const fin = summary?.financialData ?? {};
        const stats = summary?.defaultKeyStatistics;

        return {
            ticker,
            revenueGrowthYoy: fin.regularGrowth ?? null,
            earningsGrowthYoy: fin.earningsGrowthYoy ?? null,
            profitMargin: fin.profitMargins ?? null,
            operatingMargin: fin.operatingMargins ?? null,
            debtToEquity: fin.debtToEquity ?? null,
            currentRatio: fin.currentRatio ?? null,
            returnOnEquity: fin.returnOnEquity ?? null,
            dividendYield: stats.dividendYield ?? fin.dividendYield ?? null,
            targetMeanPrice: fin.targetMeanPrice ?? null,
            recommendationMean: fin.recommendationMean ?? null,
            numberOfAnalysts: fin.numberOfAnalystOpinions ?? null

        }
    }
    catch (err) {
        console.error(`Failed to fetch financials for ${ticker}:`, err);
        return null;
    }
}

export async function fetchFinancialsBatch(tickers: string[]): Promise<Record<string, StockFinancials>> {

    const result: Record<string, StockFinancials> = {};

    for (const ticker of tickers) {
        console.log(`Financials for ${ticker}...`);
        const fin = await fetchFinancials(ticker);
        if (fin) result[ticker] = fin;


    }

    return result;
}



export function formatFinancialsForPrompt(fin: StockFinancials): string {
    const lines: string[] = [];

    if (fin.revenueGrowthYoy !== null) lines.push(`Revenue Growth: ${(fin.revenueGrowthYoy * 100).toFixed(1)}% YoY`);
    if (fin.earningsGrowthYoy !== null) lines.push(`Earnings Growth: ${(fin.earningsGrowthYoy * 100).toFixed(1)}% YoY`);

    // Margins
    if (fin.profitMargin !== null) lines.push(`Profit Margin: ${(fin.profitMargin * 100).toFixed(1)}%`);
    if (fin.operatingMargin !== null) lines.push(`Operating Margin: ${(fin.operatingMargin * 100).toFixed(1)}%`);

    // Balance Sheet
    if (fin.debtToEquity !== null) lines.push(`Debt-to-Equity: ${fin.debtToEquity.toFixed(2)} ${fin.debtToEquity > 1 ? '⚠️ High Leverage' : '✅'}`);
    if (fin.currentRatio !== null) lines.push(`Current Ratio: ${fin.currentRatio.toFixed(2)} ${fin.currentRatio < 1 ? '⚠️ Liquidity Risk' : '✅'}`);

    // Profitability
    if (fin.returnOnEquity !== null) lines.push(`Return on Equity (ROE): ${(fin.returnOnEquity * 100).toFixed(1)}%`);

    // Dividends
    if (fin.dividendYield !== null && fin.dividendYield > 0) {
        lines.push(`Dividend Yield: ${(fin.dividendYield * 100).toFixed(2)}%`);
    }

    if (fin.targetMeanPrice && fin.targetMeanPrice > 0) {
        lines.push(`Analyst Target Price: ₹${fin.targetMeanPrice.toFixed(2)} `);
    }
    // Analyst Sentiment
    if (fin.recommendationMean !== null && fin.numberOfAnalysts && fin.numberOfAnalysts > 0) {
        const rating = fin.recommendationMean <= 1.5 ? 'Strong Buy' : fin.recommendationMean <= 2.5 ? 'Buy' : fin.recommendationMean <= 3.5 ? 'Hold' : fin.recommendationMean <= 4.5 ? 'Sell' : 'Strong Sell';
        lines.push(`Analyst rating: ${rating} (${fin.recommendationMean.toFixed(1)}/5 from ${fin.numberOfAnalysts} analysts)`);
    }


    return lines.length > 0 ? lines.join('\n') : 'No financial data available';
}