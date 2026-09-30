import { Recommendation } from "./types";



export function displayResults(recommendations: Recommendation[]): void {
    const date = new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })

    console.log('\n' + '='.repeat(60));
    console.log(` STOCK SAGE v0.2 - Recommendations (${date})`);
    console.log('='.repeat(60));

    if (recommendations.length === 0) {
        console.log(`\n No confident recommendations today.`);
        console.log(' The agent did not find strong enough signals to act on.')
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
        console.log(` Action:  ${rec.action} (Jev confidence: ${rec.confidence}%)`);
        console.log(` Holding: ${rec.holdingPeriod}`)
        console.log(` Risk: ${rec.riskLevel}`)
        console.log(` Sentiment: ${rec.sentiment}`)
        console.log(` Jev Probs: ${probDisplay}`);
        console.log();
        console.log(` Price:  Rs.${rec.currentPrice.toFixed(2)}`);
        console.log(` Target:  Rs.${rec.targetPrice.toFixed(2)} (${targetChange}%)`);
        console.log(` Stop Loss: Rs.${rec.stopLoss.toFixed(2)} (${slChange})`)
        console.log();
        console.log(' BULL Case: ')
        rec.bullCase.forEach((b) => console.log(` +${b}`));
        console.log();
        console.log(' BEAR Case:');
        rec.bearCase.forEach((b) => console.log(` - ${b}`));
        console.log();
        console.log(` News Impact: ${rec.newsImpact}`);
        console.log();
        console.log(` Thesis: ${rec.thesis}`);
        console.log(` ` + '='.repeat(40))
    })

    console.log('\n Disclaimer: This is an AI-generated analysis, NOT financial advice.')
    console.log(' Always do your own research before trading. \n');
}