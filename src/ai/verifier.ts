import { getJevProvider } from "./jev-procider";


export interface VerfiedClaim {

    claim: string;
    status: 'VERIFIED' | 'INFERRED' | 'UNSUPPORTED';
    confidence: number;

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
        const result = await jev.noul(
            `${dataContext}\n\nCLAIM TO VERIFY: "${claim}"\n\n A claim is supported if the data above contains numbers, facts, or indicators that directly justify it. A claim is NOT SUPPORTED if it makes predications, estimates, or statements not found in the data.`,
            'Based ONLY on the data above, is this specifc claim factually supported? (1.0 = clearly supported by the numbers, 0.0 = no data supports this claim)'
        );

        console.log('[Verifier] Chceking result before status assign: ', result)


        let status: VerfiedClaim['status'];
        if (result.probability >= 0.70) status = 'VERIFIED';
        else if (result.probability >= 0.40) status = 'INFERRED';
        else status = 'UNSUPPORTED';

        verified.push({
            claim, status, confidence: result.probability
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
    }

    return results;

}