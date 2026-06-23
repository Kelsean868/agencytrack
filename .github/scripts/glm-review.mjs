import { readFileSync } from "node:fs";

const BASE_URL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
const MODEL = process.env.ZAI_MODEL || "glm-4.7-flash";
const REVIEWER = process.env.ZAI_REVIEWER_NAME || "GLM Code Reviewer";

const diff = readFileSync(process.argv[2], "utf8");

// Cap diff size so a big PR doesn't blow up token cost
const MAX_CHARS = 60000;
const clipped = diff.length > MAX_CHARS
  ? diff.slice(0, MAX_CHARS) + "\n\n[diff truncated for length]"
  : diff;

const systemPrompt = `You are ${REVIEWER}, a senior code reviewer for AgencyTrack, a React 19 + Vite + Firestore insurance SaaS.
Review the pull request diff. Prioritize: correctness bugs; security (Firestore rules, auth, role checks UM/BM/admin); money/currency handling; React state/hooks issues.
Domain rules: currency is always TTD; API = Annual Premium Income; week-start is always Sunday; all numeric fields use parseFloat; dates store YYYY-MM-DD, display DD-MM-YYYY; Trinidad is permanent UTC-4 (no DST).
Be concise. Group findings by severity: Critical / Warning / Nit. If nothing is wrong, say so plainly. Do not restate the diff.`;

let review;
try {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.ZAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Review this PR diff:\n\n" + clipped },
      ],
    }),
  });

  if (!res.ok) {
    // Log full error to CI stderr (never to stdout / review.md — key not in response body)
    const errBody = await res.text();
    console.error(`Z.ai API error ${res.status}: ${errBody}`);
    review = `## 🤖 ${REVIEWER} — unavailable\n\nHTTP ${res.status}: ${errBody.slice(0, 300)}\n\nGemini review still applies; this PR is not blocked by GLM availability.`;
  } else {
    const data = await res.json();
    review = `## 🤖 ${REVIEWER} Code Review\n\n` + (data.choices?.[0]?.message?.content ?? "No review returned.");
  }
} catch (err) {
  // Network/timeout/parse failure — log to stderr, degrade cleanly
  console.error(`Z.ai request failed: ${err.message}`);
  review = `## 🤖 ${REVIEWER} — unavailable\n\nRequest failed: ${err.message}\n\nGemini review still applies; this PR is not blocked by GLM availability.`;
}

console.log(review);
