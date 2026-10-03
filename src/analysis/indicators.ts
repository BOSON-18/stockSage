


// =======================================================
//                  SMA
//  ======================================================
export function computeSMA(data: number[], period: number): number {

    if (data.length < period) return 0;

    const slice = data.slice(-period); // take last N value
    return slice.reduce((sum, val) => sum + val, 0) / period;
}


// =====================================================
//                  EMA
// ========================================================
export function computeEMA(data: number[], period: number): number[] {

    if (data.length < period) return [];

    const multipler = 2 / (period + 1);
    const emaValues: number[] = [];

    const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues.push(firstSMA);

    //  Each subsequent EMA = (close x multiplier) + (prevEMA x (1-multiplier))
    for (let i = period; i < data.length; i++) {
        const prevEMA = emaValues[emaValues.length - 1];
        const newEMA = (data[i] * multipler) + (prevEMA * (1 - multipler));
        emaValues.push(newEMA)
    }

    return emaValues;

}

// =====================================================
//                  RSI
// ========================================================

export function computeRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50; // not enough data neutral

    //  Sterp 1: Calculate daily Changes (gain or loss)
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    // Step 2: First average gain and loss (simple average of first N periods)
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }

    avgGain /= period;
    avgLoss /= period;

    // Step 3: Smoothed averages for remaining period (Wilder's smoothing)
    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] > 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }

    //  Step 4 : RSI FORMULA

    if (avgLoss == 0) return 100;
    const rs = avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
}

// ==========================================================
//                 MACD ( Moving Average Converge Divergernce)
// ===========================================================

export function computeMACD(
    closes: number[],
    fastperiod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macdLine: number; signalLine: number; histogram: number } {

    const defaultResult = { macdLine: 0, signalLine: 0, histogram: 0 };

    if (closes.length < slowPeriod + signalPeriod) return defaultResult;

    // EMA(12) and EMA(26)
    const fastEMA = computeEMA(closes, fastperiod);
    const slowEMA = computeEMA(closes, slowPeriod);

    if (fastEMA.length === 0 || slowEMA.length === 0) return defaultResult;

    //  MACD Line  = fast-slowEMA
    // Alignment req - slow starts alter
    const offset = slowPeriod - fastperiod;
    const macdLine: number[] = [];
    for (let i = 0; i < slowEMA.length; i++) {
        macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }

    if (macdLine.length < signalPeriod) return defaultResult;

    const signalEMA = computeEMA(macdLine, signalPeriod);

    if (signalEMA.length === 0) return defaultResult;

    //  current values last element
    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalEMA[signalEMA.length - 1];

    return {
        macdLine: currentMACD,
        signalLine: currentSignal,
        histogram: currentMACD - currentSignal
    }

}


//  ======================
// Bollinger Bands - SMA(20)+-stdDev(2) Measures voilatiliy Squeeze = bands narrow = breakout coming
// ============================

export function computeBollinger(
    closes: number[],
    period: number = 20,
    stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number; squeeze: boolean } {
    const defaultResult = { upper: 0, middle: 0, lower: 0, squeeze: false };

    if (closes.length < period) return defaultResult;


    const recentCloses = closes.slice(-period);
    const middle = recentCloses.reduce((a, b) => a + b, 0) / period;

    // Standard Deviation
    const squaredDiffs = recentCloses.map((c) => Math.pow(c - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = middle + (stdDevMultiplier * stdDev);
    const lower = middle - (stdDevMultiplier * stdDev);

    //   Squeeze detecetion : bandwidth<20% of average badnwidth
    //  Bandwidth = (upper-lower)/middle

    const bandwidth = (upper - lower) / middle;

    //  Compute average bandwidth over the last 50 periods for comaprison
    let avgBandwidth = bandwidth;
    if (closes.length >= period + 50) {
        let totalBandwidth = 0;
        for (let i = closes.length - 50; i < closes.length; i++) {
            const slice = closes.slice(i - period, i);
            if (slice.length < period) continue;
            const m = slice.reduce((a, b) => a + b, 0) / period;
            const sd = Math.sqrt(slice.map((c) => Math.pow(c - m, 2)).reduce((a, b) => a + b, 0) / period);
            totalBandwidth += ((m + 2 * sd) - (m - 2 * sd)) / m;
        }
        avgBandwidth = totalBandwidth / 50;
    }

    const squeeze = bandwidth < (avgBandwidth * 0.5); // Current BW < 50% of avg
    return { upper, middle, lower, squeeze };

}


// ======================================================================
//                      ATR (Average True Range)
//  Volatility indicator capturing price range - useful for StopLoss
//      True Range = max of(H-L), |H - prevC|, |L - prevC|
//     ATR = average of True Range over N periods
// =======================================================================


export function computeATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): number {
    if (highs.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
        const highLow = highs[i] - lows[i];
        const highPrevClose = Math.abs(highs[i] - lows[i]);
        const lowerPrevClose = Math.abs(lows[i] - closes[i - 1]);
        trueRanges.push(Math.max(highLow, highPrevClose, lowerPrevClose));
    }

    //  FIRST ATR = simple average of first N true ranges

    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

    //  SMOOTHED ATR for remaining periods (Wilder's smoothing)

    for (let i = period; i < trueRanges.length; i++) {
        atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    }

    return atr;
}

