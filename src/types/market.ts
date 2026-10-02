import { z } from "zod";

// Overall market condiution - 

export type MarketRegime = 'CALM' | 'VOLATILE' | 'CRASH_OR_RALLY';

export interface MarketContext {
    niftyPrice: number;
    niftyChangePercent: number;
    sensexChangePercent: number;
    regime: MarketRegime;
    upsideRange: { min: number; max: number };
    downsideRange: { min: number; max: number };
    jevGateThreshold: number;
}