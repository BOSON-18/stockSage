import { NewsItem, StockAnalysis, StockSnapshot } from "./types";

// FORAMT one stock data into redable text fro prompts

function formatStockData(s: StockSnapshot): string {

    const volumeRatio = s.avgVolume > 0 ? (s.volume / s.avgVolume).toFixed(1) : 'N/A';

    const fiftyTwoWeekPosition = s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow ? (
        ((s.price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow)) * 100
    ).toFixed(0) : 'N/A'
    return `
        Ticker: ${s.ticker} (${s.companyName})
        Price: Rs. ${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''} ${s.changePercent.toFixed(2)}% today)
        PE Ratio: ${s.pe != null ? s.pe.toFixed(1) : 'N/A'}
        Market Cap: ${(s.marketCap / 1e7).toFixed(0)}Cr
        Volume: ${s.volume.toLocaleString()} (${volumeRatio}x avg)
        52-Week Range: Rs.${s.fiftyTwoWeekLow.toFixed(2)} - Rs.${s.fiftyTwoWeekHigh.toFixed(2)} (currently at ${fiftyTwoWeekPosition}%)
        50-Day Avg: Rs.${s.fiftyDayAvg.toFixed(2)} | 200-Day Avg: Rs.${s.twoHundredDayAvg.toFixed(2)}
        Trend: Price is ${s.price > s.twoHundredDayAvg ? 'ABOVE' : 'BELOW'} 200-DMA
        `;

}

// LLM ANALYSIS PROMPT - ASK LLM NOT DECIDE
export function buildAnalysisPrompt(stocks: StockSnapshot[], news: NewsItem[]): string {

    const stockDataText = stocks.map((s) => `\nSTOCK: ${s.ticker}\n${formatStockData(s)}`).join('\n');

    const newsText = news.length > 0 ?
        `\n RECENT INDIAN MARKET NEWS:\n${news.map((n) => `-${n.title} (${n.source}, ${n.publishedAt})`).join('\n')}` : ' \nNEWS: No recent news data available. Analyze based on stock data only';


    return `You are a senior equity research analyst specializing in Indian markets (NSE).
    Your job is to ANALYZE the stocks below - provide reasoning, sentiment, and factors.
    Do NOT make a buy/sell/hold decision. A separate decision system will do that.
    
    RULES:
    - Use ONLY the data provided below. Do NOT use your training data for any numerical value.
    - For each stock, provide both bull case(reasons for optimisim) and bear case(risks/concerns).
    - Assess how recent news might impact each stock.
    - expectedUpsidePercent: how much upside you expect (e.g, 3.5 means you expect 3.5% move). Realistic range: 1-5.
    - riskDownsidePercent: how much downside risk (e.g., 2.0 means -2.0% risk). Realistic range: 1-3.
    - Just give the PERCENTAGE NUMBERS. Our code will calculate the actual prices.
    - Be honest - if the data is ambiguous, say so.
    
    STOCK DATA:
    ${stockDataText}
    ${newsText}
    
    Respond in this EXACT JSON format, no other text:
    {
    "analyses":[
    {
        "ticker": "<ACTUAL_TICKER>",
        "companyName": "<ACTUAL_COMPANY_NAME>",
        "sentiment": "<bullish or bearish or neutral>",
        "bullCase": ["<your actual reason 1>","<your actual reason 2>"],
        "bearCase": ["<your actual risk 1>", "<your actual risk 2>"],
        "thesis": "<One detailed paragraph explaining the overall reasoning>",
        "newsImpact" : "<How recent news affects this stock, or 'No direct news impact'.>",
        "expectedUpsidePercent": <1_TO_5>,
        "riskDownsidePercent": <1_TO_3>
    }
        ]
    }`

}

// JEV SINGLE PROMPT - for one stock

export function buildSingleJevPrompt(stock: StockSnapshot, analysis: StockAnalysis): string {


    return `You are a DECISION ENGINE/ You do NOT write explanations.
    You receive stock data and an analyst's assessments for MULTIPLE stocks.
    Make a structured decision for EACH stock.
    
    STOCK DATA:
        ${formatStockData(stock)}
        
    ANALYST ASSESSMENT:
        Sentiment: ${analysis?.sentiment ?? 'neutral'}
        Bull Case: ${analysis?.bullCase.join('; ') ?? 'None'}
        Bear Case: ${analysis?.bearCase.join('; ') ?? 'None'}
        News Impact: ${analysis?.newsImpact ?? 'None'}
        
    DECISION RULES:
    - For EACH stock, pick ONE action from: BUY, SELL, HOLD, AVOID
    - Assign a probability (0.0 to 1.0) to EACH action. They must sum to 1.0.
    - Pick the optimal holding period: INTRADAY, SWING, or POSITIONAL.
    - Rate confidence 0-100. If unsure, give LOW confidence.
    - Rate risk: LOW, MEDIUM, or HIGH
    - If data is ambiguous or conflicting, choose AVOID with high probability.
    - Your probabilities and confidence MUST reflect the actual stock data above. Do NOT COPY example values.
   

    Respond in this JSON format (replace ALL values with your actual assessment):
             {
        "action" :"<YOUR_DECISION>",
        "actionProbabilities": {
            "BUY": <YOUR_PROBABILITY>,
            "SELL":<YOUR_PROBABILITY>,
            "HOLD":<YOUR_PROBABILITY>,
            "AVOID":<YOUR_PROBABILITY>
        },
        "holdingPeriod" : "<YOUR_ASSESSMENT>",
        "confidence" : <YOUR_NUMBER_0_TO_100>,
        "riskLevel" : "<YOUR_ASSESSMENT>"
        }
   
        `
}
//  JEV BATCH PROMPT

export function buildBatchJevPrompt(stocks: StockSnapshot[], analyses: StockAnalysis[]): string {

    const stockEntries = stocks.map((stock, i) => {
        const analysis = analyses.find((a) => a.ticker === stock.ticker);
        if (!analysis) {
            console.warn('No analysis found for ${stock.ticker}, skipping.');
            return null;
        }

        return `
        STOCK ${i + 1}: ${stock.ticker} (${stock.companyName})
        ${formatStockData(stock)}
        ANALYST Sentiment: ${analysis?.sentiment ?? 'neutral'}
        Bull Case: ${analysis?.bullCase.join('; ') ?? 'None'}
        Bear Case: ${analysis?.bearCase.join('; ') ?? 'None'}
        News Impact: ${analysis?.newsImpact ?? 'None'}
            `;
    }).join('\n')

    return `You are a DECISION ENGINE/ You do NOT write explanations.
    You receive stock data and an analyst's assessments for MULTIPLE stocks.
    Make a structured decision for EACH stock.
    
   ${stockEntries}
        
    DECISION RULES:
    - For EACH stock, pick ONE action from: BUY, SELL, HOLD, AVOID
    - Assign a probability (0.0 to 1.0) to EACH action. They must sum to 1.0.
    - Pick the optimal holding period: INTRADAY, SWING, or POSITIONAL.
    - Rate confidence 0-100. If unsure, give LOW confidence.
    - Rate risk: LOW, MEDIUM, or HIGH
    - If data is ambiguous or conflicting, choose AVOID with high probability.
    - Return decisions in the same ORDER as the stocks above.
    - Your probabilities and confidence MUST reflect the actual stock data above. Do NOT COPY example values.

    Respond in this EXACT JSON format, no other text:
    {
        "decisions":[
             {
        "action" :"<YOUR_DECISION>",
        "actionProbabilities": {
            "BUY": <YOUR_PROBABILITY>,
            "SELL":<YOUR_PROBABILITY>,
            "HOLD":<YOUR_PROBABILITY>,
            "AVOID":<YOUR_PROBABILITY>
        },
        "holdingPeriod" : "<YOUR_ASSESSMENT>",
        "confidence" : <YOUR_NUMBER_0_TO_100>,
        "riskLevel" : "<YOUR_ASSESSMENT>"
        }
        ]
    }
   
        `
}
