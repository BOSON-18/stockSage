

export interface OHLCV {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface TechnicalIndicators {

    rsi: number;
    rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';

    macdLine: number;
    signalLine: number;
    histogram: number;
    macdSignal: 'BULLISH_CROSSOVER' | 'BEARISH_CROSSOVER' | 'NEUTRAL';

    bollingerUpper: number;
    bollingerMiddle: number;
    bollingerLower: number;
    bollingerPosition: 'UPPER' | 'LOWER' | 'MIDDLE';
    bollingerSqueeze: boolean;

    nearestSupport: number;
    nearestResistance: number;
    supportDistance: number;  // % distance from current price to support
    resistanceDistance: number; // % distance from current price to resistance

    atr: number; // average True Range (absolute)
    atrPercent: number; // ATR as % of current price
}