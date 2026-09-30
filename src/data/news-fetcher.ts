import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from '../types';



export async function fetchnews(): Promise<NewsItem[]> {

    // if (!NEWS_API_KEY) {
    //     console.log(' No NEWS_API_KEY set - running without news context.');
    //     return [];
    // }

    try {
        // const url = `https://newsapi.org/v2/top-headlines?` + `country=in&category=business&pageSize=10&apiKey=${NEWS_API_KEY}`;
        // const response = await fetch(url);

        // const params = new URLSearchParams({
        //     q: "(Sensex OR Nifty OR \"stock market\") AND India",
        //     language: "en",
        //     sortBy: "publishedAt",
        //     pageSize: "10",
        //     apiKey: NEWS_API_KEY!,
        // });
        // const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
        // const data = await response.json();

        const query = encodeURIComponent('Indian stock market Sensex Nifty');
        const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

        const response = await fetch(url);
        const xmlText = await response.text();

        // if (data.status !== 'ok' || !data.articles) {
        //     console.warn(' News APi returned unexpected response, skipping news.');
        //     return [];
        // }

        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(xmlText);

        // console.log('Fetching news: ', data)

        const items = parsed?.rss?.channel?.item;
        if (!items || !Array.isArray(items)) {
            console.warn(' No news items in RSS feed');
            return [];
        }

        return items.slice(0, 10).map((article: any) => ({
            title: article.title ?? '',
            description: article.description ?? '',
            source: article.source ?? 'Google News',
            publishedAt: article.pubDate ?? ''
        }))
    } catch (error) {
        console.warn(' News fetch failed, continuing without news:', error);
        return [];
    }

}
