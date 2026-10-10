import * as fs from 'fs';
import * as path from 'path';
import YahooFinance from 'yahoo-finance2';


const yahooFinance = new YahooFinance();
const TRADES_FILE = path.join(process.cwd(), 'data', 'paper-trades.json');
const LESSONS_FILE = path.join(process.cwd(), 'data', 'auto-lessons.json');

export interface PaperTrade {
    date: string;
    ticker: string;
    action: string;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    confidence: number;
    jevBuyProb: number;
    holdingPeriod: string;
    // Filled later when checking outcomes
    currentPrice?: number;
    dayHigh?: number;
    dayLow?: number;
    pnlPercent?: number;
    outcome?: 'WIN' | 'LOSS' | 'OPEN' | 'HIT_TARGET' | 'HIT_STOPLOSS';
    checkedDate?: string;
    failureReason?: string;
    lessonGenerated?: string;

}

interface AutoLesson {
    date: string;
    type: 'entry_price' | 'entry_timing' | 'exit_strategy' | 'news_reaction' | 'wrong_direction' | 'correct_call';
    lesson: string;
    ticker: string;
    severity: 'critical' | 'high' | 'medium' | 'info';
    count: number; // how many times this pattern occured
}

// Load or save Trades

function loadTrades(): PaperTrade[] {
    try {
        if (fs.existsSync(TRADES_FILE)) {
            return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'))
        }
    } catch (error) {
        console.error('Failed to load trades');
        return [];
    }
    return [];
}

function saveTrades(trades: PaperTrade[]): void {
    try {
        const dir = path.dirname(TRADES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
    } catch (error) {
        console.error('Failed to save trades: ', error);
    }
}

function loadLessons(): AutoLesson[] {
    try {
        if (fs.existsSync(LESSONS_FILE)) return JSON.parse(fs.readFileSync(LESSONS_FILE, 'utf-8'))
    } catch {
        console.warn('Error in Loading Lessons')
    }
    return []
};

function saveLessons(lessons: AutoLesson[]): void {
    try {
        const dir = path.dirname(LESSONS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2));
    } catch (error) {
        console.warn('Error in Saving Lessons')
    }
}

export function saveRecommendations(
    recommendations: { ticker: string; action: string; currentPrice: number; targetPrice: number; stopLoss: number; confidence: number; holdingPeriod: string; jevProbabilities: Record<string, number> }[]
): void {

    const trades = loadTrades();
    const today = new Date().toISOString().split('T')[0];

    for (const rec of recommendations) {
        if (trades.some(t => t.date === today && t.ticker === rec.ticker)) continue;

        trades.push({
            date: today,
            ticker: rec.ticker,
            action: rec.action,
            entryPrice: rec.currentPrice,
            targetPrice: rec.targetPrice,
            stopLoss: rec.stopLoss,
            confidence: rec.confidence,
            jevBuyProb: rec.jevProbabilities?.BUY ?? 0,
            holdingPeriod: rec.holdingPeriod
        });
    }
    saveTrades(trades);
    console.log(`Paper trades saved: ${recommendations.length}  picks (total: ${trades.length})`)
}

// export async function checkOutcomes(): Promise<
//     {
//         checked: number;
//         wins: number;
//         losses: number;
//         open: number;
//         winRate: number;
//         avgPnl: number;
//         lessons: string[];

//     }> {

//     const trades = loadTrades();
//     const today = new Date().toISOString().split('T')[0];
//     let checked = 0;
//     let wins = 0;
//     let losses = 0;
//     let open = 0;
//     let totalPnl = 0;

//     const lessons: string[] = [];

//     for (const trade of trades) {
//         if (trade.outcome || trade.date === today) continue;

//         try {
//             const quote = await yahooFinance.quote(trade.ticker, {}, { validateResult: false }) as any;
//             const currentPrice = quote.regularMarketPrice ?? 0;
//             if (currentPrice == 0) continue;


//             trade.currentPrice = currentPrice;
//             trade.checkedDate = today;

//             const pnl = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
//             trade.pnlPercent = pnl;

//             if (currentPrice >= trade.targetPrice) {
//                 trade.outcome = 'HIT_TARGET';
//                 wins++;
//                 lessons.push(`✅ ${trade.ticker}: target hit! + ${pnl.toFixed(1)}% (entry Rs.${trade.entryPrice.toFixed(0)} -> Rs.${currentPrice.toFixed(0)})`)
//             } else if (currentPrice <= trade.stopLoss) {
//                 trade.outcome = 'HIT_STOPLOSS';
//                 losses++;
//                 lessons.push(`❌ ${trade.ticker}: stop loss hit ${pnl.toFixed(1)}% (entry Rs.${trade.entryPrice.toFixed(0)} -> Rs.${currentPrice.toFixed(0)})`)
//             } else if (pnl > 0) {
//                 trade.outcome = 'WIN';
//                 wins++;
//                 lessons.push(`🟢 ${trade.ticker}: +${pnl.toFixed(1)}% (still open)`)
//             } else {
//                 trade.outcome = 'LOSS';
//                 losses++;
//                 lessons.push(`🔴 ${trade.ticker}: ${pnl.toFixed(1)}% (still open)`)
//             }

//             totalPnl += pnl;
//             checked++;


//         } catch (error) {

//         }

//         open = trades.filter(t=>!t.outcome && t.date !==today).length;

//         saveTrades(trades);

//         const completedTrades = wins + losses;
//         const winRate = completedTrades >0 ? (wins/completedTrades)*100 : 0;
//         const avgPnl = checked >0 totalPnl/checked : 0;

//         return {checked,wins,losses,open,winRate,avgPnl,lessons}
//     }
// }

export async function checkOutcomes(): Promise<{
    checked: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnl: number;
    lessons: string[];
}> {
    const trades = loadTrades();
    const autoLessons = loadLessons();
    const today = new Date().toISOString().split('T')[0];
    let checked = 0;
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    const lessons: string[] = [];

    for (const trade of trades) {
        if (trade.outcome || trade.date === today) continue;

        try {
            const quote = await yahooFinance.quote(trade.ticker, {}, { validateResult: false }) as any;
            const currentPrice = quote.regularMarketPrice ?? 0;
            if (currentPrice === 0) continue;

            trade.currentPrice = currentPrice;
            trade.dayHigh = quote.regularMarketDayHigh ?? quote.dayHigh ?? 0;
            trade.dayLow = quote.regularMarketDayLow ?? quote.dayLow ?? 0;
            trade.checkedDate = today;

            const pnl = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
            trade.pnlPercent = pnl;

            if (currentPrice >= trade.targetPrice) {
                trade.outcome = 'HIT_TARGET';
                wins++;
                // lessons.push(`✅ ${trade.ticker}: target hit! +${pnl.toFixed(1)}% (entry Rs.${trade.entryPrice.toFixed(0)} -> Rs.${currentPrice.toFixed(0)})`);
            } else if (currentPrice <= trade.stopLoss) {
                trade.outcome = 'HIT_STOPLOSS';
                losses++;
                // lessons.push(`❌ ${trade.ticker}: stop loss hit ${pnl.toFixed(1)}% (entry Rs.${trade.entryPrice.toFixed(0)} -> Rs.${currentPrice.toFixed(0)})`);
            } else if (pnl > 0) {
                trade.outcome = 'WIN';
                wins++;
                // lessons.push(`🟢 ${trade.ticker}: +${pnl.toFixed(1)}% (still open)`);
            } else {
                trade.outcome = 'LOSS';
                losses++;
                // lessons.push(`🔴 ${trade.ticker}: ${pnl.toFixed(1)}% (still open)`);
            }

            const analysis = analyzeTradeOutcome(trade);
            trade.failureReason = analysis.reason;
            trade.lessonGenerated = analysis.lesson.lesson;

            const existingLesson = autoLessons.find(l => l.type === analysis.lesson.type && l.ticker == trade.ticker);
            if (existingLesson) {
                existingLesson.count++;
                existingLesson.date = today;
            } else {
                autoLessons.push(analysis.lesson);
            }

            const icon = trade.outcome === 'HIT_TARGET' || trade.outcome === 'WIN' ? '✅' : '❌'
            lessons.push(`${icon} ${trade.ticker}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% - ${analysis.reason}`)
            totalPnl += pnl;
            checked++;
        } catch (error) {
            console.error(`Failed to check ${trade.ticker}:`, error);
        }
    }


    // const open = trades.filter(t => !t.outcome && t.date !== today).length;
    saveTrades(trades);
    saveLessons(autoLessons);

    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const avgPnl = checked > 0 ? totalPnl / checked : 0;

    return { checked, wins, losses, winRate, avgPnl, lessons };
}

export function analyzeTradeOutcome(trade: PaperTrade): {
    reason: string;
    lesson: AutoLesson
} {

    const dayHigh = trade.dayHigh ?? 0;
    const dayLow = trade.dayLow ?? 0;
    const current = trade.currentPrice ?? trade.entryPrice;
    const pnl = trade.pnlPercent ?? 0;
    if (dayHigh == 0 || dayLow == 0) {
        console.warn('Missing day range data, cannot analyze', trade.ticker);
    }



    //  1. Entry was at/near day's high - bought at worst price
    if (dayHigh > 0 && trade.entryPrice >= dayHigh * 0.99) {

        return {
            reason: 'Entry at day high - bought at worst possible price',
            lesson: {
                date: trade.checkedDate ?? trade.date,
                type: 'entry_timing',
                lesson: `${trade.ticker}: entered at Rs.${trade.entryPrice.toFixed(0)} which was the day's high (Rs.${dayHigh.toFixed(0)}). Wait for pullback or use VWAP as entry.`,
                ticker: trade.ticker,
                severity: 'critical',
                count: 1
            }
        }

    }

    if (dayLow > 0 && trade.entryPrice < dayLow) {
        return {
            reason: 'Entry below day low - order would never fill',
            lesson: {
                date: trade.checkedDate ?? trade.date,
                type: 'entry_price',
                lesson: `${trade.ticker}: entry Rs.${trade.entryPrice.toFixed(0)}  was below day's low (Rs.${dayLow.toFixed(0)}).Use market order or set limit at/above current price.`,
                ticker: trade.ticker,
                severity: 'critical',
                count: 1
            }
        }
    }


    if (dayHigh > 0 && dayHigh >= trade.targetPrice * 0.99 && pnl < 0) {

        return {
            reason: 'Target nearly hit mid-day but reversed - no trailing SL',
            lesson: {
                date: trade.checkedDate ?? trade.date,
                type: 'exit_strategy',
                lesson: `${trade.ticker}: price reached Rs.${dayHigh.toFixed(0)} (within 1% of target Rs.${trade.targetPrice.toFixed(0)}) but reversed to Rs.${current.toFixed(0)}. Use trailiung stop loss  when 70%+ of target is reached.`,
                ticker: trade.ticker,
                severity: 'high',
                count: 1
            }
        }
    }

    if (pnl < -3) {
        return {
            reason: `Wrong direction - stock dropped ${pnl.toFixed(1)}%`,
            lesson: {
                date: trade.checkedDate ?? trade.date,
                type: 'wrong_direction',
                lesson: `${trade.ticker}: recommended BUY at Rs${trade.entryPrice.toFixed(0)} but dropped to Rs.${current.toFixed(0)} (${pnl.toFixed(1)}%). Review: was the thesis based on news that didn't play out, or were technicals ignored?`,
                ticker: trade.ticker,
                severity: 'high',
                count: 1
            }
        }
    }

    if (pnl > 2) {
        return {
            reason: ` Correct call - +${pnl.toFixed(1)}%`,
            lesson: {
                date: trade.checkedDate ?? trade.date,
                type: 'correct_call',
                lesson: `${trade.ticker}: correctly identified BUY  at Rs.${trade.entryPrice.toFixed(0)}, now Rs.${current.toFixed(0)} (+${pnl.toFixed(1)}%). Confidence was ${trade.confidence}%. Look for similar setups.`,
                ticker: trade.ticker,
                severity: 'info',
                count: 1
            }
        }
    }

    return {
        reason: `Minor move (${pnl.toFixed(1)}% - no strong signal either way)`,
        lesson: {
            date: trade.checkedDate ?? trade.date,
            type: 'correct_call',
            lesson: `${trade.ticker}: moved ${pnl.toFixed(1)}% - no strong signal either way.`,
            ticker: trade.ticker,
            severity: 'medium',
            count: 1
        }
    }

}

export function getPerformanceSummary(): string {
    const trades = loadTrades()
    if (trades.length === 0) return 'No paper trades yet';

    const completed = trades.filter(t => t.outcome);
    const wins = completed.filter(t => t.outcome === 'WIN' || t.outcome === 'HIT_TARGET').length;
    const total = completed.length;
    const winRate = total > 0 ? (wins / total * 100).toFixed(0) : '0';
    const avgPnl = completed.length > 0 ? (completed.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / completed.length).toFixed(1) : '0';


    return `Paper trading: ${trades.length} total | ${total} checked | Win rate : ${winRate}% | Avg P&L: ${avgPnl}%`
}

export function getLessonsForPrompt(): string {
    const trades = loadTrades();
    const autoLessons = loadLessons();
    const completed = trades.filter(t => t.outcome).slice(-10);

    if (completed.length === 0) return '';
    const wins = completed.filter(t => t.outcome === 'WIN' || t.outcome === 'HIT_TARGET');
    const losses = completed.filter(t => t.outcome === 'LOSS' || t.outcome === 'HIT_STOPLOSS');

    let lessons = `PAST PERFORMANCE (last ${completed.length} trades):\n`;
    lessons += `Win rate: ${(wins.length / completed.length * 100).toFixed(0)}%\n`;
    lessons += `Avg P&L: ${(completed.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / completed.length).toFixed(1)}%\n\n`;

    // Critical lessons (recurring patterns)

    const criticalLessons = autoLessons.filter(l => l.severity === 'critical' || l.count >= 2).slice(-5)

    if (criticalLessons.length > 0) {
        lessons += 'CRITICAL LESSONS FROM PAST MISTAKES:\n';
        criticalLessons.forEach(l => {
            lessons += `- [${l.type}] ${l.lesson} (occured ${l.count}x)\n`;
        });
        lessons += '\n';
    }

    if (wins.length > 0) {
        // lessons += `Winning pattern: ${wins.map(t => t.ticker).join(', ')}\n`;
        lessons += `WHAT WORKED: ${wins.map(t => `${t.ticker} (+${t.pnlPercent?.toFixed(1)}%)`).join(', ')}\n`;
    }
    if (losses.length > 0) {
        lessons += `WHAT FAILED: ${losses.map(t => `${t.ticker} (${t.pnlPercent?.toFixed(1)}%) - ${t.failureReason ?? 'unknwon'}`).join(', ')}\n`;
        lessons += `AVOID similar setups`;
        // lessons += `Losing pattern: ${losses.map(t => t.ticker).join(', ')}\n`;
        // lessons += `AVOID similar setups to: ${losses.map(t => `${t.ticker} (${t.pnlPercent?.toFixed(1)}%)`).join(', ')}\n`;
    }
    return lessons;
}