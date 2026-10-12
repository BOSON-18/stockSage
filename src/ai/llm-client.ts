
import OpenAI from 'openai';
import { LLM_MODEL, MAX_RETRIES, RETRY_DELAY_MS, USE_LOCAL } from '../config';
import { trackCost } from '../security/tracker';

const llmClient = new OpenAI(
    USE_LOCAL
        ? { apiKey: 'ollama', baseURL: 'http://localhost:11434/v1' }
        : { apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' }

);


export async function callLLM(prompt: string): Promise<string> {

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

        try {



            const response = await llmClient.chat.completions.create({
                model: LLM_MODEL,
                messages: [
                    {
                        role: 'system', 'content': 'Always respond in valid JSON format'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3
            });

            const content = response.choices[0]?.message?.content;


            if (!content) {
                throw new Error('LLM returned empty response');
            }

            // Track Cost for cloud calls
            if (!USE_LOCAL) {
                const usage = response.usage;
                if (usage) {
                    trackCost('deepseek', usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);
                }
            }
            return content
            // return content;

        } catch (error) {
            lastError = error;

            if (attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.warn(`LLM attempt ${attempt} failed, retrying in ${(delay / 1000).toFixed(1)}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw lastError ?? new Error('LLM call failed after all retries')
}
