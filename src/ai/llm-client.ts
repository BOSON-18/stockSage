
import OpenAI from 'openai';
import { LLM_MODEL, USE_LOCAL } from '../config';

const llmClient = new OpenAI(
    USE_LOCAL
        ? { apiKey: 'ollama', baseURL: 'http://localhost:11434/v1' }
        : { apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' }
    // : { apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }
);


export async function callLLM(prompt: string): Promise<string> {



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
    return content;
}
