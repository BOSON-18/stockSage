
export interface Holding {
    ticker: string;
    companyName: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnlPercent: number;
    sector: string;
}

export interface PortfolioSummary {
    holdings: Holding[];
    totalInvested: number;
    totalCurrent: number;
    overallPnlPercent: number;
    availableCash: number;
}

export interface SanitizedPortfoilio {
    holdingSummaries: {
        ticker: string;
        profitOrLoss: string;
        sizeCategory: string;
    }[];
    overallStatus: string;
    existingTickers: string[],
    existingSectors: string[]
}