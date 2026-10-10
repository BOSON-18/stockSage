import { StockFinancials } from "../data/financial-fetcher";
import { MarketContext, StockSnapshot, TechnicalIndicators } from "../types";
import { getJevProvider } from "./jev-procider";


interface AgentResult {
    ticker: string;
    agent: string;
    sentiment: string;
    confidence: number;
    expectedMovePercent: number;
    reasoning: string
}

export async function technicalAgentJev(
    stocks: StockSnapshot[],
    indicators: Record<string, TechnicalIndicators>
): Promise<AgentResult[]> {
    const jev = getJevProvider();
    const results: AgentResult[] = [];

    for (const stock of stocks) {
        const ind = indicators[stock.ticker];
        if (!ind) {
            results.push({
                ticker: stock.ticker, agent: 'TECHNICAL', sentiment: 'NEUTRAL',
                confidence: 0, expectedMovePercent: 0, reasoning: 'No technical data avaialble'
            });
            continue;
        }


        const signals: string[] = []
        if (ind.rsi < 30) signals.push(`RSI ${ind.rsi.toFixed(0)} oversold ✅`)
        else if (ind.rsi > 70) signals.push(`RSI ${ind.rsi.toFixed(0)} overbought ⚠️`)
        else signals.push(`RSI ${ind.rsi.toFixed(0)} neutral`)

        if (ind.macdSignal === 'BULLISH_CROSSOVER') signals.push('MACD bullish crossover ✅')
        else if (ind.macdSignal === 'BEARISH_CROSSOVER') signals.push('MACD bearish crossover ⚠️')
        else signals.push(`MACD neutral`)

        if (ind.bollingerPosition === 'LOWER') signals.push('price at lower bollinger band ✅')
        else if (ind.bollingerPosition === 'UPPER') signals.push('price at upper bollinger ⚠️')
        if (ind.bollingerSqueeze) signals.push('Bolliniger SQUEEZE - breakout coming')

        if (stock.price > stock.twoHundredDayAvg) signals.push('above 200DMA ✅')
        else signals.push('below 200DMA ⚠️')


        const volRatio = stock.avgVolume > 0 ? stock.volume / stock.avgVolume : 0;
        if (volRatio > 1.5) signals.push(`volume ${volRatio.toFixed(1)}x strong ✅`);

        if (ind.nearestSupport > 0 && ind.supportDistance < 3) signals.push(`near support Rs${ind.nearestSupport.toFixed(0)} ✅`);
        if (ind.nearestResistance > 0 && ind.resistanceDistance < 3) signals.push(`near resistance Rs${ind.nearestResistance.toFixed(0)} ⚠️`)

        const reasoning = signals.join(' | ');

        const context = `Stock ${stock.ticker}: ${reasoning}`;
        const verdict = await jev.choice(
            context,
            'based on these indicators, what is the outlook?',
            ['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION']
        );

        const confidence = await jev.noul(
            context,
            'How confident is this technical signal? (1.0 = very strong signals, 0.0 = conflicting signals'
        );

        const bullishCount = signals.filter(s => s.includes('✅')).length;
        const bearishCount = signals.filter(s => s.includes('⚠️')).length;
        const expectedMove = (bullishCount - bearishCount) * 1.2;

        results.push({
            ticker: stock.ticker,
            agent: 'TECHNICAL',
            sentiment: verdict.selected,
            confidence: Math.round(confidence.probability * 100),
            expectedMovePercent: expectedMove,
            reasoning
        })

    }
    return results;
}

export async function fundamentalAgentjev(
    stocks: StockSnapshot[],
    financials?: Record<string, StockFinancials>
): Promise<AgentResult[]> {

    const jev = getJevProvider();
    const results: AgentResult[] = [];

    for (const stock of stocks) {

        const signals: string[] = [];
        const fin = financials?.[stock.ticker];

        if (stock.pe !== null) {
            if (stock.pe < 15) signals.push(`PE ${stock.pe.toFixed(1)} - undervalued ✅`);
            else if (stock.pe < 30) signals.push(`PE ${stock.pe.toFixed(1)} - fair`);
            else signals.push(`PE ${stock.pe.toFixed(1)} - expensive ⚠️`);
        } else {
            signals.push(`PE N/A - loss making ⚠️`);
        }

        if (fin) {
            if (fin.revenueGrowthYoy !== null) signals.push(`Revenue Growth: ${(fin.revenueGrowthYoy * 100).toFixed(0)}% YoY${fin.revenueGrowthYoy > 0.1 ? '✅' : fin.revenueGrowthYoy < 0 ? '⚠️' : ''}`);
            if (fin.profitMargin !== null) signals.push(`Profit Margin ${(fin.profitMargin * 100).toFixed(0)}%${fin.profitMargin > 0.1 ? '✅' : '⚠️'}`);
            if (fin.debtToEquity !== null) signals.push(`Debt/Equity: ${fin.debtToEquity.toFixed(2)}${fin.debtToEquity < 1 ? '✅' : '⚠️ High debt'}`);
            if (fin.returnOnEquity !== null) signals.push(`ROE: ${(fin.returnOnEquity * 100).toFixed(0)}%${fin.returnOnEquity > 0 / 15 ? '✅' : ''}`)
            if (fin.recommendationMean !== null) {
                const rating = fin.recommendationMean <= 2.5 ? 'Buy ✅' : fin.recommendationMean <= 3.5 ? 'Hold' : 'Sell ⚠️';
                signals.push(`Analyst ${rating} (${fin.numberOfAnalysts ?? 0} analysts)`)
            }
        }

        const mktCapCr = stock.marketCap / 1e7;
        if (mktCapCr > 20000) signals.push(`Large cap Rs.${(mktCapCr / 1000).toFixed(0)}K Cr - stable ✅`);
        else if (mktCapCr > 5000) signals.push(`mid cap Rs.${mktCapCr.toFixed(0)} Cr - moderate`);
        else signals.push(`Small cap Rs.${mktCapCr.toFixed(0)} Cr - volatile ⚠️`)

        const reasoning = signals.join(' | ');

        const context = `Stock ${stock.ticker} (${stock.companyName}): ${reasoning}`;
        const verdict = await jev.choice(
            context,
            'based on these fundamentals, is the stock undervalued, overvalued, overwhelemed, or fairly valued?',
            ['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION']
        )

        const confidence = await jev.noul(
            context,
            'How clear is the valuation signal?'
        );

        results.push({
            ticker: stock.ticker,
            agent: 'FUNDAMENTAL',
            sentiment: verdict.selected,
            confidence: Math.round(confidence.probability * 100),
            expectedMovePercent: stock.pe !== null && stock.pe < 15 ? 2.5 : stock.pe !== null && stock.pe > 30 ? -1.5 : 0.5,
            reasoning
        })

    }
    return results;
}



export async function macroAgentJev(
    stocks: StockSnapshot[],
    marketContext: MarketContext,
    fiiDiiContext?: string,
    earningsMap?: Record<string, { isUpcoming: boolean; daysUntilEarnings: number | null }>
): Promise<AgentResult[]> {
    const jev = getJevProvider();
    const results: AgentResult[] = [];

    const marketSignals: string[] = [];

    if (marketContext.niftyChangePercent > 1) marketSignals.push(`Nifty +${marketContext.niftyChangePercent.toFixed(1)}% - bullish market ✅`);
    else if (marketContext.niftyChangePercent < -1) marketSignals.push(`Nifty -${marketContext.niftyChangePercent.toFixed(1)}% - bearish market ⚠️`);
    else marketSignals.push(`Nifty ${marketContext.niftyChangePercent.toFixed(1)}% - flat market`);

    marketSignals.push(`Regime: ${marketContext.regime}`);
    if (fiiDiiContext) marketSignals.push(fiiDiiContext);
    if (marketContext.giftNiftyChange !== undefined) {
        marketSignals.push(`GIFT Nifty: ${marketContext.giftNiftyChange >= 0 ? '+':''}${marketContext.giftNiftyChange.toFixed(1)}%`)
    }



    for (const stock of stocks) {
        const earningsNote = earningsMap?.[stock.ticker]?.isUpcoming ? `| 📅 Earnings in ${earningsMap[stock.ticker].daysUntilEarnings} days!`:'';

        const reasoning = marketSignals.join(' | ') + earningsNote;
        const context = `Market:  ${reasoning}. Stock: ${stock.ticker}`;

        const verdict = await jev.choice(
            context,
            'Is this broader market environemtn favorable for this stock today?',
            ['BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION']
        );

        const confidence = await jev.noul(
            context,
            'How strongly does the macro envirnoment affect this stock?'
        );

        results.push({
            ticker: stock.ticker,
            agent: 'MACRO',
            sentiment: verdict.selected,
            confidence: Math.round(confidence.probability * 100),
            expectedMovePercent: marketContext.niftyChangePercent * 0.5,
            reasoning
        })
    }

    return results;

}