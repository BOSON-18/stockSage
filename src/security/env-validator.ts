

interface EnvCheck {
    key: string;
    required: boolean;
    description: string;
    skipWhenLocal?: boolean;
}

const ENV_CHECKS: EnvCheck[] = [
    { key: 'DEEPSEEK_API_KEY', required: true, description: 'DeepSeek LLM', skipWhenLocal: true },
    { key: 'TYPESAFE_API_KEY', required: true, description: 'TypeSafe Jev decisions', skipWhenLocal: false },
    { key: 'GROWW_API_KEY', required: true, description: 'Groww portfolio (optional)' },
    { key: 'GROWW_API_SECRET', required: true, description: 'Groww portfolio (optional)' },
]


export function validateEnv(): boolean {
    const useLocal = process.env.USE_LOCAL !== 'false';
    let allGood = true;

    console.log('Environment: ');
    for (const check of ENV_CHECKS) {
        if (check.skipWhenLocal && useLocal) continue;

        const val = process.env[check.key];
        const set = val !== undefined && val.length > 0;

        if (!set && check.required) {
            console.log(`❌ ${check.key} - MISSING (${check.description})`);
            allGood = false;

        } else if (!set) {
            console.log(` ⚠️ ${check.key} - not set (${check.description})`);
        } else {
            console.log(`✅ ${check.key} - ${val!.slice(0, 4)}****`);
        }
    }

    if (!allGood) {
        console.log('\n❌ Environment validation failed - cannot start StockSage');
    } else {
        console.log('\n✅ Environment OK');
    }

    return allGood;
}