import YahooFinance from "yahoo-finance2";
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'


const yahooFinance = new YahooFinance();
const PLAN_FILE = path.join(process.cwd(), 'data', 'trade-plan.json');

interface PlannedTrade {
    ticker: string;
    companyName: string;
    plannedEntry: number;
    targetPrice: number;
    stopLoss: number;
    action: string;
    confidence: number;
    buyProbability: number;
    holdingPeriod: string;
    planTime: string;
}

interface ConfirmedTrade extends PlannedTrade {
    livePrice: number;
    gapPercent: number;
    status: 'CONFIRMED' | 'CAUTION' | 'CANCELLED';
    reason: string;
    adjustedEntry: number;
    adjustedTarget: number;
    adjustStopLoss: number;
}

async function main(): Promise<void> {
    console.log(`Stock Sage - Trade Confiramtion (Phase B)\n`);

    if (!fs.existsSync(PLAN_FILE)) {
        console.error('No trade plan found. Run "npm run plan" first (Phase A)');
        process.exit(1)

    }

    const plan: PlannedTrade[] = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));

    if (plan.length === 0) {
        console.log('No trades in plan. Nothing to confirm.');
        process.exit(0);
    }


    console.log(`Checking ${plan.length} planned trades againest LIVE prices...\n`);

    const confirmed: ConfirmedTrade[] = [];

    for (const trade of plan) {
        try {
            const quote = await yahooFinance.quote(trade.ticker, {}, { validateResult: false });
            const livePrice = quote.regularMarketPrice ?? 0;

            if (livePrice === 0) {
                console.log(`⚠️ ${trade.ticker}: could not fetch live price -SKIP`);
                continue;
            }

            const gapPercent = ((livePrice - trade.plannedEntry) / trade.plannedEntry) * 100;

            // Determine status based on gap size
            let status: ConfirmedTrade['status'];
            let reason: string;

            if (livePrice <= trade.stopLoss) {
                // Price already below stop loss - gap killed the trade
                status = 'CANCELLED';
                reason = `Gap ${gapPercent.toFixed(1)}% -> price Rs.${livePrice.toFixed(2)} already below SL Rs.${trade.stopLoss.toFixed(2)}`;
            } else if (Math.abs(gapPercent) <= 2) {
                //  Within 2% of plan - safe to proceed
                status = 'CONFIRMED';
                reason = `Gap ${gapPercent >= 0 ? '+' : ''}${gapPercent.toFixed(1)}% - within tolerance`;
            } else if (Math.abs(gapPercent) <= 4) {
                //  Within 2% of plan - safe to proceed
                status = 'CAUTION';
                reason = `Gap ${gapPercent >= 0 ? '+' : ''}${gapPercent.toFixed(1)}% - larger than expected, review`;
            } else {
                //  Within 2% of plan - safe to proceed
                status = 'CANCELLED';
                reason = `Gap ${gapPercent >= 0 ? '+' : ''}${gapPercent.toFixed(1)}% - too large, setup invalid`;
            }

            const targetPercent = ((trade.targetPrice - trade.plannedEntry) / trade.plannedEntry) * 100;
            const slPercent = ((trade.plannedEntry - trade.stopLoss) / trade.plannedEntry) * 100;

            confirmed.push({
                ...trade,
                livePrice,
                gapPercent,
                status,
                reason,
                adjustedEntry: livePrice,
                adjustedTarget: livePrice * (1 + targetPercent / 100),
                adjustStopLoss: livePrice * (1 - slPercent / 100)
            })
        } catch (error) {
            console.warn(`Failed to check ${trade.ticker}: `, error);
        }
    }

    console.log('='.repeat(40));
    console.log(' TRADE CONFIRMATION - LIVE MARKET');
    console.log('='.repeat(60));


    for (const trade of confirmed) {
        const icon = trade.status === 'CONFIRMED' ? '✅' : trade.status === 'CAUTION' ? '⚠️' : '❌';

        console.log(`\n ${icon} ${trade.status}: ${trade.ticker} - ${trade.companyName}`);
        console.log(`Plan: Rs.${trade.plannedEntry.toFixed(2)} (previos close)`);
        console.log(`Live: Rs.${trade.livePrice.toFixed(2)} (${trade.gapPercent >= 0 ? '+' : ''}${trade.gapPercent.toFixed(1)}% gap)`);
        console.log(`${trade.reason}`);

        if (trade.status === 'CONFIRMED' || trade.status === 'CAUTION') {
            console.log(`Adjusted Entry: Rs.${trade.adjustedEntry.toFixed(2)}`);
            console.log(`Adjusted Target: Rs.${trade.adjustedTarget.toFixed(2)}`);
            console.log(`Adjusted Stop Loss: Rs.${trade.adjustStopLoss.toFixed(2)}`);
        }
    }

    const confirmedCount = confirmed.filter(t => t.status === 'CONFIRMED').length;
    const cautionCount = confirmed.filter(t => t.status === 'CAUTION').length;
    const cancelledCount = confirmed.filter(t => t.status === 'CANCELLED').length;

    console.log(`\n Summary: ${confirmedCount} ✅ confirmed | ${cautionCount} ⚠️ caution | ${cancelledCount} ❌ cancelled`);
    console.log('='.repeat(60) + '\n');


}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
})