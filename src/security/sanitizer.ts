import { PortfolioSummary, SanitizedPortfoilio } from "../types";


function getSizeCategory(quantity: number, currentPrice: number): string {

    const value = quantity * currentPrice;

    if (value < 500) return 'very small position';
    if (value < 2000) return 'small position';
    if (value < 10000) return 'medium posiiton';
    return 'large position';
}


export function sanitizePortfolio(summary: PortfolioSummary): SanitizedPortfoilio {

    const holdingSummaries = summary.holdings.map((h) => ({
        ticker: h.ticker,
        profitOrLoss: `${h.pnlPercent >= 0 ? 'in profit' : 'at loss'} ~ ${Math.abs(h.pnlPercent).toFixed(0)}%`,
        sizeCategory: getSizeCategory(h.quantity, h.currentPrice)
    }));

    const roundedCash = Math.round(summary.availableCash / 100) * 100;

    const overallDirection = summary.overallPnlPercent >= 0 ? 'up' : 'down';
    const overallStatus = `portfolio ${overallDirection} ~${Math.abs(summary.overallPnlPercent).toFixed(0)}%, ~Rs.${roundedCash} cas available, ${summary.holdings.length} holdings`;

    const existingTickers = summary.holdings.map((h) => h.ticker);
    const existingSectors = [...new Set(summary.holdings.map((h) => h.sector))];

    return {
        holdingSummaries,
        overallStatus,
        existingTickers,
        existingSectors
    }
}


const SENSITIVE_KEYS = ['api_key', 'apiKey', 'api_secret', 'apisecret', 'password', 'token', 'authorization', 'secret'];

export function safeLog(message: string, data?: any): void {
    if (!data) {
        console.log(message);
        return;
    }

    if (typeof data === 'object') {
        const safe = { ...data };
        for (const key of Object.keys(safe)) {
            if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
                safe[key] = '***REDACTED***'
            }
        }
        console.log(message, safe);
    } else {
        console.log(message, data)
    }
}