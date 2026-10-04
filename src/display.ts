import { maxLength } from "zod";
import { MAX_STOCKS, PER_STOCK_BUDGET, TOTAL_BUDGET } from "./config";
import { MarketContext, Recommendation, TechnicalIndicators } from "./types";
import { VerfiedClaim } from "./ai/verifier";



export function displayResults(recommendations: Recommendation[], marketContext?: MarketContext, indicators?: Record<string, TechnicalIndicators>, verificationMap?: Record<string, VerfiedClaim[]>): void {
    const date = new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })

    console.log('\n' + '='.repeat(60));
    console.log(` STOCK SAGE v0.5 - Recommendations (${date})`);
    console.log('='.repeat(60));

    if (marketContext) {
        console.log(` Market: ${marketContext.regime} (Nifty ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}%)`)
    }

    console.log(`Budget: Rs.${TOTAL_BUDGET} | MAX ${MAX_STOCKS} stocks | Rs.${PER_STOCK_BUDGET}/stock`)

    console.log('='.repeat(60));


    if (recommendations.length === 0) {
        console.log(`\n No confident recommendations today.`);
        console.log(' The committee did not find strong enough signals to act on.')
        console.log(' This is better than a bad recommendation. \n')
        return;
    }

    recommendations.forEach((rec, index) => {
        const targetChange = (
            ((rec.targetPrice - rec.currentPrice) / rec.currentPrice) * 100
        ).toFixed(1);

        const slChange = (
            ((rec.stopLoss - rec.currentPrice) / rec.currentPrice) * 100
        ).toFixed(1);

        const probDisplay = Object.entries(rec.jevProbabilities).map(([action, prob]) => `${action}: ${(prob * 100).toFixed(0)}%`).join(' |')

        console.log(`\n #${index + 1} ${rec.ticker}-${rec.companyName}`);
        console.log(' ' + '-'.repeat(40))


        //  Committee verdicts 
        if (rec.committeeVerdicts && rec.committeeVerdicts.length > 0) {
            console.log('COMMITTEE:');
            rec.committeeVerdicts.forEach((v: any) => {
                const icon = v.sentiment === 'BULLISH' ? '🟢' : v.sentiment === 'BEARISH' ? '🔴' : v.sentiment === 'CAUTION' ? '🟡' : '⚪️';
                console.log(` ${icon} ${v.agent ?? 'AGENT'}:  ${v.sentiment} ${v.confidence}% - ${v.reasoning}`);

            })
            console.log();
        }
        console.log('JEV DECISION: ')
        console.log(` Action:  ${rec.action} (Jev confidence: ${rec.confidence}%)`);
        console.log(` Holding: ${rec.holdingPeriod}`)
        console.log(` Risk: ${rec.riskLevel}`)
        // console.log(` Sentiment: ${rec.sentiment}`)
        console.log(` Jev Probs: ${probDisplay}`);
        console.log();

        const qty = Math.floor(PER_STOCK_BUDGET / rec.currentPrice);
        const investment = qty * rec.currentPrice;
        const potentialProfit = qty * (rec.targetPrice - rec.currentPrice);
        const maxLoss = qty * (rec.currentPrice - rec.stopLoss);

        console.log(` Price:  Rs.${rec.currentPrice.toFixed(2)}`);
        console.log(`Qty: ${qty} shares | Investment: Rs.${investment.toFixed(0)}`)
        console.log(` Target:  Rs.${rec.targetPrice.toFixed(2)} (${targetChange}%) | Profit: Rs. ${potentialProfit.toFixed(0)}`);
        console.log(` Stop Loss: Rs.${rec.stopLoss.toFixed(2)} (${slChange}) | Max Loss: Rs.${maxLoss.toFixed(0)} `)

        // Technical indicator v0.5
        const ind = indicators?.[rec.ticker];
        if (ind) {
            const rr = rec.stopLoss > 0 ? ((rec.targetPrice - rec.currentPrice) / (rec.currentPrice - rec.stopLoss)).toFixed(1) : 'N/A';
            console.log();

            console.log('TECHNICALS:');
            console.log(`RSI: ${ind.rsi.toFixed(1)} (${ind.rsiSignal})`);
            console.log(`MACD: ${ind.macdSignal} (histogram: ${ind.histogram.toFixed(2)})`);
            console.log(`Bollinger: ${ind.bollingerPosition} band${ind.bollingerSqueeze ? ' - SQUEEZE detected' : ''}`);
            if (ind.nearestSupport > 0 || ind.nearestResistance > 0) {
                console.log(`Support: Rs.${ind.nearestSupport.toFixed(2)} (${ind.supportDistance.toFixed(1)}% below)`);
                console.log(`Resistance: Rs.${ind.nearestResistance.toFixed(2)} (${ind.resistanceDistance.toFixed(1)}% above)`);

            }
            console.log(`ATR: Rs.${ind.atr.toFixed(2)} (${ind.atrPercent.toFixed(1)}% daily volatility)`)
            console.log(`Risk/Reward: ${rr}:1`);
        }

        if (rec.newsContext && rec.newsContext.length > 0) {
            console.log();
            console.log('NEWS CONTEXT: ');
            rec.newsContext.forEach((n) => console.log(` . ${n}`))
        }


        const claims = verificationMap?.[rec.ticker];
        if (claims && claims.length > 0) {
            console.log();
            console.log('CLAIM VERIFICATION:');
            claims.forEach((c) => {
                const icon = c.status === 'VERIFIED' ? '✅' : c.status === 'INFERRED' ? '⚠️' : '❌';
                console.log(`${icon} ${c.status}: ${c.claim}`)
            })
        }

        console.log(` ` + '='.repeat(40))
    })

    console.log('\n Disclaimer: This is an AI-generated analysis, NOT financial advice.')
    console.log(' Always do your own research before trading. \n');
}