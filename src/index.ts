import { jevCommitteeVote, runCommittee } from "./ai/committee";
import { jevClassifyNews, runJevDecisions } from "./ai/jev-decision";
import { callLLM } from "./ai/llm-client";
import { buildCandidateList, extractStocksFromNews, filterByBudget, jevGateCandidates } from "./ai/stock-discovery";
import { computeAllIndicators } from "./analysis/compute-all";
import { DELAY_BETWEEN_CALLS_MS, LLM_MODEL, MAX_RETRIES, RETRY_DELAY_MS, WATCHLIST, USE_LOCAL } from "./config";
import { fetchHistoricalBatch } from "./data/historical-fetcher";
import { fetchAllNews } from "./data/news-fetcher";
import { filterByScore, scoreNewsBatch } from "./data/news-scoreer";
import { fetchMarketContext, fetchStockData, formatStockData } from "./data/stock-fetcher";
import { buildDynamicSectorMap, fetchStockUniverse } from "./data/stock-universe";
import { displayResults } from "./display";
import { mergeResults } from "./logic/merge";
import { rankAndFilter } from "./logic/rank";
import { buildAnalysisPrompt } from "./prompts";
import { AnalysisResponseSchema, Recommendation, StockAnalysis, TechnicalIndicators } from "./types";



// ORCHESTRATOR -> Refer LLD Dig for steps

async function main(): Promise<void> {
    console.log('Stock sage v0.5 starting...\n');
    console.log(` Mode: ${USE_LOCAL ? 'LOCAL (Ollama)' : 'CLOUD (Groq)'}`);
    console.log(` Model: ${LLM_MODEL}\n`)

    console.log('Phase 0: Building stock universe...');
    const universe = await fetchStockUniverse();
    const dynamicSectorMap = buildDynamicSectorMap(universe);
    console.log()
    

    // STEP ! -> Fetch STOCK
    console.log('Phase 1: Collecting market context + news (Parallel) ...');

    const [marketContext, allNews] = await Promise.all([
        fetchMarketContext(),
        fetchAllNews(),
        // fetchStockData(WATCHLIST)
    ]);
    console.log(` Market: Nifty ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}% -> regime: ${marketContext.regime}`)
    console.log(` News: ${allNews.length} articles fetched.`)
    // console.log(` Watchlist:  ${rawQuotes.length} stocks fetched.`)

    // console.log('Checking rawQuotes', rawQuotes)

    // if (rawQuotes.length === 0) {
    //     console.error('No stock data could be fetched. Exiting.');
    //     process.exit(1);
    // }

    //  Step 2 : Format - extract only the 8 fields we need
    // const stocks = formatStockData(rawQuotes);
    // console.log(` Stocks: ${stocks.length} fetched`)
    // 
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

    //  Phase 3-6 Exisiting pipeline

    //  PHASE 3 : DISCOVER STOCKS (NEW PIPELINE)

    // Extract candidates from news
    console.log('Phase 3: Discovering stocks from news...');
    const newsStocks = await extractStocksFromNews(filteredNews, dynamicSectorMap)
    console.log(`News-driven stocks: ${newsStocks.length}`);
    // newsStocks.forEach((s) => console.log(`${s.ticker}-${s.reason}`));

    // Step 3b: Build candidate list (news+watchlist+dedup)
    const candidates = await buildCandidateList(newsStocks);
    console.log(`Total candidates: ${candidates.length}`);

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

    // Phase 4 ANALYZE 

    // const prompt = buildAnalysisPrompt(gatedStocks, filteredNews);
    const selectionReasons: Record<string, string> = {};
    for (const candidate of candidates) {
        selectionReasons[candidate.ticker] = candidate.reason;
    }
    const prompt = buildAnalysisPrompt(gatedStocks, filteredNews, selectionReasons);

    // Step 4: Call LLM with retry (wraps call + validation together)
    // let analyses: StockAnalysis[] | null = null;

    // for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    //     try {
    //         console.log(` Step 4: Calling LLM (attempt ${attempt}/${MAX_RETRIES})...`);
    //         const rawRespose = await callLLM(prompt);
    //         const parsed = JSON.parse(rawRespose)
    //         // console.log('[MAIN] Checking LLM output', parsed)
    //         analyses = AnalysisResponseSchema.parse(parsed).analyses;
    //         break;
    //     } catch (error) {
    //         console.warn(`Attempt ${attempt} failed:`, error);
    //         if (attempt < MAX_RETRIES) {
    //             console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    //             await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    //         }
    //     }
    // }

    // if (!analyses || analyses.length === 0) {
    //     console.error(`Failed to get recommendations after all retries. Exiting.`);
    //     process.exit(1);
    // }

    // console.log('Checking Analysis: ', analyses[0])

    // console.log(` LLM analyzed ${analyses.length} stocks. \n`);
    // console.log(` Generating trading signals... `);

    console.log('Phase 4: Running 5 agent committee');
    const verdictMap = await runCommittee(gatedStocks, filteredNews, marketContext, indicatorsMap);
    console.log(`Committee completed.\n`);



    // Step 5: Delay before Jev decision for cloud
    // if (!USE_LOCAL) {
    //     console.log(`Step 5: Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s before Jev decisions...`);
    //     await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS))
    // }

    // PHASE -5 Jev FINAL VOTE

    console.log('Phase 5: Jev Final vote...');
    const decisions = await jevCommitteeVote(gatedStocks, verdictMap);
    console.log(`Decisions: ${decisions.length}\n`);



    // Step 6: Batch Jev decisions - ALL stocks in ONE call 
    // console.log('Phase 5: Running Jev decisions...')
    // const decisions = await runJevDecisions(gatedStocks, analyses);
    // console.log(`Step 6: Got ${decisions.length} decisions\n`);
    // console.log('[MAIN] Checking JEV OUTPUT ',decisions[0])

    // console.log('PHASE 6: OUTPUT')
    // // Step 7 Merge stock data + analysis + decisions
    // const merged = mergeResults(gatedStocks, analyses, decisions);

    // // Step 8 Rank by confidence
    // const recommendations = rankAndFilter(merged);

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



    // Step 9 Display results
    displayResults(ranked, marketContext, indicatorsMap);

}

// Entry Point
main().catch((error) => {
    console.error(`Fatal error:`, error);
    process.exit(1);
})