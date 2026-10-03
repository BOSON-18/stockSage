import 'dotenv/config'




export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
export const DELAY_BETWEEN_CALLS_MS = 2000;


// const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
export const USE_LOCAL = process.env.USE_LOCAL !== 'false'
export const LOCAL_MODEL = process.env.LOCAL_MODEL || ''
export const CLOUD_MODEL = process.env.CLOUD_MODEL || ''
export const LLM_MODEL = USE_LOCAL ? LOCAL_MODEL : CLOUD_MODEL;


// STOCK DISCOVERY

export const WATCHLIST: string[] = [
    // 'RELIANCE.NS',
    // 'HDFCBANK.NS',
    // 'M&M.NS',
    // 'ONGC.NS',
    // 'Moneyview.NS'
];

export const MAX_CANDIDATES = 25;
export const MAX_TO_ANALYZE = 10;
// export const MAX_PRICE_PER_STOCK = 2000;
export const MIN_CONFIDENCE_THRESHOLD = 30;

// BUDGET
export const TOTAL_BUDGET = 2000;
export const MAX_STOCKS = 5;
export const PER_STOCK_BUDGET = Math.floor(TOTAL_BUDGET / MAX_STOCKS);
export const MAX_PRICE_PER_STOCK = PER_STOCK_BUDGET

// MARKET REGIME THRESHOLDS

// Regime we are detecting via nifty change

export const REGIME_THRESHOLD = {
    CALM: {
        maxNiftyChange: 1.0,
        upside: { min: 1, max: 0 },
        downside: { min: 1, max: 2 },
        jevGate: 0.65
    },
    VOLATILE: {
        maxNiftyChange: 3.0,
        upside: { min: 2, max: 5 },
        downside: { min: 1.5, max: 3 },
        jevGate: 0.55
    },
    CRASH_OR_RALLY: {
        maxNiftyChange: Infinity,
        upside: { min: 3, max: 10 },
        downside: { min: 2, max: 5 },
        jevGate: 0.50
    },

}


// NEWS SOURCE CREDIBILITY TIERS

export const SOURCE_TIERS: Record<string, number> = {

    // Tier -1
    'Reuters': 1.0,
    'Bloomberg': 1.0,
    'Wall Street Journal': 1.0,
    'Financial Times': 1.0,
    'Economic Times': 1.0,
    'MoneyControl': 1.0,
    'CNBC': 1.0,
    'CNBC-TV18': 1.0,
    'NSE India': 1.0,
    'BSE India': 1.0,
    'RBI': 1.0,

    // Tier -2
    'LiveMint': 0.8,
    'Mint': 0.8,
    'Business Standard': 0.8,
    'Financial Express': 0.8,
    'NDTV Profit': 0.8,
    'The Hindu Business Line': 0.8,

    // Tier-3
    'Times of India': 0.5,
    'India Today': 0.5,
    'Hindustan Times': 0.5,
    'Business Today': 0.5,
    'NDTV': 0.5,
    'The Hindu': 0.5

}

export const DEFAULT_SOURCE_WEIGHT = 0.3;

export const NEWS_QUERY = {
    indian: 'Indian stock market Sensex Nifty BSE NSE',
    global: 'US tariff India OR Fed rate decision OR crude oil OPEC OR China economy trade OR war geopolitical market OR US Bond Yeild'
}

export const NEWS_FILTER_THRESHOLD = 0.30;

//  Sector Mapping

// export const SECTOR_MAP: Record<string, string[]> = {
//     'Oil/Crude/OPEC': ['ONGC.NS', 'RELIANCE.NS', 'IOC.NS', 'BPCL.NS', 'HINDPETRO.NS'],
//     'RBI/Interest rates': ['KOTAK.NS', 'HDFCBANK.NS', 'SBIN.NS', 'ICICIBANK.NS', 'AXISBANK.NS', 'BAJFINANCE.NS'],
//     'IT/Tech/Rupee': ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS'],
//     'Auto': ['M&M.NS', 'TATAMOTORS.NS', 'MARUTI.NS', 'BAJAJ-AUTO.NS', 'HEROMOTOCO.NS'],
//     'Pharma/Healthcare': ['SUNPHARMA.NS', 'Cipla.NS', 'DRREDDY.NS', 'LUPIN.NS', 'AUROPHARMA.NS', 'DIVISLAB.NS'],
//     'Metal/Steel/Mining': ['TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDZINC.NS', 'NALCO.NS', 'VEDL.NS', 'HINDALCO.NS', 'COALINDIA.NS'],
//     // 'Cement/Infra': ['ULTRACHEM.NS', 'ACC.NS', 'AMBUJACEM.NS', 'SHREEPUSHK.NS', 'RAMCOCEM.NS'],
//     'Banking/Finance': ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAK.NS', 'BAJFINANCE.NS', 'AXISBANK.NS'],
//     'War/Geopolitics/Defense': ['HAL.NS', 'BHEL.NS'],
//     'Telecom': ['BHARTIARTL.NS', 'IDEA.NS'],
//     'Infrastructure/GDP': ['LT.NS', 'NTPC.NS', 'POWERGRID.NS', 'NHPC.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 'ULTRAEMCO.NS'],
//     'Insurance': ['SBILIFE.NS', 'HDFCLIFE.NS', 'ICICIGI.NS', 'LICI.NS', 'POLICYBZR.NS'],
//     'FMCG/Consumer': ['HINDUNILVR.NS', 'ABCAPITAL.NS', 'NESTLEIND.NS', 'ITC.NS', 'BRITANNIA.NS', 'DABUR.NS', 'BECTORFOOD.NS']


// }

// One array per sector: large + mid + small + cheap alternatives, all together.
export const SECTOR_MAP: Record<string, string[]> = {
    'Oil/Crude/OPEC': [
        'RELIANCE.NS', 'ONGC.NS', 'IOC.NS', 'BPCL.NS', 'GAIL.NS', 'HINDPETRO.NS', 'OIL.NS', 'GSPL.NS',
        'MRPL.NS', 'CHENNPETRO.NS', 'HINDOILEXP.NS',
    ],
    'RBI/Interest rates': [
        'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'PNB.NS', 'BANKBARODA.NS', 'CANBK.NS',
        'INDUSINDBK.NS', 'IDFCFIRSTB.NS', 'YESBANK.NS', 'FEDERALBNK.NS', 'AUBANK.NS', 'UNIONBANK.NS', 'BANKINDIA.NS', 'BANDHANBNK.NS', 'IDBI.NS', 'RBLBANK.NS', 'KARURVYSYA.NS',
        'IOB.NS', 'UCOBANK.NS', 'CENTRALBK.NS', 'SOUTHBANK.NS',
    ],
    'Banking/Finance': [
        'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'SHRIRAMFIN.NS', 'CHOLAFIN.NS', 'JIOFIN.NS', 'PFC.NS', 'RECLTD.NS', 'IRFC.NS',
        'MANAPPURAM.NS', 'POONAWALLA.NS', 'ABCAPITAL.NS', 'L&TFH.NS', 'M&MFIN.NS', 'HUDCO.NS', 'IREDA.NS', 'SAMMAANCAP.NS', 'IIFL.NS',
    ],
    'Capital Markets/Brokers': [
        'BSE.NS', 'HDFCAMC.NS', 'CDSL.NS', 'MCX.NS', 'ANGELONE.NS', 'NUVAMA.NS', 'MOTILALOFS.NS',
        '5PAISA.NS', 'GEOJITFSL.NS', 'IIFLCAPS.NS',
    ],
    'IT/Tech/Rupee': [
        'TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'TECHM.NS', 'LTIM.NS',
        'PERSISTENT.NS', 'COFORGE.NS', 'MPHASIS.NS', 'CYIENT.NS', 'BSOFT.NS', 'INTELLECT.NS', 'ZENSARTECH.NS', 'SONATSOFTW.NS', 'HAPPSTMNDS.NS',
        'MASTEK.NS', 'TANLA.NS', 'NIITLTD.NS', 'RSYSTEMS.NS',
    ],
    'Auto': [
        'M&M.NS', 'MARUTI.NS', 'BAJAJ-AUTO.NS', 'EICHERMOT.NS', 'TVSMOTOR.NS', 'HEROMOTOCO.NS', 'TMPV.NS',
        'ASHOKLEY.NS', 'MOTHERSON.NS', 'ESCORTS.NS', 'TMCV.NS', 'FORCEMOT.NS',
        'JAMNAAUTO.NS', 'OLECTRA.NS', 'SUPRAJIT.NS', 'LUMAXTECH.NS', 'ATULAUTO.NS',
    ],
    'Pharma/Healthcare': [
        'SUNPHARMA.NS', 'CIPLA.NS', 'DRREDDY.NS', 'DIVISLAB.NS', 'LUPIN.NS', 'ZYDUSLIFE.NS', 'TORNTPHARM.NS', 'APOLLOHOSP.NS',
        'AUROPHARMA.NS', 'GLENMARK.NS', 'BIOCON.NS', 'IPCALAB.NS', 'LAURUSLABS.NS', 'NATCOPHARM.NS', 'GRANULES.NS',
        'MARKSANS.NS', 'SEQUENT.NS', 'CAPLIPOINT.NS', 'IOLCP.NS', 'ORCHPHARMA.NS',
    ],
    'Metal/Steel/Mining': [
        'TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'VEDL.NS', 'HINDZINC.NS', 'COALINDIA.NS',
        'JINDALSTEL.NS', 'APLAPOLLO.NS', 'SAIL.NS', 'NMDC.NS', 'NATIONALUM.NS', 'NALCO.NS', 'JSL.NS', 'HINDCOPPER.NS',
        'MOIL.NS', 'GMDCLTD.NS', 'WELCORP.NS', 'RATNAMANI.NS',
    ],
    'Cement/Infra': [
        'ULTRACEMCO.NS', 'SHREECEM.NS', 'AMBUJACEM.NS',
        'ACC.NS', 'DALBHARAT.NS', 'JKCEMENT.NS', 'RAMCOCEM.NS', 'NUVOCO.NS', 'STARCEMENT.NS',
        'ORIENTCEM.NS', 'JKLAKSHMI.NS', 'KCP.NS', 'SAURASHCEM.NS',
    ],
    'Infrastructure/GDP': [
        'LT.NS', 'NTPC.NS', 'POWERGRID.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 'SIEMENS.NS', 'ABB.NS',
        'NHPC.NS', 'SJVN.NS', 'NBCC.NS', 'RVNL.NS', 'IRB.NS', 'GMRAIRPORT.NS', 'KEC.NS', 'KALPATPOWR.NS', 'NCC.NS', 'IRCON.NS',
        'HCC.NS', 'PNCINFRA.NS',
    ],
    'Power/Renewables': [
        'NTPC.NS', 'POWERGRID.NS', 'TATAPOWER.NS', 'ADANIGREEN.NS', 'ADANIPOWER.NS', 'JSWENERGY.NS',
        'SUZLON.NS', 'NHPC.NS', 'SJVN.NS', 'IREDA.NS', 'INOXWIND.NS', 'WAAREEENER.NS',
        'JPPOWER.NS', 'RPOWER.NS',
    ],
    'War/Geopolitics/Defense': [
        'HAL.NS', 'BEL.NS', 'BDL.NS', 'MAZDOCK.NS', 'BHEL.NS', 'SOLARINDS.NS',
        'COCHINSHIP.NS', 'GRSE.NS', 'BEML.NS', 'DATAPATTNS.NS', 'ASTRAMICRO.NS',
        'ZENTEC.NS', 'MTARTECH.NS', 'PARAS.NS',
    ],
    'Railways': [
        'IRCTC.NS', 'IRFC.NS', 'RVNL.NS', 'TITAGARH.NS', 'JWL.NS', 'RAILTEL.NS', 'RITES.NS', 'IRCON.NS', 'TEXRAIL.NS',
    ],
    'Telecom': [
        'BHARTIARTL.NS', 'INDUSTOWER.NS', 'TATACOMM.NS', 'IDEA.NS', 'HFCL.NS', 'TEJASNET.NS', 'ITI.NS',
        'STLTECH.NS', 'MTNL.NS', 'GTLINFRA.NS', 'TANLA.NS',
    ],
    'Insurance': [
        'SBILIFE.NS', 'HDFCLIFE.NS', 'ICICIGI.NS', 'LICI.NS', 'POLICYBZR.NS', 'ICICIPRULI.NS', 'SBICARD.NS',
        'NIACL.NS', 'GICRE.NS', 'STARHEALTH.NS', 'NIVABUPA.NS', 'MFSL.NS',
    ],
    'FMCG/Consumer': [
        'HINDUNILVR.NS', 'NESTLEIND.NS', 'ITC.NS', 'BRITANNIA.NS', 'DABUR.NS', 'MARICO.NS', 'GODREJCP.NS', 'TATACONSUM.NS', 'VBL.NS',
        'COLPAL.NS', 'EMAMILTD.NS', 'RADICO.NS', 'PATANJALI.NS', 'BIKAJI.NS', 'HATSUN.NS',
        'BAJAJCON.NS', 'JYOTHYLAB.NS', 'BECTORFOOD.NS', 'CCL.NS',
    ],
    'Real Estate': [
        'DLF.NS', 'LODHA.NS', 'GODREJPROP.NS', 'OBEROIRLTY.NS', 'PRESTIGE.NS', 'PHOENIXLTD.NS',
        'BRIGADE.NS', 'SOBHA.NS', 'ANANTRAJ.NS',
        'MAHLIFE.NS', 'SUNTECK.NS', 'RUSTOMJEE.NS',
    ],
    'Chemicals/Fertilizers': [
        'PIDILITIND.NS', 'SRF.NS', 'UPL.NS',
        'DEEPAKNTR.NS', 'COROMANDEL.NS', 'PIIND.NS', 'TATACHEM.NS', 'CHAMBLFERT.NS', 'ATUL.NS', 'RCF.NS', 'FACT.NS',
        'NFL.NS', 'GNFC.NS', 'GSFC.NS', 'DEEPAKFERT.NS', 'ALKYLAMINE.NS',
    ],
    'Consumer Durables/Retail': [
        'TITAN.NS', 'DMART.NS', 'TRENT.NS', 'HAVELLS.NS', 'ETERNAL.NS', 'ASIANPAINT.NS', 'DIXON.NS',
        'VOLTAS.NS', 'BERGEPAINT.NS', 'KALYANKJIL.NS', 'SWIGGY.NS', 'RELAXO.NS', 'CROMPTON.NS', 'WHIRLPOOL.NS', 'BATAINDIA.NS',
        'V2RETAIL.NS', 'VMART.NS', 'CAMPUS.NS', 'ORIENTELEC.NS',
    ],
    'Aviation/Travel/Hotels': [
        'INDIGO.NS', 'INDHOTEL.NS', 'IRCTC.NS', 'LEMONTREE.NS', 'EIHOTEL.NS', 'CHALET.NS', 'THOMASCOOK.NS',
        'SPICEJET.NS', 'EASEMYTRIP.NS',
    ],
    'Shipping/Logistics': [
        'ADANIPORTS.NS', 'CONCOR.NS', 'DELHIVERY.NS', 'SCI.NS', 'GESHIP.NS',
        'BLUEDART.NS', 'GPPL.NS', 'TCIEXP.NS', 'MAHLOG.NS', 'ALLCARGO.NS',
    ],
    'Media/Entertainment': [
        'SUNTV.NS', 'PVRINOX.NS', 'ZEEL.NS', 'NAZARA.NS', 'SAREGAMA.NS',
        'NETWORK18.NS', 'TV18BRDCST.NS', 'HATHWAY.NS',
    ],
};
