import { promises } from "node:dns";
import { callLLM } from "./llm-client";
import 'dotenv/config'



export interface ChoiceResult {
    selected: string;
    probabilities: Record<string, number>;
}

export interface ScoreResult {
    level: string;
    levelIndex: number;
}

export interface NoulResult {
    probability: number;
}

export interface JevProvider {
    choice(context: string, question: string, options: string[]): Promise<ChoiceResult>,
    score(context: string, question: string, levels: string[]): Promise<ScoreResult>,
    noul(context: string, question: string): Promise<NoulResult>
}

export class MockJevProvider implements JevProvider {
    async choice(context: string, question: string, options: string[]): Promise<ChoiceResult> {
        const prompt = `You are a DECISON ENGINE. Answer with JSON only,no explanantion.

CONTEXT:
${context}

QUESTION: ${question}
OPTIONS: ${options.join(', ')}

Assign a probability (0.0 to 1.0) to EACH option. They MUST sum to 1.0.
Pick the option with highest probability as "selected".

{
        "selected":"<one of the options>",
        "probabilities":{ ${options.map(o => `"${o}":<0.0-1.0>`).join(', ')}}
}

`
        try {
            const raw = await callLLM(prompt);
            const parsed = JSON.parse(raw);
            return {
                selected: parsed.selected ?? options[0],
                probabilities: parsed.probabilities ?? {}
            }
        } catch (error) {
            const probs: Record<string, number> = {}
            options.forEach(o => probs[o] = 1 / options.length);
            return {
                selected: options[0],
                probabilities: probs
            }
        }
    }

    async score(context: string, question: string, levels: string[]): Promise<ScoreResult> {
        const prompt = `You are a DECISION ENGINE. Answer with JSON only, no explanation.

CONTEXT:
${context}

QUESTION: ${question}
LEVELS (ordered low to high): ${levels.join(', ')}

Pick the most appropriate level.

{
    "level":"<one of the levels>",
    "levelIndex":<0-based index>
}
`
        try {
            const raw = await callLLM(prompt);
            const parsed = JSON.parse(raw);
            return {
                level: parsed.level ?? levels[Math.floor(levels.length / 2)],
                levelIndex: parsed.levelIndex ?? Math.floor(levels.length / 2)
            }
        } catch (error) {
            return {
                level: levels[Math.floor(levels.length / 2)],
                levelIndex: Math.floor(levels.length / 2)
            }
        }
    }

    async noul(context: string, question: string): Promise<NoulResult> {
        const prompt = `You are a DECISION ENGINE. Answer with JSON only, no explanation.

CONTEXT:
${context}

QUESTION: ${question}

Output the probability 0.0 (definitely no) and 1.0 (definitely yes).

{
    "probability":<0.0-1.0>
}
`

        try {
            const raw = await callLLM(prompt);
            const parsed = JSON.parse(raw);
            return {
                probability: parsed.probability ?? 0.5
            }
        } catch (error) {
            return {
                probability: 0.5
            }
        }
    }

};


// REAL JEV PROVIDER

export class RealJevProvider implements JevProvider {

    private client: any;
    private intialized = false;

    async init(): Promise<void> {
        if (this.intialized) return;


        const { TypeSafeClient, choice, score, noul } = await import('@typesafe-ai/sdk');

        const apiKey = process.env.VERCEL_API_KEY || process.env.TYPESAFE_API_KEY || '';

        const baseURL = process.env.VERCEL_API_KEY ? 'https://ai-gateway.vercel.sh/typesafe' : undefined;


        if (process.env.VERCEL_API_KEY) {
            this.client = new TypeSafeClient({ apiKey, baseURL });

        } else {
            this.client = new TypeSafeClient({ apiKey })
        }
        this.intialized = true;

    }

    async choice(context: string, question: string, options: string[]): Promise<ChoiceResult> {
        await this.init();
        const { choice } = await import('@typesafe-ai/sdk');

        const optionsObj: Record<string, null> = {};
        options.forEach(o => optionsObj[o] = null)
        const res = await this.client.systemOne({
            model: 'jev-latest',
            state: context,
            questions: {
                answer: choice(question, optionsObj)
            }
        });

        const answer = res.answers?.answer;
        return {
            selected: answer?.choice ?? options[0],
            probabilities: answer?.probabilities ?? {}
        }
    }
    async score(context: string, question: string, levels: string[]): Promise<ScoreResult> {
        await this.init();
        const { score } = await import('@typesafe-ai/sdk');


        const res = await this.client.systemOne({
            model: 'jev-latest',
            state: context,
            questions: {
                answer: score(question, levels as [string, string, ...string[]])
            }
        });
        console.log('FULL response SCORE: ', JSON.stringify(res, null, 2))
        const answer = res.answers?.answer;
        return {
            level: answer?.value ?? levels[Math.floor(levels.length / 2)],
            levelIndex: answer?.levelIndex ?? Math.floor(levels.length / 2)
        }
    }
    async noul(context: string, question: string): Promise<NoulResult> {
        await this.init();
        const { noul } = await import('@typesafe-ai/sdk');


        const res = await this.client.systemOne({
            model: 'jev-latest',
            state: context,
            questions: {
                answer: noul(question,)
            }
        });



        const answer = res.answers?.answer;
        return {
            probability: answer?.noul ?? answer?.probability ?? answer?.value ?? 0.5
        }
    }
}


let _provider: JevProvider | null = null;
const USE_REAL_JEV = !!(process.env.VERCEL_API_KEY || process.env.TYPESAFE_API_KEY);

export function getJevProvider(): JevProvider {
    if (!_provider) {

        if (USE_REAL_JEV) {
            console.log(`using REAL jev ${process.env.VERCEL_API_KEY ? 'VERCEL' : 'TYPESAFE'}`);
            _provider = new RealJevProvider()
        } else {
            console.log('using Mock jev (LLM-based');
            _provider = new MockJevProvider()
        }
    }

    return _provider;
}

