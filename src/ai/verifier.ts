import { getJevProvider } from "./jev-procider";


export interface VerfiedClaim {

    claim: string;
    // status: 'VERIFIED' | 'INFERRED' | 'UNSUPPORTED';
    status: 'VERIFIED' | 'DISPUTED' | 'OPINION';
    confidence: number;

}

function isFactualClaim(claim: string): boolean {
    const predictionWords = [
        'expected', 'likely', 'could', 'may', 'might', 'should', 'will', 'predict', 'forecase', 'estimate', 'potential', 'outlook', 'target', 'upside', 'downside', 'opportunity', 'recommend', 'suggest', 'anticipate', 'projected', 'if', 'would', 'can', 'possible', 'probably'
    ];
    const lower = claim.toLowerCase();
    return !predictionWords.some(word => lower.includes(word));
}

export async function verifyClaims(
    reasoning: string,
    dataContext: string
): Promise<VerfiedClaim[]> {
    const jev = getJevProvider();

    // Split reasoning into individual claims
    const claims = reasoning.split(/[.|;]/).map(c => c.trim()).filter(c => c.length > 10); // skip tiny fragments

    if (claims.length === 0) return [];

    const verified: VerfiedClaim[] = [];

    for (const claim of claims) {

        if (!isFactualClaim(claim)) {
            verified.push({ claim, status: 'OPINION', confidence: 0 });
            continue;
        }
        const result = await jev.noul(
            `${dataContext}\n\nFACTUAL CLAIM: "${claim}"`,
            'Is this factual claim (about numbers, prices, indicators, or events) directly supported by the data above? 1.0 = clearly matches, 0.0 = not found or contradicts.'

            // `${dataContext}\n\nCLAIM TO VERIFY: "${claim}"\n\n A claim is supported if the data above contains numbers, facts, or indicators that directly justify it. A claim is NOT SUPPORTED if it makes predications, estimates, or statements not found in the data.`,
            // 'Based ONLY on the data above, is this specifc claim factually supported? (1.0 = clearly supported by the numbers, 0.0 = no data supports this claim)'
        );

        // console.log('[Verifier] Chceking result before status assign: ', result)


        // let status: VerfiedClaim['status'];
        // if (result.probability >= 0.70) status = 'VERIFIED';
        // else if (result.probability >= 0.40) status = 'INFERRED';
        // else status = 'UNSUPPORTED';

        verified.push({
            claim, status: result.probability >= 0.60 ? 'VERIFIED' : 'DISPUTED', confidence: result.probability
        });
    }

    return verified;
}



//  Verify all LLM agent verdicts in one pass
//  Return amp : ticker -. verified claims

export async function verifyCommitteeResults(
    verdictMap: Record<string, { agent: string; reasoning: string }[]>,
    dataContexts: Record<string, string>
): Promise<Record<string, VerfiedClaim[]>> {

    const results: Record<string, VerfiedClaim[]> = {};
    for (const [ticker, verdicts] of Object.entries(verdictMap)) {
        const dataContext = dataContexts[ticker] ?? '';
        results[ticker] = [];

        const llmVerdicts = verdicts.filter(v => v.agent === 'NEWS' || v.agent === 'RISK');


        for (const verdict of llmVerdicts) {
            console.log(`Verifying ${verdict.agent} claims for ${ticker}...`);
            const claims = await verifyClaims(verdict.reasoning, dataContext);
            results[ticker].push(...claims)
        }

        const all = Object.values(results).flat();
        console.log(`Claims: ${all.filter(c => c.status === 'VERIFIED').length} ✅ verified | ${all.filter(c => c.status === 'DISPUTED').length} ❌ disputed | ${all.filter(c => c.status === 'OPINION').length} 👁️ opinion`)
    }

    return results;

}