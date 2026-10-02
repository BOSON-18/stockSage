import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from '../types';
import { NEWS_QUERY } from '../config';



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

        return items.slice(0, 25).map((article: any) => {

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



export async function fetchAllNews(): Promise<NewsItem[]> {

    const [indianNews, globalNews] = await Promise.all([
        fetchRssFeed(NEWS_QUERY.indian),
        fetchRssFeed(NEWS_QUERY.global),
    ]);

    console.log(` Indian news : ${indianNews.length} articles`);
    console.log(` Global news : ${globalNews.length} articles`);

    return [...indianNews, ...globalNews];
}