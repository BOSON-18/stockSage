

// COMPUTE ALL indicator for one stock
//  Orchestorator - calls each indicator function, assembles the result
//  If not enough data for an indiactor use safe defaults

import { OHLCV, TechnicalIndicators } from "../types";
import { computeATR, computeBollinger, computeMACD, computeRSI } from "./indicators";
import { findnearestLevels, findSupportResistance } from "./support-resistance";


const DEFAULT_INDICATORS: TechnicalIndicators = {

    rsi: 50,
    rsiSignal: 'NEUTRAL',
    macdLine: 0,
    signalLine: 0,
    histogram: 0,
    macdSignal: 'NEUTRAL',
    bollingerUpper: 0,
    bollingerMiddle: 0,
    bollingerLower: 0,
    bollingerPosition: 'MIDDLE',
    bollingerSqueeze: false,
    nearestSupport: 0,
    nearestResistance: 0,
    supportDistance: 0,
    resistanceDistance: 0,
    atr: 0,
    atrPercent: 0
}

export function computeAllIndicators(
    ohlcv: OHLCV[],
    currentPrice: number
): TechnicalIndicators {

    //  Need at least 30 data points for meaningful indicators
    if (ohlcv.length < 30) {
        console.warn('Not enough historical data - using default indicators')
        return DEFAULT_INDICATORS;
    }

    const closes = ohlcv.map((bar) => bar.close);
    const highs = ohlcv.map((d) => d.high);
    const lows = ohlcv.map((d) => d.low);

    //  RSI
    const rsi = computeRSI(closes);
    const rsiSignal: TechnicalIndicators['rsiSignal'] = rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL';

    // MACD
    const macd = computeMACD(closes);
    let macdSignal: TechnicalIndicators['macdSignal'] = 'NEUTRAL';
    if (macd.histogram > 0 && macd.macdLine > macd.signalLine) macdSignal = 'BULLISH_CROSSOVER'
    else if (macd.histogram < 0 && macd.macdLine < macd.signalLine) macdSignal = 'BEARISH_CROSSOVER';

    //  Bollinger Bands
    const bollinger = computeBollinger(closes);
    let bollingerPosition: TechnicalIndicators['bollingerPosition'] = 'MIDDLE';
    if (bollinger.upper > 0) {
        const range = bollinger.upper - bollinger.lower;
        const posInband = currentPrice - bollinger.lower;

        if (range > 0) {
            const percentInBand = posInband / range;
            if (percentInBand > 0.8) bollingerPosition = 'UPPER';
            else if (percentInBand < 0.2) bollingerPosition = "LOWER";
        }

    }


    //  ATR
    const atr = computeATR(highs, lows, closes);
    const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

    // Support And Resistance
    const { supports, resistances } = findSupportResistance(ohlcv);
    const levels = findnearestLevels(currentPrice, supports, resistances);

    return {
        rsi: rsi,
        rsiSignal: rsiSignal,
        macdLine: macd.macdLine,
        signalLine: macd.signalLine,
        histogram: macd.histogram,
        macdSignal: macdSignal,
        bollingerUpper: bollinger.upper,
        bollingerMiddle: bollinger.middle,
        bollingerLower: bollinger.lower,
        bollingerPosition: bollingerPosition,
        bollingerSqueeze: bollinger.squeeze,
        nearestSupport: levels.nearestSupport,
        nearestResistance: levels.nearestResistance,
        supportDistance: levels.supportDistance,
        resistanceDistance: levels.resistanceDistance,
        atr: atr,
        atrPercent: atrPercent
    }

}