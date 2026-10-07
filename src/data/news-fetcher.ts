import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from '../types';
import { DIRECT_RSS_FEEDS, NEWS_QUERY } from '../config';




async function fetchRssFeed(query: string): Promise<NewsItem[]> {


    try {
        const encoded = encodeURIComponent(query);
        const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;

        const response = await fetch(url);
        const xmlText = await response.text();

        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(xmlText);

        const items = parsed?.rss?.channel?.item;
        if (!items || !Array.isArray(items)) {
            console.warn(' No news items in RSS feed');
            return [];
        }

        return items.slice(0, 100).map((article: any) => {

            const rawSource = article.source;
            const sourceName = typeof rawSource === 'string' ? rawSource : rawSource?.['#text'] ?? rawSource?.['$text'] ?? 'Google News'

            return {
                title: article.title ?? '',
                description: article.description ?? '',
                source: sourceName,
                publishedAt: article.pubDate ?? ''
            }
        })
    } catch (error) {
        console.warn(' News fetch failed, continuing without news:', error);
        return [];
    }

}

async function fetchDirectRss(url: string): Promise<NewsItem[]> {

    try {

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })

        if (!response.ok) return [];

        const xmlText = await response.text();
        const parser = new XMLParser({ ignoreAttributes: false })
        const parsed = parser.parse(xmlText)

        const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];

        if (!Array.isArray(items)) return [];

        return items.slice(0, 20).map((item: any) => {
            const rawSource = item.source;
            const sourceName = typeof rawSource === 'string' ? rawSource : rawSource?.['#text'] ?? rawSource?.['$text'] ?? new URL(url).hostname;

            return {
                title: item.title ?? '',
                description: item.description ?? item.summary ?? '',
                source: sourceName,
                publishedAt: item.pubDate ?? item.published ?? item.updated ?? ''
            };
        });


    } catch (error) {
        console.warn('Error in fetchDirectRss')
        return []
    }
}


export async function fetchAllNews(): Promise<NewsItem[]> {

    // const [indianNews, globalNews, moneycontrol, et, premarket] = await Promise.all([
    //     fetchRssFeed(NEWS_QUERY.indian),
    //     fetchRssFeed(NEWS_QUERY.global),
    //     fetchRssFeed(NEWS_QUERY.moneyCOntrol),
    //     fetchRssFeed(NEWS_QUERY.economicTimes),
    //     fetchRssFeed(NEWS_QUERY.premarket),
    // ]);

    // console.log(` Indian news : ${indianNews.length} articles`);
    // console.log(` Global news : ${globalNews.length} articles`);
    // console.log(` MoneyControl news : ${moneycontrol.length} articles`);
    // console.log(` Economic Times news : ${et.length} articles`);
    // console.log(` Premarket news : ${premarket.length} articles`);

    // return [...indianNews, ...globalNews, ...moneycontrol, ...et, ...premarket];


    const googleFeeds = Object.values(NEWS_QUERY).map(q => fetchRssFeed(q));
    const directFeeds = DIRECT_RSS_FEEDS.map(u => fetchDirectRss(u));

    const results = await Promise.all([...googleFeeds, ...directFeeds]);

    const googleCount = results.slice(0, googleFeeds.length).reduce((sum, r) => sum + r.length, 0)
    const directCount = results.slice(googleFeeds.length).reduce((sum, r) => sum + r.length, 0)
    console.log(`News: ${googleCount} from Google RSS | ${directCount} from direct feeds (MC,ET, Mint)`);

    return results.flat();

}


export async function fetchStockNews(
    ticker: string,
    companyName: string
): Promise<NewsItem[]> {

    const symbol = ticker.replace('.NS', '');
    const query = `${symbol} OR "${companyName}" NSE stock`;
    const articles = await fetchRssFeed(query);
    return articles.slice(0, 5);
}


export async function fetchStockNewsBatch(
    stocks: { ticker: string; companyName: string }[]
): Promise<Record<string, NewsItem[]>> {
    const result: Record<string, NewsItem[]> = {};

    for (const stock of stocks) {
        console.log(`Fetching news for ${stock.ticker}...`);
        result[stock.ticker] = await fetchStockNews(stock.ticker, stock.companyName);
        console.log(`${stock.ticker}: ${result[stock.ticker].length} articles`);
    }

    return result;
}