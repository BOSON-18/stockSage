import * as fs from 'fs';
import * as path from 'path';
import YahooFinance from "yahoo-finance2";
import { object } from 'zod';

export interface StockUniverseEntry {
    ticker: string;
    sector: string;

}

const yahooFinance = new YahooFinance();

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'sector-cache.json');

let sectorCache: Record<string, string> = {};


function loadCache(): void {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            sectorCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
        }

    } catch (error) {
        console.log('Sector cache failed')
        sectorCache = {}
    }
}

function saveCache(): void {
    try {

        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
        fs.writeFileSync(CACHE_FILE, JSON.stringify(sectorCache, null, 2));

    } catch (error) {
        console.log('Failed to save cache')
    }
}


const csvFiles = [
    // { path: 'equities/EQUITY_L.csv', symbolCol: 2, industryCol: 2 },
    { path: 'indices/ind_nifty500list.csv', symbolCol: 2, industryCol: 1 },
    { path: 'indices/ind_nifty200list.csv', symbolCol: 2, industryCol: 1 },
    { path: 'indices/ind_nifty50list.csv', symbolCol: 2, industryCol: 1 },
]

async function fetchCSV(csvPath: string): Promise<string[][]> {
    try {
        const url = `https://archives.nseindia.com/content/${csvPath}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            }
        });

        if (!response.ok) return [];

        const text = await response.text();

        return text.split('\n')
            .filter((line: string) => line.trim().length > 0)
            .map((line: string) => line.split(',').map((c: string) => c.trim().replace(/"/g, '')))

    } catch (error) {
        console.log('Error in fetchCSV');
        return []
    }
}

async function preseedFromNifty(): Promise<number> {
    const files = ['ind_nifty500list.csv', 'ind_nifty200list.csv', 'ind_nifty50list.csv'];
    let seeded = 0;

    for (const file of files) {

        const rows = await fetchCSV(`indices/${file}`);
        if (rows.length < 5) continue;

        for (const cols of rows.slice(1)) {
            if (cols.length > -3 && cols[2] && cols[2] !== 'Symbol') {
                if (!sectorCache[cols[2]]) {
                    sectorCache[cols[2]] = cols[1];
                    seeded++;
                }
            }
        }

        if (seeded > 0) {
            console.log(`Pre-seeded ${seeded} sectors from ${file}`);
            break;
        }

    }
    return seeded;
}

// async function fetchNiftyCSV(): Promise<{ symbol: string, industry: string }[]> {


//     for (const csv of csvFiles) {
//         // const url = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
//         try {
//             const url = `https://archives.nseindia.com/content/${csv.path}`;
//             console.log(`Fetching ${csv.path} from NSE Archives...`);

//             const response = await fetch(url, {
//                 headers: {
//                     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
//                 }
//             });

//             if (!response.ok) continue;



//             const text = await response.text();
//             const lines = text.split('\n').filter((line: string) => line.trim().length > 0);

//             if (lines.length < 5) continue;


//             const stocks: { symbol: string, industry: string }[] = [];

//             for (let i = 1; i < lines.length; i++) {
//                 const cols = lines[i].split(',').map((c: string) => c.trim().replace(/"/g, ''));
//                 const symbol = cols[csv.symbolCol] ?? ''
//                 const industry = cols[csv.industryCol] ?? 'Unkown'

//                 if (!symbol || symbol === 'SYMBOL' || symbol === 'Symbol') continue;
//                 stocks.push({ symbol, industry })
//             }

//             if (stocks.length > 0) {
//                 console.log(`NSE CSV: ${stocks.length} stocks from ${csv.path}`);
//                 return stocks;
//             }


//         } catch (error) {
//             // console.error(`Failed to fetch ${file}:`, error);
//             console.warn(`${csv.path} failed,trying next...`)
//         }
//     }

//     return [];
// }


// function getFallbackStockList(): { symbol: string; industry: string }[] {
//     return [
//         // Banks
//         { symbol: 'YESBANK.NS', industry: 'Financial Services' },
//         { symbol: 'PNB.NS', industry: 'Financial Services' },
//         { symbol: 'IDFCFIRSTB.NS', industry: 'Financial Services' },
//         { symbol: 'BANKBARODA.NS', industry: 'Financial Services' },
//         { symbol: 'CANBK.NS', industry: 'Financial Services' },
//         { symbol: 'UNIONBANK.NS', industry: 'Financial Services' },
//         { symbol: 'BANKINDIA.NS', industry: 'Financial Services' },
//         { symbol: 'IOB.NS', industry: 'Financial Services' },
//         { symbol: 'UCOBANK.NS', industry: 'Financial Services' },
//         { symbol: 'CENTRALBK.NS', industry: 'Financial Services' },
//         { symbol: 'FEDERALBNK.NS', industry: 'Financial Services' },
//         { symbol: 'RBLBANK.NS', industry: 'Financial Services' },
//         { symbol: 'BANDHANBNK.NS', industry: 'Financial Services' },
//         { symbol: 'SOUTHBANK.NS', industry: 'Financial Services' },

//         // Finance / PSU lenders
//         { symbol: 'IRFC.NS', industry: 'Financial Services' },
//         { symbol: 'IREDA.NS', industry: 'Financial Services' },
//         { symbol: 'HUDCO.NS', industry: 'Financial Services' },
//         { symbol: 'PFC.NS', industry: 'Financial Services' },
//         { symbol: 'MANAPPURAM.NS', industry: 'Financial Services' },
//         { symbol: 'SAMMAANCAP.NS', industry: 'Financial Services' },

//         // Power / renewables
//         { symbol: 'SUZLON.NS', industry: 'Capital Goods' },
//         { symbol: 'NHPC.NS', industry: 'Power' },
//         { symbol: 'SJVN.NS', industry: 'Power' },
//         { symbol: 'JPPOWER.NS', industry: 'Power' },
//         { symbol: 'RPOWER.NS', industry: 'Power' },

//         // Railways / infra
//         { symbol: 'RVNL.NS', industry: 'Construction' },
//         { symbol: 'IRCON.NS', industry: 'Construction' },
//         { symbol: 'RAILTEL.NS', industry: 'Telecommunication' },
//         { symbol: 'NBCC.NS', industry: 'Construction' },
//         { symbol: 'GMRAIRPORT.NS', industry: 'Services' },

//         // Telecom
//         { symbol: 'IDEA.NS', industry: 'Telecommunication' },
//         { symbol: 'HFCL.NS', industry: 'Telecommunication' },
//         { symbol: 'ITI.NS', industry: 'Telecommunication' },
//         { symbol: 'GTLINFRA.NS', industry: 'Telecommunication' },
//         { symbol: 'MTNL.NS', industry: 'Telecommunication' },

//         // Metals / energy
//         { symbol: 'SAIL.NS', industry: 'Metals & Mining' },
//         { symbol: 'NMDC.NS', industry: 'Metals & Mining' },
//         { symbol: 'NATIONALUM.NS', industry: 'Metals & Mining' },
//         { symbol: 'HINDCOPPER.NS', industry: 'Metals & Mining' },
//         { symbol: 'TATASTEEL.NS', industry: 'Metals & Mining' },
//         { symbol: 'IOC.NS', industry: 'Oil Gas & Consumable Fuels' },
//         { symbol: 'GAIL.NS', industry: 'Oil Gas & Consumable Fuels' },

//         // Auto / media / others
//         { symbol: 'MOTHERSON.NS', industry: 'Automobile and Auto Components' },
//         { symbol: 'ASHOKLEY.NS', industry: 'Automobile and Auto Components' },
//         { symbol: 'ZEEL.NS', industry: 'Media Entertainment & Publication' },
//         { symbol: 'TV18BRDCST.NS', industry: 'Media Entertainment & Publication' },
//         { symbol: 'NETWORK18.NS', industry: 'Media Entertainment & Publication' },
//         { symbol: 'SPICEJET.NS', industry: 'Services' },
//     ];
// }

let _allTickers: Set<string> | null = null;

async function loadAllTickers(): Promise<Set<string>> {
    if (_allTickers) return _allTickers;

    const rows = await fetchCSV('equities/EQUITY_L.csv');
    const tickers = new Set<string>();

    for (const cols of rows.slice(1)) {
        if (cols.length >= 1 && cols[0] && cols[0] !== 'SYMBOL') {
            tickers.add(cols[0]);
        }
    }

    console.log(`EQUITY_L: ${tickers.size} valid NSE tickers`);
    _allTickers = tickers;
    return tickers;
}

export async function getSector(symbol: string): Promise<string> {
    const clean = symbol.replace('.NS', '');
    if (sectorCache[clean]) return sectorCache[clean];

    try {
        const quote = await yahooFinance.quote(`${clean}.NS`, {}, { validateResult: false });
        const sector = quote.sector ?? quote.industry ?? 'Unknown'
        sectorCache[clean] = sector;
        saveCache();
        return sector
    } catch (error) {
        sectorCache[clean] = 'Unknown'
        return 'Unknown'
    }
}

export async function isValidTicker(symbol: string): Promise<boolean> {
    const valid = await loadAllTickers();
    return valid.has(symbol.replace('.NS', ''));
}

export async function fullSectorScan(): Promise<void> {
    console.log('Starting full sector scan...');
    loadCache();

    const allTickers = await loadAllTickers();
    await preseedFromNifty();

    let scanned = 0;
    let total = allTickers.size;
    let newCached = 0;

    for (const symbol of allTickers) {
        scanned++;
        if (sectorCache[symbol]) continue;

        try {
            const quote = await yahooFinance.quote(`${symbol}.NS`, {}, { validateResult: false }) as any;
            sectorCache[symbol] = quote.sector ?? quote.industry ?? 'Unknown';
            newCached++

            if (newCached % 50 === 0) {
                saveCache();
                console.log(`Progress: ${scanned}/${total} scanned, ${newCached} new sectors cached`);
            }
        } catch (error) {
            sectorCache[symbol] = 'Unknown';
            console.log('Error in isValidTicker');
        }
    }

    saveCache();
    console.log(`Done: ${Object.keys(sectorCache).length} total sectors cached`);
}

export async function fetchStockUniverse(): Promise<StockUniverseEntry[]> {
    console.log('Building dynamic stock universe ');

    loadCache();
    const cachedCount = Object.keys(sectorCache).length;
    if (cachedCount > 0) console.log(`Sector cache: ${cachedCount} entries loaded`);

    const allTickers = await loadAllTickers();

    if (cachedCount < 100) {
        const seeded = await preseedFromNifty();
        if (seeded > 0) saveCache();

    }

    const universe: StockUniverseEntry[] = [];
    for (const symbol of allTickers) {
        universe.push({
            ticker: `${symbol}.NS`,
            sector: sectorCache[symbol] ?? 'Unknown'
        });
    }

    const knownSectors = Object.values(sectorCache).filter(s => s !== 'Unknown').length;
    console.log(`Universe: ${universe.length} tickers | ${knownSectors} with known sector`);
    return universe;


}
// const csvStocks = await fetchNiftyCSV();


// if (csvStocks.length > 0) {
//     return csvStocks.map((s) => ({
//         ticker: `${s.symbol}.NS`,
//         sector: s.industry
//     }))
// }

// console.log(' All CSVs failed - using fallback');
// const FALLBACK = getFallbackStockList();
// return FALLBACK.map((s) => ({
//     ticker: `${s.symbol}.NS`,
//     sector: s.industry
// }))

export function buildDynamicSectorMap(universe: StockUniverseEntry[]): Record<string, string[]> {
    const sectorMap: Record<string, string[]> = {};

    for (const entry of universe) {
        // (sectorMap[entry.sector] ??= []).push(entry.ticker);

        if (entry.sector === 'Unknown') continue;
        if (!sectorMap[entry.sector]) sectorMap[entry.sector] = [];
        sectorMap[entry.sector].push(entry.ticker);
    }

    // console.log(`Dynamic sectors: ${Object.keys(sectorMap).length}`);
    // for (const [sector, tickers] of Object.entries(sectorMap)) {
    //     console.log(`${sector}: ${tickers.length} stocks`);
    // }

    console.log(`Sector map: ${Object.keys(sectorMap).length} sectors`)
    return sectorMap;
}