import 'dotenv/config'

export const TICKERS = [
    // 'RELIANCE.NS',
    // 'TATASTEEL.NS',
    // 'INFY.NS',
    'HDFCBANK.NS',
    // 'TCS.NS',
    // 'ICICIBANK.NS',
]


export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
export const DELAY_BETWEEN_CALLS_MS = 2000;


// const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
export const USE_LOCAL = process.env.USE_LOCAL !== 'false'
export const LOCAL_MODEL = process.env.LOCAL_MODEL || ''
export const CLOUD_MODEL = process.env.CLOUD_MODEL || ''
export const LLM_MODEL = USE_LOCAL ? LOCAL_MODEL : CLOUD_MODEL;