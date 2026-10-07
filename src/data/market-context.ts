import YahooFinance from "yahoo-finance2";
import { MarketContext, MarketRegime } from "../types";
import { REGIME_THRESHOLD } from "../config";


const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });


function computeRegime(niftyChangePercent: number): MarketRegime {
    const absChange = Math.abs(niftyChangePercent);

    if (absChange < REGIME_THRESHOLD.CALM.maxNiftyChange) return 'CALM';
    if (absChange < REGIME_THRESHOLD.VOLATILE.maxNiftyChange) return 'VOLATILE';
    return 'CRASH_OR_RALLY'
}

function buildMarketContext(
    niftyPrice: number,
    niftyChange: number,
    sensexChange: number
): MarketContext {
    const regime = computeRegime(niftyChange);

    const thresholds = REGIME_THRESHOLD[regime];

    return {
        niftyPrice,
        niftyChangePercent: niftyChange,
        sensexChangePercent: sensexChange,
        regime,
        upsideRange: thresholds.upside,
        downsideRange: thresholds.downside,
        jevGateThreshold: thresholds.jevGate,
        marketState: 'REGULAR'
    }
}

export async function fetchMarketContext(): Promise<MarketContext> {
    console.log('[STOCK-FETCHER] fetching market data...')
    try {
        const [nifty, sensex, giftNifty] = await Promise.all([
            yahooFinance.quote('^NSEI'),
            yahooFinance.quote('^BSESN'),
            yahooFinance.quote('NIFTY_GIF.NS', {}, { validateResult: false }).catch(() => null)
        ]);

        const niftyPrice = (nifty as any).regularMarketPrice ?? 0;
        const niftyChange = (nifty as any).regularMarketChangePercent ?? 0;
        const sensexChange = (sensex as any).regularMarketChangePercent ?? 0;
        const marketState = (nifty as any).marketState ?? 'CLOSED';
        const giftNiftyChange = (giftNifty as any)?.regularMarketChangePercent ?? undefined;

        if (giftNiftyChange !== undefined) {
            console.log(`GIFT Nifty: ${giftNiftyChange >= 0 ? '+' : ''}${giftNiftyChange.toFixed(2)}% (pre-market indicator)`)
        }

        // If market closed used relaxed thresolds
        if (marketState === 'CLOSED' || marketState == "POSTPOST") {

            console.log('MARKET is CLOSED - using relaxed thresholds for testing');

            return {
                niftyPrice,
                niftyChangePercent: niftyChange,
                sensexChangePercent: sensexChange,
                regime: 'VOLATILE' as const,
                upsideRange: REGIME_THRESHOLD.VOLATILE.upside,
                downsideRange: REGIME_THRESHOLD.VOLATILE.downside,
                jevGateThreshold: 0.40,
                giftNiftyChange,
                marketState
            }

        }

        // return buildMarketContext(niftyPrice, niftyChange, sensexChange);
        const ctx = buildMarketContext(niftyPrice, niftyChange, sensexChange);
        return { ...ctx, giftNiftyChange, marketState }

    } catch (error) {

        console.warn('Market context fetch failed, using default CALM regime:', error);
        return {
            niftyPrice: 0,
            niftyChangePercent: 0,
            sensexChangePercent: 0,
            regime: 'CALM',
            upsideRange: REGIME_THRESHOLD.CALM.upside,
            downsideRange: REGIME_THRESHOLD.CALM.downside,
            jevGateThreshold: REGIME_THRESHOLD.CALM.jevGate,
            marketState: 'CLOSED'
        }
    }
}
