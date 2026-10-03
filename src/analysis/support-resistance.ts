
import { OHLCV } from "../types";


// =========================================================
//                   SUPPORT & RESISTANCE
//  Find price levels whre buyers/sellers historically appeared
// ===========================================================


//  A swing high = a bar whose high is higher than N bars before AND after
//  A swing low = a bar whose low is lower than N bars before AND after
//  lookback: how many bars on each side to check (default 5)

function findSwingPoints(
    ohlcv: OHLCV[],
    lookback: number = 5
): { highs: number[]; lows: number[] } {

    const highs: number[] = [];
    const lows: number[] = [];

    for (let i = lookback; i < ohlcv.length - lookback; i++) {
        let isSwingHigh = true;
        let isSwingLow = true;

        for (let j = 1; j <= lookback; j++) {
            //  Check if current bar's high is higher than neighbours
            if (ohlcv[i].high <= ohlcv[i - j].high || ohlcv[i].high <= ohlcv[i + j].high) {
                isSwingHigh = false;
            }

            //  Check if current bar's low is lower than neighbors
            if (ohlcv[i].low >= ohlcv[i - j].low || ohlcv[i].low >= ohlcv[i + j].low) {
                isSwingLow = false;
            }
        }

        if (isSwingHigh) highs.push(ohlcv[i].high);
        if (isSwingLow) lows.push(ohlcv[i].low);
    }
    return { highs, lows };
}


// Group nearby price levels together 
// If two levels are within  threshold% of each other, merge them(take average)
//  This avoid 10 resistance lines all at Rs 249,250,251

function groupNearbyLevels(levels: number[], thresholdPercent: number = 1.0): number[] {
    if (levels.length === 0) return [];

    const sorted = [...levels].sort((a, b) => a - b);
    const grouped: number[] = [];
    let currentGroup: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const groupAvg = currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length;
        const diff = Math.abs(sorted[i] - groupAvg) / groupAvg * 100;

        if (diff <= thresholdPercent) {
            //  close enough - add to current group
            currentGroup.push(sorted[i]);
        } else {
            // to far - save current group average start new group
            grouped.push(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
            currentGroup = [sorted[i]];
        }
    }
    grouped.push(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
    return grouped;
}


//  Find support and resistance levels from historical data
export function findSupportResistance(ohlcv: OHLCV[]): { supports: number[]; resistances: number[] } {

    if (ohlcv.length < 20) {
        return { supports: [], resistances: [] }
    }

    const { highs, lows } = findSwingPoints(ohlcv);

    return {
        supports: groupNearbyLevels(lows),
        resistances: groupNearbyLevels(highs)
    }

}



//  Find the nearest support below and resitance above the current price

export function findnearestLevels(
    currentPrice: number,
    supports: number[],
    resistances: number[]
): {
    nearestSupport: number;
    nearestResistance: number;
    supportDistance: number;
    resistanceDistance: number;
} {

    //  Nearest support = highest support level that's BELOW current price
    const supportsBelow = supports.filter((s) => s < currentPrice);
    const nearestSupport = supportsBelow.length > 0 ? Math.max(...supportsBelow) : 0;

    //  nearest Resitance = lowest resistance level that's ABOVE current price
    const resistancesAbove = resistances.filter((r) => r > currentPrice);
    const nearestResistance = resistancesAbove.length > 0 ? Math.min(...resistancesAbove) : 0;

    const supportDistance = nearestSupport > 0 ? ((currentPrice - nearestSupport) / currentPrice) * 100 : 0;
    const resistanceDistance = nearestResistance > 0 ? ((nearestResistance - currentPrice) / currentPrice) * 100 : 0;


    return {
        nearestSupport,
        nearestResistance,
        supportDistance,
        resistanceDistance
    }
}