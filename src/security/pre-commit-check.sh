

echo "Checking for leaked secrets..."

PATTERNS=(
    "DEEPSEEK_API_KEY=.{5,}"
    "TYPESAFE_API_KEY=.{5,}"
    "GROWW_API_KEY=.{5,}"
    "GROWW_API_SECRET=.{5,}"
    "sk-[a-zA-Z0-9]{20,}"
    "gsk_[a-zA-Z0-9]{20,}"
    "api[_-]?key.*=.*['\"][a-zA-Z0-9]{10,}"
)

FOUND=0

for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(git diff --cached --diff-filter=d -U0 | grep -iE "$pattern" | grep -v "\.env\.example" | grep -v "HANDOFF.md" | grep -v "your_.*_here" || true)
    if[ -n "$MATCHES" ]; then
        echo "❌ BLOCKED: Found potential secret matching: $pattern"
        echo "$MATCHES"
        FOUND=1
    fi
done

if [ $FOUND -eq 1 ]; then
    echo ""
    echo "Commit blocked - remove secrets before commiting."
    echo "Secrets belong in .env (git-ignored), not in code."
    exit 1
fi

echo "✅ No secrets found. Commit allowed."
exit 0