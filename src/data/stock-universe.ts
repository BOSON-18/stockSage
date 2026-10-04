// import YahooFinance from "yahoo-finance2";
// import { MAX_PRICE_PER_STOCK } from "../config";
// import { fetchFromNseCsv } from "./nseCSV";

// const yahooFinance = new YahooFinance();

// const MIN_AVG_VOLUME = 500_000; // liquidity guard, tune as needed

export interface StockUniverseEntry {
    ticker: string;
    sector: string;
    // price: number;
    // avgVolume: number;
}

// const toYahooTicker = (s: string) => (s.endsWith('.NS') ? s : `${s}.NS`);



const csvFiles = [
    // { path: 'equities/EQUITY_L.csv', symbolCol: 2, industryCol: 2 },
    { path: 'indices/ind_nifty500list.csv', symbolCol: 2, industryCol: 1 },
    { path: 'indices/ind_nifty200list.csv', symbolCol: 2, industryCol: 1 },
    { path: 'indices/ind_nifty50list.csv', symbolCol: 2, industryCol: 1 },
]

async function fetchNiftyCSV(): Promise<{ symbol: string, industry: string }[]> {


    for (const csv of csvFiles) {
        // const url = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
        try {
            const url = `https://archives.nseindia.com/content/${csv.path}`;
            console.log(`Fetching ${csv.path} from NSE Archives...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                }
            });

            if (!response.ok) continue;

            // const csvText = await response.text();
            // const lines = csvText.split('\n').filter((line) => line.trim().length > 0);

            const text = await response.text();
            const lines = text.split('\n').filter((line: string) => line.trim().length > 0);

            if (lines.length < 5) continue;


            const stocks: { symbol: string, industry: string }[] = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map((c: string) => c.trim().replace(/"/g, ''));
                const symbol = cols[csv.symbolCol] ?? ''
                const industry = cols[csv.industryCol] ?? 'Unkown'

                if (!symbol || symbol === 'SYMBOL' || symbol === 'Symbol') continue;
                stocks.push({ symbol, industry })
            }

            if (stocks.length > 0) {
                console.log(`NSE CSV: ${stocks.length} stocks from ${csv.path}`);
                return stocks;
            }


        } catch (error) {
            // console.error(`Failed to fetch ${file}:`, error);
            console.warn(`${csv.path} failed,trying next...`)
        }
    }

    return [];
}
function getFallbackStockList(): { symbol: string; industry: string }[] {
    return [
        // Banks
        { symbol: 'YESBANK.NS', industry: 'Financial Services' },
        { symbol: 'PNB.NS', industry: 'Financial Services' },
        { symbol: 'IDFCFIRSTB.NS', industry: 'Financial Services' },
        { symbol: 'BANKBARODA.NS', industry: 'Financial Services' },
        { symbol: 'CANBK.NS', industry: 'Financial Services' },
        { symbol: 'UNIONBANK.NS', industry: 'Financial Services' },
        { symbol: 'BANKINDIA.NS', industry: 'Financial Services' },
        { symbol: 'IOB.NS', industry: 'Financial Services' },
        { symbol: 'UCOBANK.NS', industry: 'Financial Services' },
        { symbol: 'CENTRALBK.NS', industry: 'Financial Services' },
        { symbol: 'FEDERALBNK.NS', industry: 'Financial Services' },
        { symbol: 'RBLBANK.NS', industry: 'Financial Services' },
        { symbol: 'BANDHANBNK.NS', industry: 'Financial Services' },
        { symbol: 'SOUTHBANK.NS', industry: 'Financial Services' },

        // Finance / PSU lenders
        { symbol: 'IRFC.NS', industry: 'Financial Services' },
        { symbol: 'IREDA.NS', industry: 'Financial Services' },
        { symbol: 'HUDCO.NS', industry: 'Financial Services' },
        { symbol: 'PFC.NS', industry: 'Financial Services' },
        { symbol: 'MANAPPURAM.NS', industry: 'Financial Services' },
        { symbol: 'SAMMAANCAP.NS', industry: 'Financial Services' },

        // Power / renewables
        { symbol: 'SUZLON.NS', industry: 'Capital Goods' },
        { symbol: 'NHPC.NS', industry: 'Power' },
        { symbol: 'SJVN.NS', industry: 'Power' },
        { symbol: 'JPPOWER.NS', industry: 'Power' },
        { symbol: 'RPOWER.NS', industry: 'Power' },

        // Railways / infra
        { symbol: 'RVNL.NS', industry: 'Construction' },
        { symbol: 'IRCON.NS', industry: 'Construction' },
        { symbol: 'RAILTEL.NS', industry: 'Telecommunication' },
        { symbol: 'NBCC.NS', industry: 'Construction' },
        { symbol: 'GMRAIRPORT.NS', industry: 'Services' },

        // Telecom
        { symbol: 'IDEA.NS', industry: 'Telecommunication' },
        { symbol: 'HFCL.NS', industry: 'Telecommunication' },
        { symbol: 'ITI.NS', industry: 'Telecommunication' },
        { symbol: 'GTLINFRA.NS', industry: 'Telecommunication' },
        { symbol: 'MTNL.NS', industry: 'Telecommunication' },

        // Metals / energy
        { symbol: 'SAIL.NS', industry: 'Metals & Mining' },
        { symbol: 'NMDC.NS', industry: 'Metals & Mining' },
        { symbol: 'NATIONALUM.NS', industry: 'Metals & Mining' },
        { symbol: 'HINDCOPPER.NS', industry: 'Metals & Mining' },
        { symbol: 'TATASTEEL.NS', industry: 'Metals & Mining' },
        { symbol: 'IOC.NS', industry: 'Oil Gas & Consumable Fuels' },
        { symbol: 'GAIL.NS', industry: 'Oil Gas & Consumable Fuels' },

        // Auto / media / others
        { symbol: 'MOTHERSON.NS', industry: 'Automobile and Auto Components' },
        { symbol: 'ASHOKLEY.NS', industry: 'Automobile and Auto Components' },
        { symbol: 'ZEEL.NS', industry: 'Media Entertainment & Publication' },
        { symbol: 'TV18BRDCST.NS', industry: 'Media Entertainment & Publication' },
        { symbol: 'NETWORK18.NS', industry: 'Media Entertainment & Publication' },
        { symbol: 'SPICEJET.NS', industry: 'Services' },
    ];
}

export async function fetchStockUniverse(): Promise<StockUniverseEntry[]> {
    console.log('Building dynamic stock universe from NSE CSV');



    const csvStocks = await fetchNiftyCSV();

    // let symbols: string[];
    // let csvIndustryMap: Record<string, string> = {};

    // if (csvStocks.length > 0) {
    //     symbols = csvStocks.map((s) => s.symbol);
    //     for (const s of csvStocks) {
    //         csvIndustryMap[s.symbol] = s.industry;
    //     }
    // } else {
    //     console.log(`NSE CSV failed - using fallback list`)
    //     symbols = getFallbackStockList()
    // }

    if (csvStocks.length > 0) {
        return csvStocks.map((s) => ({
            ticker: `${s.symbol}.NS`,
            sector: s.industry
        }))
    }

    console.log(' All CSVs failed - using fallback');
    const FALLBACK = getFallbackStockList();
    return FALLBACK.map((s) => ({
        ticker: `${s.symbol}.NS`,
        sector: s.industry
    }))


    // const CHUNK_SIZE = 20;
    // const universe: StockUniverseEntry[] = [];

    // for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    //     const chunk = symbols.slice(i, i + CHUNK_SIZE);

    //     // Step 1: one batched quote call for the whole chunk (price + volume, cheap filter first)
    //     let quotes: any[] = [];
    //     try {
    //         quotes = (await yahooFinance.quote(chunk)) as any[];
    //     } catch (error) {

    //         continue;
    //     }

    //     const affordable = quotes.filter((q) => {
    //         const price = q?.regularMarketPrice;                       // NOTE: capital M
    //         const vol = q?.averageDailyVolume3Month ?? 0;
    //         return typeof price === 'number' && price > 0 && price <= MAX_PRICE_PER_STOCK && vol >= MIN_AVG_VOLUME;
    //     });

    //     // Step 2: sector is NOT in quote(); fetch it only for stocks that passed the filters
    //     const results = await Promise.allSettled(
    //         affordable.map(async (q) => {
    //             const summary = await yahooFinance.quoteSummary(q.symbol, { modules: ['assetProfile'] });
    //             const profile = (summary as any)?.assetProfile;
    //             return {
    //                 ticker: q.symbol as string,
    //                 sector: (profile?.sector ?? profile?.industry ?? 'Unknown') as string,
    //                 price: q.regularMarketPrice as number,
    //                 avgVolume: (q.averageDailyVolume3Month ?? 0) as number,
    //             } satisfies StockUniverseEntry;
    //         })
    //     );

    //     for (const r of results) {
    //         if (r.status === 'fulfilled') universe.push(r.value);
    //         else console.warn('Sector lookup failed:', r.reason?.message ?? r.reason);
    //     }

    //     console.log(`Scanned ${Math.min(i + CHUNK_SIZE, symbols.length)}/${symbols.length} stocks...`);
    //     await new Promise((res) => setTimeout(res, 300)); // be nice to Yahoo
    // }

    // console.log(`Universe: ${universe.length} affordable stocks (budget Rs.${MAX_PRICE_PER_STOCK})`);
    // return universe;
}

export function buildDynamicSectorMap(universe: StockUniverseEntry[]): Record<string, string[]> {
    const sectorMap: Record<string, string[]> = {};
    for (const entry of universe) {
        (sectorMap[entry.sector] ??= []).push(entry.ticker);
    }

    console.log(`Dynamic sectors: ${Object.keys(sectorMap).length}`);
    for (const [sector, tickers] of Object.entries(sectorMap)) {
        console.log(`${sector}: ${tickers.length} stocks`);
    }
    return sectorMap;
}