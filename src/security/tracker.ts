import * as fs from 'fs'
import * as path from 'path'

const COST_FILE = path.join(process.cwd(), 'data', 'cost-log.json');

const PRICING = {
    deepseek: { input: 0.15, output: 0.60 },
    jev: { input: 0.042, output: 0 }
};

const DAILY_COST_LIMIT_USD = 1.0;

interface CostEntry {
    date: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
}

interface CostLog {
    entries: CostEntry[];
    totalUsd: number;
}

function loadCostLog(): CostLog {

    try {
        if (fs.existsSync(COST_FILE)) return JSON.parse(fs.readFileSync(COST_FILE, 'utf-8'));
    } catch (error) {
        console.warn(`Error in Loading cost log: ${error}`);
    }
    return { entries: [], totalUsd: 0 };
}

function saveCostLog(log: CostLog): void {
    try {
        const dir = path.dirname(COST_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COST_FILE, JSON.stringify(log, null, 2));
    } catch (error) {
        console.warn(`Error in saving cost log: ${error}`);
    }
}

export function trackCost(provider: 'deepseek' | 'jev', inputTokens: number, outputTokens: number): void {

    const price = PRICING[provider];
    const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output

    const log = loadCostLog();
    const today = new Date().toISOString().split('T')[0];

    log.entries.push({ date: today, provider, inputTokens, outputTokens, costUsd: cost });
    log.totalUsd += cost;
    saveCostLog(log);

}

export function checkDailyLimit(): { ok: boolean; todaySpend: number } {
    const log = loadCostLog();
    const today = new Date().toISOString().split('T')[0];
    const todaySpend = log.entries.filter(e => e.date === today).reduce((sum, e) => sum + e.costUsd, 0);

    return { ok: todaySpend < DAILY_COST_LIMIT_USD, todaySpend };
}


export function getCostSummary(): string {
    const log = loadCostLog();
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = log.entries.filter(e => e.date === today);
    const todayUsd = todayEntries.reduce((s, e) => s + e.costUsd, 0);
    const todayTokens = todayEntries.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);

    const deepseekToday = todayEntries.filter(e => e.provider === 'deepseek').reduce((s, e) => s + e.costUsd, 0);
    const jevToday = todayEntries.filter(e => e.provider === 'jev').reduce((s, e) => s + e.costUsd, 0);

    return `Cost today: ${todayUsd.toFixed(4)} (Rs.${(todayUsd * 84).toFixed(2)}) | Deepseek: $${deepseekToday.toFixed(4)} | jev: $${jevToday.toFixed(4)} | Tokens: ${todayTokens.toLocaleString()} | Total all-time: $${log.totalUsd.toFixed(4)}`
}