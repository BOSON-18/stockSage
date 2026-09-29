


// CONFIG

import Groq from "groq-sdk";
import YahooFinance from "yahoo-finance2";
import { z } from "zod";
import 'dotenv/config'


const TICKERS = [
    'RELIANCE.NS',
    'TATASTEEL.NS',
    'INFY.NS',
    'HDFCBANK.NS',
    'TCS.NS',
    'ICICIBANK.NS',
]

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// TYPES
// We fetch this from yahoo api 
interface StockSnapshot {
    ticker: string;
    companyName: string;
    price: number;
    changePercent: number;
    pe: number | null; // null hwne stock has no earning
    marketCap: number;
    volume: number;
    avgVolume: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyDayAvg: number;
    twoHundredDayAvg: number;
}

// Zod schema - runtime validation

const RecommendationSchema = z.object({
    ticker: z.string(),
    companyName: z.string(),
    action: z.enum(['BUY', "SELL", 'HOLD']),
    confidence: z.number().min(0).max(100),
    currentPrice: z.number(),
    targetPrice: z.number(),
    stopLoss: z.number(),
    bullCase: z.array(z.string()),
    bearCase: z.array(z.string()),
    thesis: z.string()
});

const ResponseSchema = z.object({
    recommendations: z.array(RecommendationSchema)
})

type Recommendation = z.infer<typeof RecommendationSchema>;

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Impure functions - await
// async function fetchStockData(tickers: string[]): Promise<StockSnapshot[]> {
async function fetchStockData(tickers: string[]): Promise<Record<string, any>[]> {
    const rawQuotes: Record<string, any>[] = [];
    // const snapshots: StockSnapshot[] = [];

    for (const ticker of tickers) {
        try {
            const quote = await yahooFinance.quote(ticker);
            rawQuotes.push(quote as Record<string, any>);
        } catch (error) {
            console.warn(`Failed to fetch ${ticker}, skipping: `, error)
        }
    }

    return rawQuotes;

}

function formatStockData(rawQuotes: Record<string, any>[]): StockSnapshot[] {
    return rawQuotes.map((quote) => ({
        ticker: quote.symbol,
        companyName: quote.shortName ?? quote.longName ?? quote.symbol ?? 'Unknown',
        price: quote.regularMarketPrice,
        changePercent: quote.regularMarketChangePercent ?? 0,
        pe: quote.trailingPE ?? null,
        marketCap: quote.marketCap ?? 0,
        volume: quote.regularMarketVolume ?? 0,
        avgVolume: quote.averageDailyVoulme3Month,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
        fiftyDayAvg: quote.fiftyDayAverage ?? 0,
        twoHundredDayAvg: quote.twoHundredDayAvg ?? 0
    }))
}


// pure function - no async, no side effects, deterministic

function buildPrompt(stocks: StockSnapshot[]): string {
    const stockDataText = stocks.map((s) => {
        const volumeRatio = s.avgVolume > 0 ? (s.volume / s.avgVolume).toFixed(1) : 'N/A';

        const fiftyTwoWeekPosition = s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow ? (
            ((s.price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow)) * 100
        ).toFixed(0) : 'N/A'
        return `
        STOCK: ${s.ticker} (${s.companyName})
        Price: Rs. ${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''} ${s.changePercent.toFixed(2)}% today)
        PE Ratio: ${s.pe != null ? s.pe.toFixed(1) : 'N/A'}
        Market Cap: ${(s.marketCap / 1e7).toFixed(0)}Cr
        Volume: ${s.volume.toLocaleString()} (${volumeRatio}x avg)
        52-Week Range: Rs.${s.fiftyTwoWeekLow.toFixed(2)} - Rs.${s.fiftyTwoWeekHigh.toFixed(2)} (currently at ${fiftyTwoWeekPosition}%)
        50-Day Avg: Rs.${s.fiftyDayAvg.toFixed(2)} | 200-Day Avg: Rs.${s.twoHundredDayAvg.toFixed(2)}
        Trend: Price is ${s.price > s.twoHundredDayAvg ? 'ABOVE' : 'BELOW'} 200-DMA
        `;

    }).join('\n');


    return `You are a senior equity research analyst specializing in Indian markets (NSE).
    Analyze the follwoing stocks and recommend which ones to BUY, SELL or HOLD.
    
    RULES:
    - Use ONLY the data provided below. Do NOT use your training data for any numerical value.
    - For each stock, provide both bull case(reason FOR) and bear case(reason AGAINST).
    - Confidence must reflect how sure you are (0-100). If unsure, give low confidence.
    - Target price should be realisitc (1-5% for intraday/short-term).
    - Stop loss should limit downside (1-3% below entry for intraday).
    
    STOCK DATA:
    ${stockDataText}
    
    Respond in this EXACT JSON format, no other text:
    {
    "recommendations":[
    {
        "ticker": "SYMBOL.NS",
        "companyName": "Company Name",
        "action": "BUY | SELL | HOLD",
        "confidence": 75,
        "currentPrice": 1234.56,
        "targetPrice": 1280.00,
        "stopLoss": 1210.00,
        "bullCase": ["reason 1","reason 2"],
        "bearCase": ["risk 1", "risk2"],
        "thesis": "One detailed paragraph explaining the overall reasoning.
    }
        ]
    }`

}


async function callLLM(prompt: string): Promise<string> {
    const client = new Groq({
        apiKey: process.env.GROQ_API_KEY
    })

   

    const response = await client.chat.completions.create({
        // model: "llama-3.3-70b-versatile",
        model: "qwen/qwen3.8-27b",
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
        throw new Error('LLM returned empty response');
    }
    return content;
}

function parseAndValidate(raw: string): Recommendation[] {
    const parsed = JSON.parse(raw);
    const validated = ResponseSchema.parse(parsed);
    return validated.recommendations;
}


// IMPURE -> side effect -> Print to console
function displayResults(recommendations: Recommendation[]): void {
    const date = new Date().toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })

    console.log('\n' + '='.repeat(60));
    console.log(` STOCK SAGE v0.1 - Recommendations (${date})`);
    console.log('='.repeat(60));

    recommendations.forEach((rec, index) => {
        const targetChange = (
            ((rec.targetPrice - rec.currentPrice) / rec.currentPrice) * 100
        ).toFixed(1);

        const slChange = (
            ((rec.stopLoss - rec.currentPrice) / rec.currentPrice) * 100
        ).toFixed(1);

        console.log(`\n #${index + 1} ${rec.ticker}-${rec.companyName}`);
        console.log(' ' + '-'.repeat(40))
        console.log(` Action:  ${rec.action}`);
        console.log(` Confidence: ${rec.confidence}%`);
        console.log();
        console.log(` Price:  Rs.${rec.targetPrice.toFixed(2)}`);
        console.log(` Target:  Rs.${rec.targetPrice.toFixed(2)} (${targetChange}%)`);
        console.log(` Stop Loss: Rs.${rec.stopLoss.toFixed(2)} (${slChange})`)
        console.log();
        console.log(' BULL Case: ')
        rec.bullCase.forEach((b) => console.log(` +${b}`));
        console.log();
        console.log(' BEAR Case:');
        rec.bearCase.forEach((b) => console.log(` - ${b}`));
        console.log();
        console.log(` Thesis: ${rec.thesis}`);
        console.log(` ` + '='.repeat(40))
    })

    console.log('\n Disclaimer: This is an AI-generated analysis, NOT financial advice.')
    console.log(' Always do your own research before trading. \n');
}



// ORCHESTRATOR -> Refer LLD Dig for steps

async function main(): Promise<void> {
    console.log('Stock sage v0.1 starting...\n');

    // STEP ! -> Fetch STOCK
    console.log('Fetching Stock data ...');
    const rawQuotes = await fetchStockData(TICKERS);

    if (rawQuotes.length === 0) {
        console.error('No stock data could be fetched. Exiting.');
        process.exit(1);
    }

    //  Step 2 : Format - extract only the 8 fields we need
    const stocks = formatStockData(rawQuotes);
    console.log(`Fetched and formatted  data for ${stocks.length} stocks. \n`);

    // Step 3: Build Prompt
    const prompt = buildPrompt(stocks);

    // Step 4: Call LLM with retry (wraps call + validation together)
    let recommendations: Recommendation[] | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(` Calling LLM (attempt ${attempt}/${MAX_RETRIES})...`);
            const rawRespose = await callLLM(prompt);
            recommendations = parseAndValidate(rawRespose);
            break;
        } catch (error) {
            console.warn(`Attempt ${attempt} failed:`, error);
            if (attempt < MAX_RETRIES) {
                console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
    }

    if (!recommendations || recommendations.length === 0) {
        console.error(`Failed to get recommendations after all retries. Exiting.`);
        process.exit(1);
    }

    // Step 5: Display results
    displayResults(recommendations);

}

main().catch((error) => {
    console.error(`Fatal error:`, error);
    process.exit(1);
})