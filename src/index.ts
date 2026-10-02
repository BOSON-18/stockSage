import { jevClassifyNews, runJevDecisions } from "./ai/jev-decision";
import { callLLM } from "./ai/llm-client";
import { buildCandidateList, extractStocksFromNews, filterByBudget, jevGateCandidates } from "./ai/stock-discovery";
import { DELAY_BETWEEN_CALLS_MS, LLM_MODEL, MAX_RETRIES, RETRY_DELAY_MS, WATCHLIST, USE_LOCAL } from "./config";
import { fetchAllNews } from "./data/news-fetcher";
import { filterByScore, scoreNewsBatch } from "./data/news-scoreer";
import { fetchMarketContext, fetchStockData, formatStockData } from "./data/stock-fetcher";
import { displayResults } from "./display";
import { mergeResults } from "./logic/merge";
import { rankAndFilter } from "./logic/rank";
import { buildAnalysisPrompt } from "./prompts";
import { AnalysisResponseSchema, StockAnalysis } from "./types";

// function parseAnalysis(raw: string): StockAnalysis[] {
//     const parsed = JSON.parse(raw);
//     // console.log("Parsed response", parsed);
//     const validated = AnalysisResponseSchema.parse(parsed);
//     // console.log("Validated response ", validated)
//     return validated.analyses;
// }


// ORCHESTRATOR -> Refer LLD Dig for steps

async function main(): Promise<void> {
    console.log('Stock sage v0.4 starting...\n');
    console.log(` Mode: ${USE_LOCAL ? 'LOCAL (Ollama)' : 'CLOUD (Groq)'}`);
    console.log(` Model: ${LLM_MODEL}\n`)

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
    const newsStocks = await extractStocksFromNews(filteredNews)
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

    // Phase 4 ANALYZE 

    // const prompt = buildAnalysisPrompt(gatedStocks, filteredNews);
    const selectionReasons: Record<string, string> = {};
    for (const candidate of candidates) {
        selectionReasons[candidate.ticker] = candidate.reason;
    }
    const prompt = buildAnalysisPrompt(gatedStocks, filteredNews, selectionReasons);

    // Step 4: Call LLM with retry (wraps call + validation together)
    let analyses: StockAnalysis[] | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(` Step 4: Calling LLM (attempt ${attempt}/${MAX_RETRIES})...`);
            const rawRespose = await callLLM(prompt);
            const parsed = JSON.parse(rawRespose)
            // console.log('[MAIN] Checking LLM output', parsed)
            analyses = AnalysisResponseSchema.parse(parsed).analyses;
            break;
        } catch (error) {
            console.warn(`Attempt ${attempt} failed:`, error);
            if (attempt < MAX_RETRIES) {
                console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
    }

    if (!analyses || analyses.length === 0) {
        console.error(`Failed to get recommendations after all retries. Exiting.`);
        process.exit(1);
    }

    // console.log('Checking Analysis: ', analyses[0])

    console.log(` LLM analyzed ${analyses.length} stocks. \n`);
    console.log(` Generating trading signals... `);

    // Step 5: Delay before Jev decision for cloud
    if (!USE_LOCAL) {
        console.log(`Step 5: Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s before Jev decisions...`);
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS))
    }

    // Step 6: Batch Jev decisions - ALL stocks in ONE call 
    console.log('Phase 5: Running Jev decisions...')
    const decisions = await runJevDecisions(gatedStocks, analyses);
    // console.log(`Step 6: Got ${decisions.length} decisions\n`);
    // console.log('[MAIN] Checking JEV OUTPUT ',decisions[0])

    console.log('PHASE 6: OUTPUT')
    // Step 7 Merge stock data + analysis + decisions
    const merged = mergeResults(gatedStocks, analyses, decisions);

    // Step 8 Rank by confidence
    const recommendations = rankAndFilter(merged);



    // Step 9 Display results
    displayResults(recommendations);

}

// Entry Point
main().catch((error) => {
    console.error(`Fatal error:`, error);
    process.exit(1);
})