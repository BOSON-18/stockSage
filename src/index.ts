import { jevCommitteeVote, runCommittee } from "./ai/committee";
import { jevClassifyNews, } from "./ai/jev-decision";
import { getJevProvider } from "./ai/jev-procider";
import { callLLM } from "./ai/llm-client";
import { buildCandidateList, extractStocksFromNews, filterByBudget, jevGateCandidates } from "./ai/stock-discovery";
import { computeAllIndicators } from "./analysis/compute-all";
import { DELAY_BETWEEN_CALLS_MS, LLM_MODEL, MAX_RETRIES, RETRY_DELAY_MS, WATCHLIST, USE_LOCAL } from "./config";
import { fetchHistoricalBatch } from "./data/historical-fetcher";
import { fetchMarketContext } from "./data/market-context";
import { fetchAllNews, fetchStockNewsBatch } from "./data/news-fetcher";
import { filterByScore, scoreNewsBatch } from "./data/news-scoreer";
import { checkOutcomes, getPerformanceSummary, saveRecommendations, getLessonsForPrompt } from "./data/paper-trade";
import { fetchPortfolio } from "./data/portfolio-fetcher";
import { runQuantScanner } from "./data/quant-scanner";
import { fetchStockData, formatStockData } from "./data/stock-fetcher";
import { buildDynamicSectorMap, fetchStockUniverse } from "./data/stock-universe";
import { displayResults } from "./display";
import { mergeResults } from "./logic/merge";
import { rankAndFilter } from "./logic/rank";
import { buildAnalysisPrompt } from "./prompts";
import { validateEnv } from "./security/env-validator";
import { sanitizePortfolio } from "./security/sanitizer";
import { checkDailyLimit, getCostSummary } from "./security/tracker";
import { AnalysisResponseSchema, Recommendation, SanitizedPortfoilio, StockAnalysis, TechnicalIndicators } from "./types";



// ORCHESTRATOR -> Refer LLD Dig for steps

async function main(): Promise<void> {

    console.log('Stock sage v0.8 starting...\n');
    console.log(` Mode: ${USE_LOCAL ? 'LOCAL (Ollama)' : 'CLOUD (DeepSeek)'}`);
    console.log(` Model: ${LLM_MODEL}\n`)

    if (!validateEnv()) {
        console.error('Startup aborted - fix .env first.\n');
        process.exit(1);
    }

    const { ok: withinBudget, todaySpend } = checkDailyLimit();
    if (!withinBudget) {
        console.error(` ⚠️ Daily cost limit exceeded ($${todaySpend.toFixed(4)}). Try again tomorrow.\n`);
        process.exit(1);
    }
    console.log(` ${getCostSummary()}`)

    console.log(' -1: Checking past paper trades')
    const outcomes = await checkOutcomes();
    if (outcomes.checked > 0) {
        console.log(`Checked ${outcomes.checked} past trades: ${outcomes.wins} wins, ${outcomes.losses} losses`);
        console.log(`Win rate: ${outcomes.winRate.toFixed(0)}% | Avg P&L: ${outcomes.avgPnl.toFixed(1)}%`);
        outcomes.lessons.forEach(l => console.log(` ${l}`))
        console.log();

    } else {
        console.log('No past trades to check yet');
    }

    console.log(` ${getPerformanceSummary()}`);
    console.log()

    console.log('Phase 0: Building stock universe...');
    const universe = await fetchStockUniverse();
    const dynamicSectorMap = buildDynamicSectorMap(universe);


    console.log('Phase 0.5 Fetching Portfolio...');
    const rawPortfolio = await fetchPortfolio();
    let sanitizedPortfolio: SanitizedPortfoilio | null = null;

    if (rawPortfolio) {

        sanitizedPortfolio = sanitizePortfolio(rawPortfolio);
        console.log(`${sanitizedPortfolio.overallStatus}`);
        console.log(`Existing tickers: ${sanitizedPortfolio.existingTickers.join(', ') || 'none'}`);
        // console.log('[MAIN] Checking Portfolio: ', sanitizedPortfolio)


    } else {
        console.log('No portfolio data - running without portfolio context');
    }
    console.log()

    // STEP 1 -> Fetch STOCK
    console.log('Phase 1: Collecting market context + news (Parallel) ...');

    const [marketContext, allNews] = await Promise.all([
        fetchMarketContext(),
        fetchAllNews(),

    ]);
    console.log(` Market: Nifty ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}% -> regime: ${marketContext.regime}`)
    console.log(` News: ${allNews.length} articles fetched.`)


    //  Step 2 : Format - extract only the 8 fields we need

    //  2.a Code score news
    console.log('Phase 2: Filtering news...');
    const scoredNews = scoreNewsBatch(allNews);
    console.log(`After dedup +  scoring: ${scoredNews.length} unique articles`);

    //  2.b Jev classify each article
    console.log('Running Jev news classification...');
    const jevClassifications = await jevClassifyNews(scoredNews);
    console.log(`Jev classified: ${jevClassifications.length} articles`);

    //  2.c Filter news for top 30% confidence only codescores x Jev scores

    let filteredNews = scoredNews;

    if (jevClassifications.length > 0) {
        filteredNews = filterByScore(scoredNews, jevClassifications);
    }

    console.log(` After combined filter: ${filteredNews.length} high-quality articles\n`)



    //  PHASE 3 : DISCOVER STOCKS (NEW PIPELINE)

    // Extract candidates from news
    console.log('Phase 3: Discovering stocks...');

    console.log('3a: From news...')
    const newsStocks = await extractStocksFromNews(filteredNews, dynamicSectorMap)
    console.log(`News-driven stocks: ${newsStocks.length}`);
    // newsStocks.forEach((s) => console.log(`${s.ticker}-${s.reason}`));

    console.log('3b: Quant Scanner...');
    const allTickersForScan = universe.map(u => u.ticker);
    const scannerStocks = await runQuantScanner(allTickersForScan);
    console.log(`Scanner found stocks: ${scannerStocks.length}`);

    // Step 3b: Build candidate list (news+watchlist+dedup)
    const combinedDiscoveries = [...newsStocks, ...scannerStocks];
    let candidates = await buildCandidateList(combinedDiscoveries);
    console.log(`Total candidates: ${newsStocks.length} news + ${scannerStocks.length} scanner + watchlist = ${candidates.length} candidates`);

    if (sanitizedPortfolio && sanitizedPortfolio.existingTickers.length > 0) {
        const before = candidates.length;
        candidates = candidates.filter((c) => !sanitizedPortfolio!.existingTickers.includes(c.ticker));
        const removed = before - candidates.length;
        if (removed > 0) {
            console.log(`Removed ${removed} stocks already in portfolio`);
        }
    }

    // Step 3c: Fetch stock data for ALL candidates (dynamic not fixed)
    console.log('Fetching stock data for candidates...')
    const candidateTickers = candidates.map(c => c.ticker);
    console.log('[MAIN] Checking candidateTickers: ', candidateTickers)
    const rawQuotes = await fetchStockData(candidateTickers);

    let stocks = formatStockData(rawQuotes);
    console.log(`Fetched Data: ${stocks.length} stocks`);

    if (stocks.length === 0) {
        console.error('No stock data could be fetched. Exiting.');
        process.exit(1);
    }

    // Step 3d: Filter by budget 
    stocks = filterByBudget(stocks);

    if (stocks.length === 0) {
        console.error('No affordable stocks found. Try increasing MAX_PRICE_PER_STOCK');
        process.exit(1);
    }

    // Step 3e : jev gates - worth analyzing
    console.log('Running Jev stock gating...');
    const gatedTickers = await jevGateCandidates(stocks, filteredNews, marketContext);

    if (gatedTickers.length === 0) {
        console.log('\n No stocks passed Jev gate - no opportunities today');
        process.exit(0);
    }

    // Keep only stokcs that passed the gate
    const gatedStocks = stocks.filter((s) => gatedTickers.includes(s.ticker));
    console.log(`passed gate: ${gatedStocks.length} stocks worth analyzing\n`);

    // 3.f Fetch 6 month history for gated stocks only
    console.log('Fetching historical data (6 months)...');
    const gatedTickerList = gatedStocks.map((s) => s.ticker);
    const historicalData = await fetchHistoricalBatch(gatedTickerList);

    //  3g. Compute technical indicatores from history 
    console.log('Computing technical indicators...');
    const indicatorsMap: Record<string, TechnicalIndicators> = {};
    for (const stock of gatedStocks) {
        const ohlcv = historicalData[stock.ticker] ?? [];

        if (ohlcv.length > 0) {
            indicatorsMap[stock.ticker] = computeAllIndicators(ohlcv, stock.price);
            const ind = indicatorsMap[stock.ticker];
            console.log(` ${stock.ticker}: RSI ${ind.rsi.toFixed(1)} | MACD ${ind.macdSignal} | Bollinger ${ind.bollingerPosition}${ind.bollingerSqueeze ? 'SQUEEZE' : ''} | ATR ${ind.atrPercent.toFixed(1)}%`)
        } else {
            console.log(`${stock.ticker}: No history - using defaults`)
        }
    }

    console.log()

    console.log('Phase 3.5: Fetching stock-specific news...');
    const { fetchStockNewsBatch } = require('./data/news-fetcher');
    const stockNewsMap = await fetchStockNewsBatch(gatedStocks.map(s => ({ ticker: s.ticker, companyName: s.companyName })));

    // Merge per stock news + general filtered news = full news context per stock
    const enrichedNewsMap: Record<string, typeof filteredNews> = {};
    for (const stock of gatedStocks) {
        const stockSpecificnews = stockNewsMap[stock.ticker] ?? [];
        //  Stock specific first then general dedup by title
        const combined = [...stockSpecificnews];
        for (const general of filteredNews) {
            if (!combined.some(n => n.title === general.title)) {
                combined.push(general);
            }
        }
        enrichedNewsMap[stock.ticker] = combined;
    }
    console.log()


    //  ======================== PHASE 3.6 Full Financials (Deep dive) ====================================
    console.log('Phase 3.6: Fetching full financials');
    const { fetchFinancialsBatch, formatFinancialsForPrompt } = await import('./data/financial-fetcher');
    const financialMap = await fetchFinancialsBatch(gatedStocks.map(s => s.ticker));

    console.log(`Financials: ${Object.keys(financialMap).length} stocks\n`)

    //  ============PHASE 3.7: MARKET DATA (FII/DII + Earnings) =====================
    console.log('Phase 3.7: Fetching market data...');
    const { fetchMarketData, formatFiiDii } = await import('./data/market-data');
    const { fiiDii, earnings } = await fetchMarketData(gatedStocks.map(s => s.ticker));
    console.log()

    // Phase 4 ANALYZE 


    const selectionReasons: Record<string, string> = {};
    for (const candidate of candidates) {
        selectionReasons[candidate.ticker] = candidate.reason;
    }
    // const prompt = buildAnalysisPrompt(gatedStocks, filteredNews, selectionReasons);



    console.log('Phase 4: Running 5 agent committee');
    const fiiDiiContext = fiiDii ? formatFiiDii(fiiDii) : undefined;
    const { verdictMap, verificationMap } = await runCommittee(gatedStocks, filteredNews, marketContext, indicatorsMap, sanitizedPortfolio, enrichedNewsMap, financialMap, fiiDiiContext, earnings);
    console.log(`Committee completed.\n`);





    // PHASE -5 Jev FINAL VOTE

    console.log('Phase 5: Jev Final vote...');
    const ownedTickers = sanitizedPortfolio?.existingTickers ?? [];
    const decisions = await jevCommitteeVote(gatedStocks, verdictMap, ownedTickers);
    console.log(`Decisions: ${decisions.length}\n`);


    //  PHASE 6 - OUTPUT

    const recommendations: Recommendation[] = gatedStocks.map((stock, i) => {
        const decision = decisions[i];
        const verdicts = verdictMap[stock.ticker] ?? [];

        // COmpute target/SL from committee's expected moves
        const bullishMoves = verdicts.filter((v) => v.expectedMovePercent > 0).map((v) => v.expectedMovePercent);
        const avgUpside = bullishMoves.length > 0 ? bullishMoves.reduce((a, b) => a + b, 0) / bullishMoves.length : marketContext.upsideRange.min;

        // Risk agent's move is the downside estimate

        const riskVerdict = verdicts.find((v) => v.agent === 'RISK');
        const downSide = riskVerdict ? Math.abs(riskVerdict.expectedMovePercent) : marketContext.downsideRange.min;

        //  clamp to regiume

        const clampedUpside = Math.min(Math.max(avgUpside, marketContext.upsideRange.min));
        const clampedDownSide = Math.min(Math.max(downSide, marketContext.downsideRange.min));

        return {
            ticker: stock.ticker,
            companyName: stock.companyName,
            currentPrice: stock.price,
            targetPrice: stock.price * (1 + clampedUpside / 100),
            stopLoss: stock.price * (1 - clampedDownSide / 100),
            committeeVerdicts: verdicts.map((v) => ({
                agent: v.agent,
                ticker: stock.ticker,
                sentiment: v.sentiment as any,
                confidence: v.confidence,
                expectedMovePercent: v.expectedMovePercent,
                reasoning: v.reasoning
            })),
            action: decision?.action ?? 'AVOID',
            confidence: decision?.confidence ?? 0,
            riskLevel: decision?.riskLevel ?? 'HIGH',
            holdingPeriod: decision?.holdingPeriod ?? 'INTRADAY',
            jevProbabilities: decision?.actionProbabilities ?? {},
            newsContext: filteredNews.slice(0, 5).map((n) => n.title)
        }

    });

    const ranked = rankAndFilter(recommendations);

    // SAVE PAPER TRADES
    if (ranked.length > 0) {
        saveRecommendations(ranked);
        console.log('[INFO] Recommendations saved to paper-trades.json');
    }


    // Step 9 Display results
    displayResults(ranked, marketContext, indicatorsMap, verificationMap);

    //  ====================== PHASE 7 PORTFOLIO ANALYZING +=====================

    if (rawPortfolio && rawPortfolio.holdings.length > 0) {
        console.log('=========== ANALYSZING YOUR PORTFOLIO =================');

        const holdingSnapshots = rawPortfolio.holdings.map(h => ({
            ticker: h.ticker,
            companyName: h.companyName,
            price: h.currentPrice,
            changePercent: 0, // Not available from holdings
            pe: null as number | null,
            marketCap: 0,
            volume: 0,
            avgVolume: 0,
            fiftyTwoWeekHigh: 0,
            fiftyTwoWeekLow: 0,
            fiftyDayAvg: 0,
            twohundredDayAvg: 0

        }))

        console.log('Fetching current data for hioldings....');
        const holdingRawQuotes = await fetchStockData(holdingSnapshots.map(s => s.ticker));
        const freshHoldings = formatStockData(holdingRawQuotes);

        if (freshHoldings.length > 0) {
            const holdingHistory = await (await import('./data/historical-fetcher')).fetchHistoricalBatch(freshHoldings.map(s => s.ticker));
            const holdingIndicators: Record<string, TechnicalIndicators> = {};
            for (const stock of freshHoldings) {
                const ohlcv = holdingHistory[stock.ticker] ?? [];
                if (ohlcv.length > 0) {
                    holdingIndicators[stock.ticker] = (await import('./analysis/compute-all')).computeAllIndicators(ohlcv, stock.price);
                }
            }

            const holdingTickers = freshHoldings.map(s => s.ticker);
            const { verdictMap: holdVerdicts } = await runCommittee(
                freshHoldings, filteredNews, marketContext, holdingIndicators, sanitizedPortfolio, undefined, undefined, fiiDiiContext, earnings
            );

            const holdDecisions = await jevCommitteeVote(freshHoldings, holdVerdicts, holdingTickers);

            console.log('\n YOUR HOLDINGS - AI + jev Analysis:');
            console.log(' ' + '-'.repeat(50));

            for (let i = 0; i < freshHoldings.length; i++) {
                const stock = freshHoldings[i];
                const holding = rawPortfolio.holdings.find(h => h.ticker === stock.ticker);
                const decision = holdDecisions[i];
                const verdicts = holdVerdicts[stock.ticker] ?? [];

                if (!holding) continue;

                const pnlIcon = holding.pnlPercent >= 0 ? '🟢' : '🔴';
                console.log(`\n ${pnlIcon} ${stock.ticker} - ${stock.companyName}`);
                console.log(`Avg: Rs.${holding.avgPrice.toFixed(2)} | Now: Rs.${stock.price.toFixed(2)} | P&L: ${holding.pnlPercent >= 0 ? '+' : ''} ${holding.pnlPercent.toFixed(1)}%`);
                console.log(`Qty: ${holding.quantity} | Value: Rs.${(holding.quantity * stock.price).toFixed(0)}`);


                if (verdicts.length > 0) {
                    verdicts.forEach(v => {
                        const icon = v.sentiment === 'BULLISH' ? '🟢' : v.sentiment === 'BEARISH' ? '🔴' : v.sentiment === 'CAUTION' ? '🟡' : '⚪';
                        console.log(`${icon} ${v.agent}: ${v.sentiment} ${v.confidence}%`);
                    })
                }

                console.log(`-> JEV: ${decision?.action ?? 'N/A'} (${decision?.confidence ?? 0}% confidence)`)
            }

            const totalValue = rawPortfolio.holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
            console.log(`\n Overall Portfolio: Rs.${totalValue.toFixed(0)} | P&L: ${rawPortfolio.overallPnlPercent >= 0 ? '+' : ''}${rawPortfolio.overallPnlPercent.toFixed(1)}%`);
        }

        console.log('\n====================================================')
    }

}

// Entry Point
main().catch((error) => {
    console.error(`Fatal error:`, error);
    process.exit(1);
})