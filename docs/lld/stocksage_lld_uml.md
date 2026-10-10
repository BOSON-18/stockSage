# StockSage — Low-Level Design (LLD) UML Diagram

> **Version:** v0.8 · **Architecture:** CLI Node.js + TypeScript · **AI:** DeepSeek LLM + Jev (TypeSafe AI)

---

## 1. System Overview

```mermaid
graph TB
    subgraph ENTRY["🚀 Entry Point"]
        MAIN["main() — index.ts\nOrchestrator"]
    end

    subgraph SECURITY["🔒 Security Layer"]
        ENV["EnvValidator\nvalidateEnv()"]
        TRACKER["CostTracker\ncheckDailyLimit()\ntrackCost()\ngetCostSummary()"]
        SAN["Sanitizer\nsanitizePortfolio()"]
    end

    subgraph DATA_LAYER["📡 Data Layer (External APIs)"]
        MC["MarketContextFetcher\nfetchMarketContext()"]
        NF["NewsFetcher\nfetchAllNews()\nfetchStockNewsBatch()"]
        SF["StockFetcher\nfetchStockData()\nformatStockData()"]
        HF["HistoricalFetcher\nfetchHistoricalBatch()"]
        FF["FinancialFetcher\nfetchFinancialsBatch()\nformatFinancialsForPrompt()"]
        MDF["MarketDataFetcher\nfetchMarketData()\nformatFiiDii()"]
        PF["PortfolioFetcher\nfetchPortfolio()"]
        SU["StockUniverse\nfetchStockUniverse()\nbuildDynamicSectorMap()\nisValidTicker()"]
        QS["QuantScanner\nrunQuantScanner()"]
        PT["PaperTrade\nsaveRecommendations()\ncheckOutcomes()\ngetPerformanceSummary()\ngetLessonsForPrompt()"]
    end

    subgraph PROCESSING["⚙️ Processing Layer"]
        NS["NewsScorer\nscoreNewsBatch()\nfilterByScore()\ndeduplicateNews()"]
        IND["IndicatorsEngine\ncomputeAllIndicators()\ncomputeRSI()\ncomputeMACD()\ncomputeBollinger()\ncomputeATR()"]
        SR["SupportResistance\nfindSupportResistance()"]
    end

    subgraph AI_LAYER["🤖 AI Layer"]
        JEV_PROV["JevProvider\ngetJevProvider()\nMockJevProvider / RealJevProvider"]
        JEV_GATE["JevGate\njevGateCandidates()\njevGateStock()"]
        JEV_NEWS["JevNewsClassifier\njevClassifyNews()"]
        DISCOVERY["StockDiscovery\nextractStocksFromNews()\nbuildCandidateList()\nfilterByBudget()"]
        LLM["LLMClient\ncallLLM()"]
        COMMITTEE["Committee\nrunCommittee()\njevCommitteeVote()"]
        VERIFIER["Verifier\nverifyCommitteeResults()\nverifyClaims()"]
        AGENTS["JevAgents\ntechnicalAgentJev()\nfundamentalAgentjev()\nmacroAgentJev()"]
    end

    subgraph OUTPUT["📊 Output Layer"]
        RANK["Ranker\nrankAndFilter()"]
        MERGE["Merger\nmergeResults()"]
        DISPLAY["DisplayEngine\ndisplayResults()"]
    end

    MAIN --> SECURITY
    MAIN --> DATA_LAYER
    MAIN --> PROCESSING
    MAIN --> AI_LAYER
    MAIN --> OUTPUT
```

---

## 2. Complete Class & Interface Diagram

```mermaid
classDiagram

    %% ─────────── TYPES ───────────

    class StockSnapshot {
        +ticker: string
        +companyName: string
        +price: number
        +changePercent: number
        +pe: number | null
        +marketCap: number
        +volume: number
        +avgVolume: number
        +fiftyTwoWeekHigh: number
        +fiftyTwoWeekLow: number
        +fiftyDayAvg: number
        +twoHundredDayAvg: number
    }

    class CandidateStock {
        +ticker: string
        +source: news | top_mover | watchlist
        +reason: string
    }

    class MarketContext {
        +niftyPrice: number
        +niftyChangePercent: number
        +sensexChangePercent: number
        +regime: MarketRegime
        +upsideRange: RangeMinMax
        +downsideRange: RangeMinMax
        +jevGateThreshold: number
        +giftNiftyChange?: number
        +marketState?: string
    }

    class NewsItem {
        +title: string
        +description: string
        +source: string
        +publishedAt: string
    }

    class ScoredNewsItem {
        +sourceTierWeight: number
        +freshnessScore: number
        +crossSourceCount: number
        +crossSourceMultiplier: number
    }

    class TechnicalIndicators {
        +rsi: number
        +rsiSignal: OVERBOUGHT | OVERSOLD | NEUTRAL
        +macdLine: number
        +signalLine: number
        +histogram: number
        +macdSignal: BULLISH_CROSSOVER | BEARISH_CROSSOVER | NEUTRAL
        +bollingerUpper: number
        +bollingerMiddle: number
        +bollingerLower: number
        +bollingerPosition: UPPER | LOWER | MIDDLE
        +bollingerSqueeze: boolean
        +nearestSupport: number
        +nearestResistance: number
        +supportDistance: number
        +resistanceDistance: number
        +atr: number
        +atrPercent: number
    }

    class OHLCV {
        +date: Date
        +open: number
        +high: number
        +low: number
        +close: number
        +volume: number
    }

    class AgentVerdict {
        +ticker: string
        +sentiment: BULLISH | BEARISH | NEUTRAL | CAUTION
        +confidence: number
        +expectedMovePercent: number
        +reasoning: string
    }

    class JevDecision {
        +action: BUY | SELL | HOLD | AVOID
        +actionProbabilities: ActionProbs
        +holdingPeriod: INTRADAY | SWING | POSITIONAL
        +confidence: number
        +riskLevel: LOW | MEDIUM | HIGH
    }

    class Recommendation {
        +ticker: string
        +companyName: string
        +currentPrice: number
        +targetPrice: number
        +stopLoss: number
        +committeeVerdicts: AgentVerdict[]
        +action: string
        +confidence: number
        +holdingPeriod: string
        +riskLevel: string
        +jevProbabilities: Record
        +newsContext: string[]
    }

    class JevNewsClassification {
        +relevance: number
        +impactType: MACRO | SECTOR | COMPANY | NOISE
        +severity: HIGH | MEDIUM | LOW
        +actionable: number
    }

    class Holding {
        +ticker: string
        +companyName: string
        +quantity: number
        +avgPrice: number
        +currentPrice: number
        +pnlPercent: number
        +sector: string
    }

    class PortfolioSummary {
        +holdings: Holding[]
        +totalInvested: number
        +totalCurrent: number
        +overallPnlPercent: number
        +availableCash: number
    }

    class SanitizedPortfoilio {
        +holdingSummaries: HoldingSummary[]
        +overallStatus: string
        +existingTickers: string[]
        +existingSectors: string[]
    }

    class PaperTrade {
        +date: string
        +ticker: string
        +action: string
        +entryPrice: number
        +targetPrice: number
        +stopLoss: number
        +confidence: number
        +jevBuyProb: number
        +holdingPeriod: string
        +currentPrice?: number
        +pnlPercent?: number
        +outcome?: WIN | LOSS | OPEN | HIT_TARGET | HIT_STOPLOSS
        +failureReason?: string
        +lessonGenerated?: string
    }

    class VerfiedClaim {
        +claim: string
        +status: VERIFIED | DISPUTED | OPINION
        +confidence: number
    }

    class CostEntry {
        +date: string
        +provider: string
        +inputTokens: number
        +outputTokens: number
        +costUsd: number
    }

    class StockFinancials {
        +revenueGrowthYoy: number | null
        +profitMargin: number | null
        +debtToEquity: number | null
        +returnOnEquity: number | null
        +recommendationMean: number | null
        +numberOfAnalysts: number | null
    }

    %% ─────────── RELATIONSHIPS ───────────

    ScoredNewsItem --|> NewsItem : extends
    PortfolioSummary "1" *-- "many" Holding : contains
    SanitizedPortfoilio ..> PortfolioSummary : derived from
    Recommendation "1" *-- "many" AgentVerdict : committeeVerdicts
    PaperTrade ..> Recommendation : saved from
    OHLCV ..> TechnicalIndicators : used to compute
```

---

## 3. Detailed Execution Flow — Phase-by-Phase

```mermaid
sequenceDiagram
    autonumber
    participant MAIN as main()
    participant SEC as Security Layer
    participant PORTFOLIO as PortfolioFetcher
    participant UNIVERSE as StockUniverse
    participant MARKET as MarketContextFetcher
    participant NEWS as NewsFetcher
    participant SCORER as NewsScorer
    participant JEV_NEWS as JevNewsClassifier
    participant DISCOVERY as StockDiscovery
    participant QUANT as QuantScanner
    participant SF as StockFetcher
    participant HIST as HistoricalFetcher
    participant INDIC as IndicatorsEngine
    participant FIN as FinancialFetcher
    participant MKT_DATA as MarketDataFetcher
    participant COMMITTEE as Committee
    participant AGENTS as JevAgents
    participant LLM as LLMClient
    participant JEV as JevProvider
    participant VERIFIER as Verifier
    participant RANK as Ranker
    participant PT as PaperTrade
    participant DISPLAY as DisplayEngine

    Note over MAIN: PRE-FLIGHT
    MAIN->>SEC: validateEnv()
    SEC-->>MAIN: bool (abort if false)
    MAIN->>SEC: checkDailyLimit()
    SEC-->>MAIN: {ok, todaySpend}

    Note over MAIN: PHASE -1: PAST TRADE REVIEW
    MAIN->>PT: checkOutcomes()
    PT-->>MAIN: {checked, wins, losses, winRate, avgPnl, lessons}

    Note over MAIN: PHASE 0: UNIVERSE + PORTFOLIO
    MAIN->>UNIVERSE: fetchStockUniverse()
    UNIVERSE-->>MAIN: UniverseStock[]
    MAIN->>UNIVERSE: buildDynamicSectorMap(universe)
    UNIVERSE-->>MAIN: Record sectorMap
    MAIN->>PORTFOLIO: fetchPortfolio()
    PORTFOLIO-->>MAIN: PortfolioSummary | null
    MAIN->>SEC: sanitizePortfolio(rawPortfolio)
    SEC-->>MAIN: SanitizedPortfoilio

    Note over MAIN: PHASE 1: PARALLEL MARKET + NEWS FETCH
    par Parallel Fetch
        MAIN->>MARKET: fetchMarketContext()
        MARKET-->>MAIN: MarketContext
    and
        MAIN->>NEWS: fetchAllNews()
        NEWS-->>MAIN: NewsItem[]
    end

    Note over MAIN: PHASE 2: NEWS FILTERING
    MAIN->>SCORER: scoreNewsBatch(allNews)
    SCORER-->>MAIN: ScoredNewsItem[] (deduped + scored)
    MAIN->>JEV_NEWS: jevClassifyNews(scoredNews)
    JEV_NEWS->>JEV: noul() × N articles
    JEV_NEWS->>JEV: choice(MACRO|SECTOR|COMPANY|NOISE)
    JEV_NEWS->>JEV: choice(HIGH|MEDIUM|LOW)
    JEV_NEWS->>JEV: noul() actionable
    JEV-->>JEV_NEWS: JevNewsClassification[]
    JEV_NEWS-->>MAIN: JevNewsClassification[]
    MAIN->>SCORER: filterByScore(scored, jevClassifications)
    SCORER-->>MAIN: filteredNews ScoredNewsItem[]

    Note over MAIN: PHASE 3: STOCK DISCOVERY
    MAIN->>DISCOVERY: extractStocksFromNews(filteredNews, sectorMap)
    DISCOVERY->>LLM: callLLM(buildStockExtractPrompt)
    LLM-->>DISCOVERY: {sectors[], companies[]}
    DISCOVERY->>UNIVERSE: isValidTicker() × N companies
    DISCOVERY-->>MAIN: CandidateStock[] (news-driven)

    MAIN->>QUANT: runQuantScanner(allTickers)
    QUANT-->>MAIN: CandidateStock[] (scanner-driven)

    MAIN->>DISCOVERY: buildCandidateList(combined)
    DISCOVERY-->>MAIN: CandidateStock[] (max 50, deduped)

    Note over MAIN: PHASE 3a: STOCK DATA + BUDGET FILTER
    MAIN->>SF: fetchStockData(candidateTickers)
    SF-->>MAIN: raw quotes
    MAIN->>SF: formatStockData(rawQuotes)
    SF-->>MAIN: StockSnapshot[]
    MAIN->>DISCOVERY: filterByBudget(stocks)
    DISCOVERY-->>MAIN: affordable StockSnapshot[]

    Note over MAIN: PHASE 3b: JEV GATE
    MAIN->>DISCOVERY: jevGateCandidates(stocks, filteredNews, marketContext)
    DISCOVERY->>JEV: noul() × N stocks
    JEV-->>DISCOVERY: probability
    DISCOVERY-->>MAIN: gatedTickers string[]

    Note over MAIN: PHASE 3c: HISTORICAL + INDICATORS
    MAIN->>HIST: fetchHistoricalBatch(gatedTickers)
    HIST-->>MAIN: Record OHLCV[]
    MAIN->>INDIC: computeAllIndicators(ohlcv, price) × N stocks
    INDIC-->>MAIN: Record TechnicalIndicators

    Note over MAIN: PHASE 3.5: STOCK-SPECIFIC NEWS
    MAIN->>NEWS: fetchStockNewsBatch(gatedStocks)
    NEWS-->>MAIN: Record newsItems[] per ticker

    Note over MAIN: PHASE 3.6: FULL FINANCIALS
    MAIN->>FIN: fetchFinancialsBatch(gatedTickers)
    FIN-->>MAIN: Record StockFinancials

    Note over MAIN: PHASE 3.7: MARKET DATA (FII/DII + EARNINGS)
    MAIN->>MKT_DATA: fetchMarketData(gatedTickers)
    MKT_DATA-->>MAIN: {fiiDii, earnings}

    Note over MAIN: PHASE 4: 5-AGENT COMMITTEE
    MAIN->>COMMITTEE: runCommittee(gatedStocks, news, marketContext, indicators, portfolio, newsMap, financials, fiiDii, earnings)

    COMMITTEE->>LLM: callLLM(buildNewsAgentPrompt) → NEWS agent
    LLM-->>COMMITTEE: AgentVerdict[] (news)
    COMMITTEE->>LLM: callLLM(buildRiskAgentPrompt) → RISK agent
    LLM-->>COMMITTEE: AgentVerdict[] (risk)

    COMMITTEE->>AGENTS: technicalAgentJev(stocks, indicators)
    AGENTS->>JEV: choice(BULLISH|BEARISH|NEUTRAL|CAUTION)
    AGENTS->>JEV: noul() confidence
    AGENTS-->>COMMITTEE: AgentResult[] (TECHNICAL)

    COMMITTEE->>AGENTS: fundamentalAgentjev(stocks, financials)
    AGENTS->>JEV: choice(BULLISH|BEARISH|NEUTRAL|CAUTION)
    AGENTS->>JEV: noul() confidence
    AGENTS-->>COMMITTEE: AgentResult[] (FUNDAMENTAL)

    COMMITTEE->>AGENTS: macroAgentJev(stocks, marketContext, fiiDii, earnings)
    AGENTS->>JEV: choice(BULLISH|BEARISH|NEUTRAL|CAUTION)
    AGENTS->>JEV: noul() confidence
    AGENTS-->>COMMITTEE: AgentResult[] (MACRO)

    COMMITTEE->>VERIFIER: verifyCommitteeResults(verdictMap, dataContexts)
    VERIFIER->>JEV: noul() × N claims (NEWS + RISK verdicts only)
    JEV-->>VERIFIER: probability
    VERIFIER-->>COMMITTEE: Record VerfiedClaim[]

    COMMITTEE-->>MAIN: {verdictMap, verificationMap}

    Note over MAIN: PHASE 5: JEV FINAL VOTE
    MAIN->>COMMITTEE: jevCommitteeVote(gatedStocks, verdictMap, ownedTickers)
    COMMITTEE->>JEV: choice(BUY|AVOID or BUY_MORE|HOLD|SELL|AVOID)
    COMMITTEE->>JEV: choice(INTRADAY|SWING|POSITIONAL)
    COMMITTEE->>JEV: choice(LOW|MEDIUM|HIGH) risk
    COMMITTEE->>JEV: noul() confidence
    JEV-->>COMMITTEE: results
    COMMITTEE-->>MAIN: JevDecision[]

    Note over MAIN: PHASE 6: OUTPUT
    MAIN->>RANK: rankAndFilter(recommendations)
    RANK-->>MAIN: Recommendation[] (sorted, filtered)
    MAIN->>PT: saveRecommendations(ranked)
    PT-->>MAIN: saved to paper-trades.json
    MAIN->>DISPLAY: displayResults(ranked, marketContext, indicatorsMap, verificationMap)
    DISPLAY-->>MAIN: console output

    Note over MAIN: PHASE 7: PORTFOLIO ANALYSIS (if holdings exist)
    MAIN->>COMMITTEE: runCommittee(freshHoldings, ...)
    COMMITTEE-->>MAIN: {holdVerdicts}
    MAIN->>COMMITTEE: jevCommitteeVote(freshHoldings, holdVerdicts, holdingTickers)
    COMMITTEE-->>MAIN: JevDecision[]
```

---

## 4. JevProvider Strategy Pattern

```mermaid
classDiagram
    class JevProvider {
        <<interface>>
        +choice(context, question, options) ChoiceResult
        +score(context, question, levels) ScoreResult
        +noul(context, question) NoulResult
    }

    class MockJevProvider {
        +choice(context, question, options) ChoiceResult
        +score(context, question, levels) ScoreResult
        +noul(context, question) NoulResult
        -callLLM(prompt) string
    }

    class RealJevProvider {
        -client: TypeSafeClient
        -initialized: boolean
        +init() void
        +choice(context, question, options) ChoiceResult
        +score(context, question, levels) ScoreResult
        +noul(context, question) NoulResult
    }

    class JevProviderFactory {
        -_provider: JevProvider | null
        -USE_REAL_JEV: boolean
        +getJevProvider() JevProvider
    }

    class ChoiceResult {
        +selected: string
        +probabilities: Record string-number
    }

    class ScoreResult {
        +level: string
        +levelIndex: number
    }

    class NoulResult {
        +probability: number
    }

    JevProvider <|.. MockJevProvider : implements
    JevProvider <|.. RealJevProvider : implements
    JevProviderFactory ..> JevProvider : creates
    JevProviderFactory ..> MockJevProvider : when no API key
    JevProviderFactory ..> RealJevProvider : when TYPESAFE_API_KEY or VERCEL_API_KEY set
    MockJevProvider ..> ChoiceResult : returns
    MockJevProvider ..> ScoreResult : returns
    MockJevProvider ..> NoulResult : returns
    RealJevProvider ..> ChoiceResult : returns
    RealJevProvider ..> ScoreResult : returns
    RealJevProvider ..> NoulResult : returns
```

---

## 5. Committee Architecture — 5 Agents

```mermaid
graph TD
    subgraph INPUT["Inputs to Committee"]
        STK["StockSnapshot[]"]
        NEWS["ScoredNewsItem[]"]
        MKT["MarketContext"]
        IND["TechnicalIndicators Map"]
        PORT["SanitizedPortfoilio"]
        NMAP["Stock News Map"]
        FIN["Financials Map"]
        FII["FII/DII Context"]
        EARN["Earnings Map"]
    end

    subgraph LLM_AGENTS["LLM-Based Agents (DeepSeek/Ollama)"]
        NEWS_AGENT["📰 NEWS ANALYST\nLLM-based\nbuildNewsAgentPrompt()\ncallLLM() → parse → validate Zod\nOutputs: sentiment, confidence, expectedMove"]
        RISK_AGENT["⚠️ RISK ANALYST\nLLM-based\nbuildRiskAgentPrompt()\ncallLLM() → parse → validate Zod\nOutputs: downside estimate, risk signals"]
    end

    subgraph JEV_AGENTS["Jev-Based Agents (TypeSafe AI)"]
        TECH_AGENT["📈 TECHNICAL AGENT\ntechnicalAgentJev()\nRSI + MACD + Bollinger + 200DMA + Volume\njev.choice() + jev.noul()\nOutputs: BULLISH/BEARISH/NEUTRAL/CAUTION"]
        FUND_AGENT["💰 FUNDAMENTAL AGENT\nfundamentalAgentjev()\nPE + Revenue Growth + Margin + D/E + ROE + Analyst\njev.choice() + jev.noul()\nOutputs: valuation verdict + confidence"]
        MACRO_AGENT["🌍 MACRO AGENT\nmacroAgentJev()\nNifty% + Regime + FII/DII + GIFT Nifty + Earnings\njev.choice() + jev.noul()\nOutputs: macro environment verdict"]
    end

    subgraph VERIFIER["🔍 Claim Verifier"]
        VER["verifyCommitteeResults()\nSplits reasoning into claims\nFilters predictive vs factual claims\njev.noul() per factual claim\nOutputs: VERIFIED / DISPUTED / OPINION"]
    end

    subgraph OUTPUT["Committee Output"]
        VM["verdictMap\nRecord ticker → AgentVerdict[]"]
        VMAP["verificationMap\nRecord ticker → VerfiedClaim[]"]
    end

    INPUT --> LLM_AGENTS
    INPUT --> JEV_AGENTS
    LLM_AGENTS --> VM
    JEV_AGENTS --> VM
    VM --> VERIFIER
    VERIFIER --> VMAP
```

---

## 6. News Processing Pipeline

```mermaid
flowchart TD
    A["Raw News\nNewsItem[]"]
    B["Cross-Source Count\ngetCrossSourceCount()"]
    C["Deduplication\ndeduplicateNews()\n70% title similarity threshold\nKeep highest-tier source"]
    D["Scoring\nattach sourceTierWeight\nfreshnessScore\ncrossSourceMultiplier"]
    E["Pre-filter\nTop 50 by composite score\nscore = sourceTier × freshness × crossMultiplier"]
    F["ScoredNewsItem[]"]
    G["Jev Classification\njevClassifyNews()\nPer article:\n• relevance: noul()\n• impactType: choice(MACRO|SECTOR|COMPANY|NOISE)\n• severity: choice(HIGH|MEDIUM|LOW)\n• actionable: noul()"]
    H["Combined Filter\nfilterByScore()\nweightedScore formula:\n0.30×relevance + 0.25×severity\n+ 0.20×actionable + 0.15×sourceTier\n+ 0.10×freshness × crossMultiplier"]
    I["Threshold ≥ 0.40"]
    J["High-Quality\nfilteredNews"]
    K["Discarded\nNOISE / Low Score"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I -->|Pass| J
    I -->|Fail| K
```

---

## 7. Stock Discovery Pipeline

```mermaid
flowchart TD
    FN["filteredNews\nScoredNewsItem[]"]
    QS_START["Universe Tickers\nstring[]"]

    subgraph NEWS_EXTRACT["3a: News-driven Discovery"]
        PROMPT["buildStockExtractPrompt()\nLLM → {sectors[], companies[]}"]
        SEC_MAP["Sector Map Resolution\nconfig SECTOR_MAP\ndynamicSectorMap from universe"]
        VALIDATE["isValidTicker()\ncheck against EQUITY_L\nrejects hallucinated tickers"]
        NEWS_CANDS["CandidateStock[]\nsource: 'news'"]
    end

    subgraph QUANT_SCAN["3b: Quant Scanner"]
        QS_FETCH["fetchStockData(allTickers)\nbatch Yahoo Finance quotes"]
        QS_FILTER["Filter: price momentum\nvolume breakouts\n52W position signals"]
        QS_CANDS["CandidateStock[]\nsource: 'top_mover'"]
    end

    subgraph BUILD_LIST["buildCandidateList()"]
        WL["+ Watchlist\nsource: 'watchlist'"]
        DEDUP["Dedup by ticker"]
        FALLBACK["Safety Net: fetchTopMovers()\nif total < 5 candidates"]
        MAX["Slice to MAX_CANDIDATES = 50"]
    end

    subgraph GATE["3e: Jev Gate"]
        BUDGET["filterByBudget()\nMAX_PRICE_PER_STOCK\n= TOTAL_BUDGET / MAX_STOCKS"]
        JEV_GATE["jevGateCandidates()\njev.noul() per stock\nthreshold: regime-based\nCALM=50% | VOLATILE=40% | CRASH=30%"]
        PASS["gatedStocks\n≤ MAX_TO_ANALYZE = 10"]
    end

    FN --> NEWS_EXTRACT
    PROMPT --> SEC_MAP --> VALIDATE --> NEWS_CANDS
    QS_START --> QUANT_SCAN
    QS_FETCH --> QS_FILTER --> QS_CANDS

    NEWS_CANDS --> BUILD_LIST
    QS_CANDS --> BUILD_LIST
    WL --> DEDUP --> FALLBACK --> MAX

    MAX --> BUDGET --> JEV_GATE
    JEV_GATE -->|Pass| PASS
    JEV_GATE -->|Fail| SKIP["Skipped"]
```

---

## 8. Technical Indicators Engine

```mermaid
classDiagram

    class IndicatorsEngine {
        +computeAllIndicators(ohlcv, price) TechnicalIndicators
    }

    class SMAComputer {
        +computeSMA(data, period) number
        «takes last N values»
        «returns average»
    }

    class EMAComputer {
        +computeEMA(data, period) number[]
        «multiplier = 2 / (period + 1)»
        «seed with first SMA»
    }

    class RSIComputer {
        +computeRSI(closes, period=14) number
        «calculates avg gain / avg loss»
        «RSI = 100 - (100 / (1 + RS))»
        «<30 = OVERSOLD, >70 = OVERBOUGHT»
    }

    class MACDComputer {
        +computeMACD(closes) MACDResult
        «EMA(12) - EMA(26) = MACD Line»
        «Signal = EMA(9) of MACD Line»
        «Histogram = MACD - Signal»
        «BULLISH_CROSSOVER / BEARISH_CROSSOVER»
    }

    class BollingerComputer {
        +computeBollinger(closes, period=20) BollingerResult
        «Middle = SMA(20)»
        «StdDev × 2»
        «Upper / Lower bands»
        «Squeeze = band width < 10% of middle»
    }

    class ATRComputer {
        +computeATR(ohlcv, period=14) ATRResult
        «True Range = max(H-L, |H-Cprev|, |L-Cprev|)»
        «ATR = EMA(TR, 14)»
        «atrPercent = atr / price * 100»
    }

    class SupportResistance {
        +findSupportResistance(ohlcv, price) SRResult
        «Pivot Points method»
        «Groups nearby levels ±1%»
        «nearestSupport / nearestResistance»
    }

    IndicatorsEngine --> SMAComputer
    IndicatorsEngine --> EMAComputer
    IndicatorsEngine --> RSIComputer
    IndicatorsEngine --> MACDComputer
    IndicatorsEngine --> BollingerComputer
    IndicatorsEngine --> ATRComputer
    IndicatorsEngine --> SupportResistance
```

---

## 9. Security & Cost Tracking

```mermaid
classDiagram

    class EnvValidator {
        -ENV_CHECKS: EnvCheck[]
        +validateEnv() boolean
        «Checks DEEPSEEK_API_KEY (skip if USE_LOCAL)»
        «Checks TYPESAFE_API_KEY»
        «Checks GROWW_API_KEY + SECRET»
        «Aborts if required key missing»
    }

    class CostTracker {
        -COST_FILE: string
        -PRICING: deepseek + jev rates
        -DAILY_COST_LIMIT_USD: 1.0
        +trackCost(provider, inputTokens, outputTokens) void
        +checkDailyLimit() CheckResult
        +getCostSummary() string
        -loadCostLog() CostLog
        -saveCostLog(log) void
    }

    class Sanitizer {
        +sanitizePortfolio(raw) SanitizedPortfoilio
        «Masks exact positions»
        «Categorises as small/medium/large»
        «profit/loss status»
        «Safe to send to LLM without revealing amounts»
    }

    class PreCommitCheck {
        «pre-commit-check.sh»
        «Scans staged files for API keys»
        «Blocks commits with secrets»
        «Pattern: sk- / DEEPSEEK / GROWW»
    }

    class CostEntry {
        +date: string
        +provider: string
        +inputTokens: number
        +outputTokens: number
        +costUsd: number
    }

    class CostLog {
        +entries: CostEntry[]
        +totalUsd: number
    }

    CostTracker --> CostLog
    CostLog "1" *-- "many" CostEntry
    Sanitizer --> SanitizedPortfoilio
```

---

## 10. Paper Trade & Auto-Learning System

```mermaid
flowchart TD
    subgraph SAVE["On Each Run: saveRecommendations()"]
        REC["Recommendation[]"]
        PT_ENTRY["PaperTrade {date, ticker, entryPrice,\ntargetPrice, stopLoss, confidence,\njevBuyProb, holdingPeriod}"]
        JSON["data/paper-trades.json"]
        REC --> PT_ENTRY --> JSON
    end

    subgraph CHECK["Next Run: checkOutcomes()"]
        LOAD["Load open trades\n(outcome === 'OPEN')"]
        YF["Yahoo Finance\nfetchCurrentPrice()"]
        EVAL{{"Evaluate Outcome"}}
        WIN["WIN: price ≥ targetPrice\noutcome = HIT_TARGET"]
        LOSS["LOSS: price ≤ stopLoss\noutcome = HIT_STOPLOSS"]
        OPEN["OPEN: still in holding period"]
        LESSON["generateLesson()\nanalysePastMistakes()\ndetect patterns:"]

        LOAD --> YF --> EVAL
        EVAL -->|Target Hit| WIN
        EVAL -->|StopLoss Hit| LOSS
        EVAL -->|Holding| OPEN

        WIN --> LESSON
        LOSS --> LESSON
    end

    subgraph LESSONS["Auto-Learning: data/auto-lessons.json"]
        L1["entry_price — wrong timing"]
        L2["exit_strategy — held too long"]
        L3["news_reaction — overreacted"]
        L4["wrong_direction — against trend"]
        L5["correct_call — patterns that worked"]
        SEVERITY["severity: critical/high/medium/info"]
        COUNT["count++ for repeat patterns"]
    end

    subgraph FEEDBACK["Feedback to Next Run"]
        PROMPT_INJ["getLessonsForPrompt()\nInjects top lessons into LLM prompts\nIMPROVES future analysis quality"]
        PERF["getPerformanceSummary()\nWin rate, avg P&L, total trades"]
    end

    CHECK --> LESSONS
    LESSONS --> FEEDBACK
    JSON -.->|next run| LOAD
```

---

## 11. Data Flow — External APIs

```mermaid
graph LR
    subgraph YAHOO["Yahoo Finance (yahoo-finance2)"]
        YQ["quote() — live prices"]
        YH["historical() — OHLCV 6mo"]
        YQT["quoteSummary() — financials\nrecommendations, earnings dates"]
    end

    subgraph NEWS_APIS["News APIs"]
        RSS["RSS Feeds\nMoneyControl, EconomicTimes, LiveMint"]
        GNEWS["Google News RSS\nindian + global + premarket queries"]
    end

    subgraph GROWW["Groww API"]
        GROW_PORT["Portfolio Fetch\nholdings, avgPrice, P&L"]
    end

    subgraph STOCKUNIVERSE["NSE Stock Universe"]
        NSECSV["EQUITY_L.csv from NSE\ncached 7 days in .cache/"]
        CACHE["sector-cache.json\n20-day TTL"]
    end

    subgraph APP["StockSage"]
        MC_F["MarketContextFetcher"]
        SF_F["StockFetcher"]
        HF_F["HistoricalFetcher"]
        FF_F["FinancialFetcher"]
        MDF_F["MarketDataFetcher"]
        NF_F["NewsFetcher"]
        PF_F["PortfolioFetcher"]
        SU_F["StockUniverse"]
    end

    YQ --> MC_F
    YQ --> SF_F
    YH --> HF_F
    YQT --> FF_F
    YQT --> MDF_F
    RSS --> NF_F
    GNEWS --> NF_F
    GROW_PORT --> PF_F
    NSECSV --> SU_F
    CACHE --> SU_F

    subgraph LLM_APIS["LLM APIs"]
        DEEPSEEK["DeepSeek API\n(cloud mode)"]
        OLLAMA["Ollama Local\n(local mode)"]
        TYPESAFE["TypeSafe AI API\njev-latest model\nfor Jev decisions"]
    end

    DEEPSEEK --> LLM_F
    OLLAMA --> LLM_F
    TYPESAFE --> JEV_F

    LLM_F["LLMClient\ncallLLM()"]
    JEV_F["JevProvider"]
```

---

## 12. Configuration Constants — Key Design Parameters

| Constant | Value | Purpose |
|---|---|---|
| `MAX_CANDIDATES` | 50 | Max stocks entering discovery pool |
| `MAX_TO_ANALYZE` | 10 | Max stocks after Jev gate |
| `MAX_RECOMMENDATION` | 7 | Max final recommendations |
| `TOTAL_BUDGET` | ₹2000 | Trading capital |
| `MAX_STOCKS` | 2 | Stocks to invest in simultaneously |
| `PER_STOCK_BUDGET` | ₹1000 | = TOTAL_BUDGET / MAX_STOCKS |
| `MAX_PRICE_PER_STOCK` | ₹1000 | Budget filter threshold |
| `MIN_CONFIDENCE_THRESHOLD` | 30% | Minimum Jev confidence to include |
| `DAILY_COST_LIMIT_USD` | $1.00 | API cost guard |
| `NEWS_FILTER_THRESHOLD` | 0.40 | Combined news score cutoff |
| `CALM jevGate` | 50% | Probability needed in calm market |
| `VOLATILE jevGate` | 40% | Probability needed in volatile market |
| `CRASH_OR_RALLY jevGate` | 30% | Probability needed in extreme market |
| `SOURCE_TIERS Tier-1` | 1.0 | Reuters, Bloomberg, ET, MoneyControl |
| `SOURCE_TIERS Tier-2` | 0.8 | LiveMint, Business Standard, NDTV Profit |
| `SOURCE_TIERS Tier-3` | 0.5 | TOI, India Today, HT |

---

## 13. Module Dependency Graph

```mermaid
graph TD
    IDX["index.ts\n(Orchestrator)"]

    subgraph CONF["config.ts"]
        THRESHOLDS["Market Regime Thresholds\nSector Map\nSource Tiers\nBudget Params"]
    end

    subgraph SEC["security/"]
        EV["env-validator.ts"]
        TR["tracker.ts"]
        SAN["sanitizer.ts"]
        PC["pre-commit-check.sh"]
    end

    subgraph DATA["data/"]
        MC2["market-context.ts"]
        NF2["news-fetcher.ts"]
        NS2["news-scoreer.ts"]
        SF2["stock-fetcher.ts"]
        HF2["historical-fetcher.ts"]
        FF2["financial-fetcher.ts"]
        MDF2["market-data.ts"]
        PF2["portfolio-fetcher.ts"]
        SU2["stock-universe.ts"]
        QS2["quant-scanner.ts"]
        PT2["paper-trade.ts"]
    end

    subgraph ANALYSIS["analysis/"]
        IND2["indicators.ts"]
        SR2["support-resistance.ts"]
        CA["compute-all.ts"]
    end

    subgraph AI["ai/"]
        LLC["llm-client.ts"]
        JP["jev-procider.ts"]
        JD["jev-decision.ts"]
        JA["jev-agents.ts"]
        SD["stock-discovery.ts"]
        COM["committee.ts"]
        VER["verifier.ts"]
    end

    subgraph LOGIC["logic/"]
        MERGE["merge.ts"]
        RANK["rank.ts"]
    end

    subgraph PROM["prompts.ts"]
        PROMPTS["buildNewsAgentPrompt\nbuildRiskAgentPrompt\nbuildStockExtractPrompt\nbuildJevGatePrompt"]
    end

    subgraph TYPES["types/"]
        T["index.ts → analysis, decision\nmarket, news, portfolio\nrecommendation, stock, technical"]
    end

    IDX --> CONF
    IDX --> SEC
    IDX --> DATA
    IDX --> ANALYSIS
    IDX --> AI
    IDX --> LOGIC
    IDX --> PROM

    AI --> CONF
    AI --> LLC
    AI --> JP
    AI --> TYPES
    AI --> PROM
    AI --> DATA

    DATA --> CONF
    DATA --> TYPES

    ANALYSIS --> TYPES

    COM --> JA
    COM --> VER
    COM --> JP
    COM --> LLC
    COM --> PROM

    JD --> JP
    SD --> JP
    SD --> LLC

    CA --> IND2
    CA --> SR2
```

---

## 14. Market Regime State Machine

```mermaid
stateDiagram-v2
    direction LR
    [*] --> FetchNifty : App Start

    FetchNifty --> CALM : abs change below 1 pct
    FetchNifty --> VOLATILE : change between 1 and 3 pct
    FetchNifty --> CRASH_OR_RALLY : abs change above 3 pct
    FetchNifty --> VOLATILE : Market CLOSED relaxed mode

    CALM --> JevGating : JevGate 50 pct threshold
    VOLATILE --> JevGating : JevGate 40 pct threshold
    CRASH_OR_RALLY --> JevGating : JevGate 30 pct threshold

    JevGating --> StocksPass : probability above threshold
    JevGating --> StocksSkipped : probability below threshold
    JevGating --> AllPass : zero stocks pass fallback
    StocksPass --> [*]
    StocksSkipped --> [*]
    AllPass --> [*]
```

**Regime Thresholds Reference:**

| Regime | Nifty Change | JevGate | Upside Range | Downside Range |
|---|---|---|---|---|
| `CALM` | < 1.0% | 50% | 1–0% | 1–2% |
| `VOLATILE` | 1.0% – 3.0% | 40% | 2–5% | 1.5–3% |
| `CRASH_OR_RALLY` | ≥ 3.0% | 30% | 3–15% | 2–15% |
| *(Market Closed)* | any | 40% | VOLATILE defaults | VOLATILE defaults |

---


## 15. Docker / Deployment Architecture

```mermaid
graph TB
    subgraph HOST["Host Machine"]
        ENV_FILE[".env\nAPI Keys + Config"]
        DATA_VOLUME["data/ volume\npaper-trades.json\nauto-lessons.json\ncost-log.json"]
    end

    subgraph DOCKER["Docker Container (node:20-alpine)"]
        TS_BUILD["TypeScript Build\nnpx ts-node src/index.ts"]
        APP_CODE["StockSage App\n/app/src/"]
        DATA_DIR["/app/data/\n(mounted volume)"]
        CACHE_DIR["/app/.cache/\nNSE equity list"]
    end

    subgraph EXTERNAL["External Services"]
        YAHOO_API["Yahoo Finance API\n(public, no key)"]
        DEEPSEEK_API["DeepSeek API\n$0.15/M input\n$0.60/M output"]
        TYPESAFE_API["TypeSafe/Jev API\n$0.042/M input"]
        GROWW["Groww Portfolio API"]
        NEWS_SRC["RSS Feeds\nMoneyControl, ET, LiveMint"]
    end

    ENV_FILE --> DOCKER
    DATA_VOLUME <--> DATA_DIR
    APP_CODE --> YAHOO_API
    APP_CODE --> DEEPSEEK_API
    APP_CODE --> TYPESAFE_API
    APP_CODE --> GROWW
    APP_CODE --> NEWS_SRC
```

---

> **Generated by:** Antigravity AI | **Source:** `d:\Experiments\StockSage` | **Commit:** `1f8451d`
