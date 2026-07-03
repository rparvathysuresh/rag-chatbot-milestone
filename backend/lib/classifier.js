import Groq from "groq-sdk";

// Tier 1: Fast regex for obvious advisory/comparative keywords
const ADVISORY_PATTERNS = [
  /should\s+i\s+(invest|buy|sell)/i,
  /which\s+(fund|scheme)\s+is\s+better/i,
  /recommend/i,
  /compare.*return/i,
  /will.*go\s+up/i,
  /predict/i,
  /good\s+time\s+to\s+invest/i,
];

// Pre-defined polite refusal templates
export const REFUSAL_TEMPLATES = {
  ADVISORY: "I am a facts-only assistant and cannot provide investment advice, recommendations, or future predictions. Please consult a registered financial advisor.",
  OFF_TOPIC: "I can only answer factual questions about the specific HDFC Mutual Fund schemes on Groww that I have been trained on.",
};

const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
const groq = apiKey ? new Groq({ apiKey }) : null;
const CLASSIFIER_MODEL = "llama-3.1-8b-instant"; // Fast model for simple classification

/**
 * Classifies a user query into FACTUAL, ADVISORY, or OFF_TOPIC.
 * Uses a two-tier approach: Regex first, then LLM fallback for ambiguity.
 * 
 * @param {string} query - The user's query
 * @returns {Promise<{type: "FACTUAL"|"ADVISORY"|"OFF_TOPIC", reason: string, refusal?: string}>}
 */
export async function classifyQuery(query) {
  // Tier 1: Regex Check
  for (const pattern of ADVISORY_PATTERNS) {
    if (pattern.test(query)) {
      return { 
        type: "ADVISORY", 
        reason: "Matched Tier 1 Regex", 
        refusal: REFUSAL_TEMPLATES.ADVISORY 
      };
    }
  }

  // If no API key, skip Tier 2 and assume factual
  if (!groq) {
    console.warn("Groq API key not found, skipping Tier 2 classification.");
    return { type: "FACTUAL", reason: "Assumed (No API Key)" };
  }

  // Tier 2: LLM Fallback Check
  const systemPrompt = `You are a query classifier for an HDFC Mutual Fund factual assistant.
Classify the user's query into exactly one of three categories:
1. FACTUAL: Asking for factual data (expense ratio, minimum SIP, fund manager, holdings, historical returns) about HDFC mutual funds.
2. ADVISORY: Asking for recommendations, predictions, advice, or comparisons ("should I buy", "which is better").
3. OFF_TOPIC: Asking about anything else (weather, non-HDFC funds, general chit-chat).

Output strictly a JSON object with this format:
{"category": "FACTUAL|ADVISORY|OFF_TOPIC"}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      model: CLASSIFIER_MODEL,
      temperature: 0, // Deterministic
      max_tokens: 20, // We only need a tiny JSON object
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const category = result.category;
      
      if (category === "ADVISORY") return { type: "ADVISORY", reason: "Tier 2 LLM", refusal: REFUSAL_TEMPLATES.ADVISORY };
      if (category === "OFF_TOPIC") return { type: "OFF_TOPIC", reason: "Tier 2 LLM", refusal: REFUSAL_TEMPLATES.OFF_TOPIC };
      return { type: "FACTUAL", reason: "Tier 2 LLM" };
    }
    
    // Default to FACTUAL if parsing fails
    return { type: "FACTUAL", reason: "Fallback (Parse Error)" };
    
  } catch (error) {
    console.warn("Tier 2 LLM Classification failed:", error.message);
    // If the classifier fails (e.g. rate limit), fail open to allow the user to get a factual answer,
    // assuming Tier 1 caught the obvious bad stuff.
    return { type: "FACTUAL", reason: "Fallback (API Error)" };
  }
}
