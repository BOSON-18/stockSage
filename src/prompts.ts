import { SECTOR_MAP } from "./config";
import { NewsItem, StockAnalysis, StockSnapshot, ScoredNewsItem, MarketContext, TechnicalIndicators } from "./types";

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
export function buildAnalysisPrompt(stocks: StockSnapshot[], news: NewsItem[], selectionReason?: Record<string, string>): string {

    // const stockDataText = stocks.map((s) => `\nSTOCK: ${s.ticker}\n${formatStockData(s)}`).join('\n');
    const stockDataText = stocks.map((s) => {
        const reason = selectionReason?.[s.ticker];
        const reasonLine = reason ? `\n SELECTED BECAUSE: ${reason}` : '';
        return `\nSTOCK: ${s.ticker}${reasonLine}\n${formatStockData(s)}`;
    }).join('\n');


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


// Jev News CLASSIFICATION PROMPT - Jev swipes each article
// is it relevant - imapct - severe - actionable?

export function buildNewsClassifyPrompt(articles: ScoredNewsItem[]): string {
    const articleList = articles.map((a, i) => {
        return `
        ARTICLE ${i + 1}:
        Title: ${a.title}
        Description: ${a.description}
        Source: ${a.source} (credibility: ${a.sourceTierWeight})
        Published: ${a.publishedAt}`
    }).join('\n\n');

    return `Your are a NEWS CLASSIFIER for an Indian stock market trading system. For EACH article below, make 4 assessments. Do NOT explain your reasoning.
    
    ASSESSMENT RULES:
    - relevance: probability (0.0 to 1.0) that this news is relevant to Indian stock market (NSE/BSE). Global news counts IF it affects Indian markets (US tarrifs, crude oil, Fed rates = relevant).
    - impactType: MACRO (affects entire market, e.g. RBI decision), SECTOR (affects one sector, e.g. crude oil affects oil stocks), COMPANY (affects specific compnay, e.g. quaterly results), NOISE (not market-relevant, e.g. clebrity news tagged as business).
    - severity: HIGH (can move stokcs 2%+), MEDIUM (can move stokcs 0.5-2%), LOW (minor effect).
    - actionable: probability (0.0 to 1.0) that a trader should act on this news TODAY. Old or vague news = low actionable. Breaking news with clear impact = high actionable.
    
    ARTICLES:
    ${articleList}

    Respond with ONE classification per article, in the SAME ORDER.
    Replace ALL placeholder values with your actual assessment:
    {
        "classifications" :[
        {
            "relevance" : <0.0_TO_1.0>,
            "impactType" : "<MACRO/SECTOR/COMPANY/NOISE>",
            "severity" : "<HIGH/MEDIUM/LOW>",
            "actionable" : <0.0_TO_1.0>
        }
        ]
    }

    `
}


// LLM STOCK EXTRACTIOJN PROMPT

export function buildStockExtractPrompt(articles: ScoredNewsItem[], maxBudget: number, dynamicSectorMap?: Record<string, string[]>): string {
    const mapToUse = dynamicSectorMap ?? SECTOR_MAP;

    const sectorRules = Object.entries(mapToUse).map(([sector, tickers]) => `- ${sector} -> ${tickers.join(', ')}`).join('\n\n');

    const articleList = articles.map((a, i) => `${i + 1}. ${a.title}\n  ${a.description}`).join('\n\n');


    return `You are a STOCK IDENTIFIER for the Indian market (NSE). Read the news articles below and identify which specific NSE stocks are mentioned or DIRECTLY affected.
    
    USER BUDGET: Rs.${maxBudget} per stock maximumm.
    IMPORTANT: Only suggest stocks priced BELOW Rs.${maxBudget} per share.
    Skip expensive stocks like MRF (Rs. 1,20,000+), BOSCHLTD (Rs. 30,000+),etc.
    Focus on stocks a retail investor with limited budget can actually buy.

    SECTOR MAPPING 9use these to connect news to stocks):
    ${sectorRules}
    
    RULES:
    - Only output NSE tickers with .NS suffix (e.g, RELIANCE.NS)
    - Only suggest stocks priced BELOW Rs.${maxBudget} per share
    - If a news article mentions a company directly, include that ticker(if affordable)
    - If a news article affects a SECTOR, include the AFFORDABLE tickers from the mapping above
    - For each ticker, write a short reason WHY this news affects it
    - Do NOT guess or include stocks that are not clearly affected
    - Maximum 20 tickers total
    
    NEWS ARTICLES:
    ${articleList}
    
    Respond in this JSON structure:
    {
    "stocks":[
    {
    "ticker": "<TICKER.NS>;
    "reason": ">why this stock is affected by the news>"
    
    }]
    
    }`
};


// JEV STOCK GATE PROMPT - It decided which are worth for deep analysis

export function buildJevGatePrompt(
    stocks: StockSnapshot[],
    articles: ScoredNewsItem[],
    marketContext: MarketContext
): string {
    const newsHeadlines = articles.map((a) => `- ${a.title}`).join('\n');

    const stockList = stocks.map((s) => {
        const volumeRatio = s.avgVolume > 0 ? (s.volume / s.avgVolume).toFixed(1) : 'N/A';
        return `${s.ticker}: Rs.${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), vol ${volumeRatio}% avg, PE ${s.pe?.toFixed(1) ?? 'N/A'}`;
    }).join('\n');


    return `You are a STOCK SCREENER. Decide which stocks are worth deep analysis TODAY. Do NOT explain your reasoning - just output probabilities.

MARKET CONTEXT:
    NIFTY: ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}%
    Regime: ${marketContext.regime}

TODAY'S KEY NEWS:
${newsHeadlines}

CANDIDATE STOCKS:
${stockList}

For EACH stock, answer: "Is this stock worth deep analysis today?"
Consider: Does it have a news catalyst? Is it moving significantly? Is volume unusual?
Probability 1.0 = definitely analyze, 0.0 = definitely skip.

Respond in this JSON structure:
{
"gates":[
{
"ticker": "<TICKER.NS>",
"worthAnalyzing" : <0.0_TO_1.0>
}]
}
    
`
}

// COMMITTEEE AGENTS PROMPTS
// -- RISK AGENT - EXCEPTION -Sees everything 

const AGENT_VERDICT_FORMAT = `
{

"verdicts":[
    {
        "ticker": "<TICKER.NS>",
        "sentiment":"<BULLISH_OR_BEARISH_OR_NEUTRAL_OR_CAUTION>",
        "confidence": <0_TO_100>,
        "expectedMovePercent: <POSITIVE_OR_NEGATIVE_NUMBER>,
        "reasoning":"<YOUR_REASONING_HERE>"
    }
]
}
`

//  AGENT - 1 NEWS ANALYST - sees ONLY news+stock names

export function buildNewsAgentPrompt(
    tickers: string[],
    news: ScoredNewsItem[]
): string {

    const tickerList = tickers.join(', ');
    const newsText = news.map((n) => `${n.title}\n ${n.description}`).join('\n');

    return ` 
        You are a NEWS ANALYST. You assess how today's news affects specific stocks. You do NOT look at prices, PE ratios, or charts - only NEWS.

        STOCKS TO ANALYZE: ${tickerList}

        TODAY'S NEWS:
        ${newsText}

    For EACH stock, assess:
    - Does any news directly or indirectly affect it?
    - Is the news sentiment positive or negative for this tock?
    - How much could the news move the stock? (estimate %)

    If now news affects a stock, say NEUTRAL with low confidence.
    Respond in this JSON strcuture:
    ${AGENT_VERDICT_FORMAT} 

    `
}

// AGENT 2 TECHNICAL ANALYST - sees only price, volume, Mas, 52W range


export function buildTechnicalAgentPrompt(stocks: StockSnapshot[], indicators?: Record<string, TechnicalIndicators>): string {
    const stockData = stocks.map((s) => {
        const volRatio = s.avgVolume > 0 ? (s.volume / s.avgVolume).toFixed(1) : 'N/A';
        const pos52W = s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow ? (((s.price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow)) * 100).toFixed(0) : 'N/A';

        // return `${s.ticker}: Rs.${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), Vol ${volRatio}x avg, 52W pos: ${pos52W}%, 50DMA: Rs.${s.fiftyDayAvg.toFixed(2)}, 200DMA: Rs.${s.twoHundredDayAvg.toFixed(2)}, ${s.price > s.twoHundredDayAvg ? 'ABOVE' : 'BELOW'} 200DMA`

        let line = `${s.ticker}: Rs.${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), Vol ${volRatio}x avg, 52W pos: ${pos52W}%, ${s.price > s.twoHundredDayAvg ? 'ABOVE' : 'BELOW'}200DMA`
        const ind = indicators?.[s.ticker];

        if (ind) {
            line += `\n RSI: ${ind.rsi.toFixed(1)} (${ind.rsiSignal})`;
            line += `\n MACD: line ${ind.macdLine.toFixed(2)}, signal ${ind.signalLine.toFixed(2)} | histogram ${ind.histogram.toFixed(2)} (${ind.macdSignal})`;
            line += `\n Bollinger: lower Rs.${ind.bollingerLower.toFixed(2)} | mid Rs.${ind.bollingerMiddle.toFixed(2)} | upper Rs.${ind.bollingerUpper.toFixed(2)} (at ${ind.bollingerSqueeze ? ', SQUEEZE detected' : ''})`;
            if (ind.nearestSupport > 0 || ind.nearestResistance > 0) {
                line += `\n Support: Rs.${ind.atr.toFixed(2)} (${ind.atrPercent.toFixed(1)}% daily volatility)`;
            }

        }

        return line;

    }).join('\n');

    return `
        You are a TECHNICAL ANALYST. You assess stocks based ONLY on price action, indicators, and chart patterns. You do NOT look at news, PE ratios, or company fundamentals.

        INDICATOR RULES:
        - RSI > 70 = overbought (might fall). RSI <30 = oversold (might bounce).
        - MACD bullish crossover = momentum turning positive. Bearish = negative.
        - Bollinger SQUEEZE = big move coming, direction unclear. At LOWER band = mean reversion opportunity.
        - Price near support = low risk entry. Near resistance = caution.
        - High ATR = volatile stock, needs wider stop loss.
        - Above 200DMA = long-term uptrend. Below = downtrend.

    STOCK DATA:
    ${stockData}

    For EACH stock, assess the technical picture.
    Respond in this JSOn structure: ${AGENT_VERDICT_FORMAT}
    `
}

// AGENT 3 - FUNDAMANETAL ANALYST - Sees ONLY PE, market cap , sector
export function buildFundamentalAgentPrompt(stocks: StockSnapshot[]): string {

    const stockData = stocks.map((s) => `${s.ticker} (${s.companyName}): PE ${s.pe?.toFixed(1) ?? 'N/A'}, Market Cap Rs.${(s.marketCap / 1e7).toFixed(0)} Cr`).join('\n')


    return `
        You are a FUNDAMENTAL ANALYST. You assess wether stocks are overvalued or undervalued.
        You do NOT look at news, price charts, or volume - only VALUATION.

        RULES:
        - PE below sector average = potentially undervalued
        - PE above sector average = potentially overvalued
        - PE N/A = loss-making comapny, higher risk
        - Large cap (>20,000 Cr) = stable. Mid cap (5,000 - 20,000) = moderate. Small cap (<5,000) = volatile.

        STOCK DATA:
        ${stockData}

        For EACH stock, assess the valuation.
        Respond in this JSOn structure:${AGENT_VERDICT_FORMAT}
    `;
}

// AGENT 4: MACRO/SECTOR ANALYST - sees ONLY market context + stock names

export function buildMacroAgentPrompt(
    tickers: string[],
    marketContext: MarketContext
) {

    return ` 
    You are a MACRO/SECTOR ANALYST. Assess the broader market environemt. Do NOT look at individual stock prices or news - only the BIG PICTURE.

    MARKET:
        Nifty: ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}%
        Sensex: ${marketContext.sensexChangePercent >= 0 ? '+' : ''}${marketContext.sensexChangePercent.toFixed(2)}%
        Regime: ${marketContext.regime}

    STOCKS: ${tickers.join(', ')}

    Is the market favorable? Is each stock's sector likely to outperform or underperform?
    Respond in JSON:${AGENT_VERDICT_FORMAT}
    `;

}

// AGENT 5: RISK - sees everything

export function buildRiskAgentPrompt(
    stocks: StockSnapshot[], news: ScoredNewsItem[], marketContext: MarketContext, indicators?: Record<string, TechnicalIndicators>
): string {
    const data = stocks.map((s) => {
        const vol = s.avgVolume > 0 ? (s.volume / s.avgVolume).toFixed(1) : 'N/A';
        const pos = s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow ? (((s.price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow)) * 100).toFixed(0) : 'N/A';

        // return `${s.ticker}: Rs.${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), PE ${s.pe?.toFixed(1) ?? 'N/A'}, Vol ${vol}x, 52W: ${pos}%`;

        let line = `${s.ticker}: Rs.${s.price.toFixed(2)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%), PE ${s.pe?.toFixed(1) ?? 'N/A'}, Vol${vol}x, 52W: ${pos}%`

        const ind = indicators?.[s.ticker];

        if (ind) {
            line += `\n RSI: ${ind.rsi.toFixed(1)}(${ind.rsiSignal})`;
            line += ` | ATR: Rs. ${ind.atr.toFixed(2)} (${ind.atrPercent.toFixed(1)}% daily swing)`;
            if (ind.bollingerSqueeze) line += ' | BOLLINGER SQUEEZE 9big move iminent)';
            if (ind.rsi > 70) line += '| ⚠️ OVERBOUGHT';
            if (ind.rsi < 30) line += ' | ⚠️ OVERSOLD  -could keep falling';


        }

        return line;

    }).join('\n');


    const newsText = news.slice(0, 5).map((n) => `- ${n.title}`).join('\n');
    return `
    You are a RISK ANALYST. Find what could GO WRONG. Be pessimistic - your job is to PROTECT.
    You see ALL data + technical indicators because risk comes from unexpected connections.
    
    MARKET: Nifty ${marketContext.niftyChangePercent >= 0 ? '+' : ''}${marketContext.niftyChangePercent.toFixed(2)}%, Regime: ${marketContext.regime}

    RISK INDICATORS RULES:
    - RSI >70 = overbought, vulnerable to pullback
    - RSI < 30 = oversold, but coulkd keep falling in a downtrend (don't catch falling knife)
    - High ATR% = volatile stock, stop loss must be wider than usual
    - Bollinger SQUEEZE = big move coming - could go either direction
    - Near 52W high (>90%) = limited upside, potential reversal
    
    NEWS:
    ${newsText}

    STOCKS:
    ${data}

    For EACH stock: worst case? Overbought/oversold risk? Volatility risk? Macro risks?
    expectedMovePercent should be NEGATIVE (showing downside risk).
    Respond in JSON: ${AGENT_VERDICT_FORMAT} 
    `
}


//  JEV COMITTEE Voting Prompt

export function buildJevVotePrompt(
    stocks: StockSnapshot[],
    allVerdicts: Record<string, { agent: string; sentiment: string; confidence: number; reasoning: string }[]>
): string {

    const verdictText = stocks.map((s) => {
        const v = allVerdicts[s.ticker] ?? [];
        const lines = v.map((x) => ` ${x.agent}: ${x.sentiment} (${x.confidence}%) - ${x.reasoning}`).join('\n');
        return `STOCK: ${s.ticker} (Rs.${s.price.toFixed(2)})\n${lines}`;
    }).join('\n\n');

    return `   
    You are the FINAL DECISION MAKER. 5 experts gave opinions. Weigh ALL and decide.

    RULES:
    - Strong RISK warning can override multiple bullish opinions
    - If agents disagree heavily -> lower confidence
    - If most are NEUTRAL -> HOLD or AVOID
    - Probabilities must sum to 1.0

    COMMITTEE:
    ${verdictText}

    Final decision per stock:
    {
        "decisions": [
            {
                "action": "<BUY_OR_SELL_OR_HOLD_OR_AVOID>",
                "actionProbabilities": {"BUY":<0.0-1.0>,"SELL":<0.0-1.0>,"HOLD":<0.0-1.0>,"AVOID":<0.0-1.0>},
                "holdingPeriod": "<INTRADAY_OR_SWING_OR_POSITIONAL>",
                "confidence": <0_TO_100>,
                "riskLevel":"<LOW_OR_MEDIUM_OR_HIGH>"
            }
        ]
    }

    `
}