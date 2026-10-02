


// SOurce Credibility

import { DEFAULT_SOURCE_WEIGHT, NEWS_FILTER_THRESHOLD, SOURCE_TIERS } from "../config";
import { JevNewsClassification, NewsItem, ScoredNewsItem } from "../types";

export function getSourceWeight(sourcename: string): number {

    // console.log('[News-scorrer] Checking Source Weight for ', sourcename)
    const lower = sourcename.toLowerCase();

    for (const [known, weight] of Object.entries(SOURCE_TIERS)) {
        if (lower.includes(known.toLowerCase())) {
            return weight;
        }
    }

    return DEFAULT_SOURCE_WEIGHT;
}

// Freshness - HISTORIC news that becomes relevant again will be caught by the fresh article

export function getFreshnessScore(publishedAt: string): number {

    const published = new Date(publishedAt).getTime();

    // if can't parse -> aassume mdoerate
    if (isNaN(published)) return 0.5;

    const hoursAgo = (Date.now() - published) / (1000 * 60 * 60);

    if (hoursAgo < 6) return 1.0;
    if (hoursAgo < 12) return 0.8;
    if (hoursAgo < 24) return 0.5;
    return 0.2;
}


// Duplicate Detecteion -- ignore is a the and 

// Similarity search in the titles
function titleSimilarity(titleA: string, titleB: string): number {
    // console.log('Checking wordsA', titleA)
    // console.log('Checking wordsB', titleB)
    const wordsA = new Set(titleA.toLowerCase().split(/s\+/).filter(w => w.length > 3));
    const wordsB = new Set(titleB.toLowerCase().split(/s\+/).filter(w => w.length > 3));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) overlap++;
    }

    return overlap / Math.min(wordsA.size, wordsB.size); // Ratio against swmaller word ==> if A is subset of B so it will score high when divided by A


}

// DE DUPLICATE - Filter - High Tier SOURCE

export function deduplicateNews(articles: NewsItem[]): NewsItem[] {
    const kept: NewsItem[] = [];

    for (const article of articles) {
        // Find if any duplicate >70% dupicate

        const duplicateIndex = kept.findIndex((existing) => titleSimilarity(existing.title, article.title) >= 0.7);

        if (duplicateIndex === -1) {
            // Not a  duplicate
            kept.push(article);
        } else {
            // Duplicate found replace if higher tier source found
            if (kept[duplicateIndex].source === null) continue;
            const existingWeight = getSourceWeight(kept[duplicateIndex].source);
            const newWeight = getSourceWeight(article.source);

            if (newWeight > existingWeight) kept[duplicateIndex] = article;

            // Else discard - we already have a better version
        }
    }

    return kept;
}


//  Cross Soruce Verification


export function getCrossSourceCount(article: NewsItem, allArticles: NewsItem[]): number {

    const similarCount = allArticles.filter(
        (other) => {
            other.title !== article.title && titleSimilarity(article.title, other.title) > 0.5
        }
    ).length;

    return similarCount + 1;
}

function getCrossSourceMultiplier(count: number): number {
    if (count >= 3) return 1.5;
    if (count >= 2) return 1.0;
    return 0.7;
}




//  Score ALl - ORCHESTRATOR


export function scoreNewsBatch(rawNews: NewsItem[]): ScoredNewsItem[] {

    // Step 1 - Count cross source count
    const crossCounts = new Map<string, number>();
    for (const article of rawNews) {
        crossCounts.set(article.title, getCrossSourceCount(article, rawNews))
    }

    // Step - 2 - Deduplicate 
    const unique = deduplicateNews(rawNews);

    // Step 3 Attach all scores to each article

    // return unique.map((article) => {
    const scored = unique.map((article)=>{
        const crossCount = crossCounts.get(article.title) ?? 1;


        return {
            ...article,
            sourceTierWeight: getSourceWeight(article.source),
            freshnessScore: getFreshnessScore(article.publishedAt),
            crossSourceCount: crossCount,
            crossSourceMultiplier: getCrossSourceMultiplier(crossCount),
        }
    });

    // Step 4 : Pre filter - only top 15
    const MAX_FOR_JEV = 15;

    return scored.sort((a,b)=>{
        const scoreA = a.sourceTierWeight*a.freshnessScore*a.crossSourceMultiplier;
        const scoreB = b.sourceTierWeight*b.freshnessScore*b.crossSourceMultiplier;
        return scoreB - scoreA;
    }).slice(0,MAX_FOR_JEV);

    
}



// Combined Filter - (Code scores x jev Scores)

const SEVERITY_WEIGHTS: Record<string, number> = {
    HIGH: 1.0,
    MEDIUM: 0.7,
    LOW: 0.3
};

// Formula ; jevRelevance x seveerityWeight x sourceTier x freshness x crossSource

export function filterByScore(
    scoredNews: ScoredNewsItem[],
    jevClassificatios: JevNewsClassification[]
): ScoredNewsItem[] {

    const results: { article: ScoredNewsItem; finalScore: number }[] = [];

    for (let i = 0; i < scoredNews.length; i++) {
        const article = scoredNews[i];
        const jev = jevClassificatios[i];

        //  No jev classiication or classified as NOISE -> skip
        if (!jev || jev.impactType === 'NOISE') continue;

        const finalScore = jev.relevance * (SEVERITY_WEIGHTS[jev.severity] ?? 0.3) * article.sourceTierWeight * article.freshnessScore * article.crossSourceMultiplier;

        if (finalScore >= NEWS_FILTER_THRESHOLD) results.push({ article, finalScore });



    }
    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.map((r) => r.article);
}