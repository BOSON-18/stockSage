import { z } from "zod";

// STOCK DATA FROM YAHOO

export interface StockSnapshot {
    ticker: string;
    companyName: string;
    price: number;
    changePercent: number;
    pe: number | null; // null hwne stock has no earning
    marketCap: number;
    volume: number;
    avgVolume: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyDayAvg: number;
    twoHundredDayAvg: number;
}


// A stock discovered from news/movers/watchlist - before analysis

export interface CandidateStock {
    ticker: string,
    source: 'news' | 'top_mover' | 'watchlist',
    reason: string
}