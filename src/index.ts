import { runJevDecisions } from "./ai/jev-decision";
import { callLLM } from "./ai/llm-client";
import { DELAY_BETWEEN_CALLS_MS, LLM_MODEL, MAX_RETRIES, RETRY_DELAY_MS, TICKERS, USE_LOCAL } from "./config";
import { fetchnews } from "./data/news-fetcher";
import { fetchStockData, formatStockData } from "./data/stock-fetcher";
import { displayResults } from "./display";
import { mergeResults } from "./logic/merge";
import { rankAndFilter } from "./logic/rank";
import { buildAnalysisPrompt } from "./prompts";
import { AnalysisResponseSchema, StockAnalysis } from "./types";

function parseAnalysis(raw: string): StockAnalysis[] {
    const parsed = JSON.parse(raw);
    // console.log("Parsed response", parsed);
    const validated = AnalysisResponseSchema.parse(parsed);
    // console.log("Validated response ", validated)
    return validated.analyses;
}


// ORCHESTRATOR -> Refer LLD Dig for steps

async function main(): Promise<void> {
    console.log('Stock sage v0.2 starting...\n');
    console.log(` Mode: ${USE_LOCAL ? 'LOCAL (Ollama)' : 'CLOUD (Groq)'}`);
    console.log(` Model: ${LLM_MODEL}\n`)

    // STEP ! -> Fetch STOCK
    console.log('Fetching Stock data and new data (Parallel) ...');

    const [rawQuotes, news] = await Promise.all([
        fetchStockData(TICKERS),
        fetchnews()
    ])

    if (rawQuotes.length === 0) {
        console.error('No stock data could be fetched. Exiting.');
        process.exit(1);
    }

    //  Step 2 : Format - extract only the 8 fields we need
    const stocks = formatStockData(rawQuotes);
    console.log(` Stocks: ${stocks.length} fetched`)
    console.log(` News: ${news.length} fetched`)

    // Step 3: Build Prompt
    const prompt = buildAnalysisPrompt(stocks, news);

    // Step 4: Call LLM with retry (wraps call + validation together)
    let analyses: StockAnalysis[] | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(` Calling LLM (attempt ${attempt}/${MAX_RETRIES})...`);
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
        console.log(`Step 5: Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s before Jev...`);
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS))
    }

    // Step 6: Batch Jev decisions - ALL stocks in ONE call 
    console.log('Step 6: Running Jev decisions...')
    const decisions = await runJevDecisions(stocks, analyses);
    console.log(`Step 6: Got ${decisions.length} decisions\n`);
    // console.log('[MAIN] Checking JEV OUTPUT ',decisions[0])

    // Step 7 Merge stock data + analysis + decisions
    const merged = mergeResults(stocks, analyses, decisions);

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