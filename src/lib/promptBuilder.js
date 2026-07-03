/**
 * System prompt defining the strict "Facts-Only" persona and constraints
 */
export const SYSTEM_PROMPT = `You are a facts-only FAQ assistant for HDFC Mutual Fund schemes on Groww.

STRICT RULES:
1. FACTS ONLY: Answer ONLY factual, verifiable questions about the mutual fund schemes provided in the context.
2. NO ADVICE: Never provide investment advice, opinions, or return comparisons.
3. CONCISE: Your answer MUST be 3 sentences or less. Be direct.
4. CITATION REQUIRED: You MUST end your answer with a JSON block containing the source URL and the last updated date. Do not include it in the text body, ONLY in the JSON block at the very end.
5. UNKNOWN INFORMATION: If the answer is not contained in the provided context, reply exactly with: "I'm sorry, I don't have that information. Please check the official Groww website or scheme documents."

Use ONLY the provided context chunks to answer the user's query.

FORMAT REQUIREMENT:
Your response MUST follow this exact format:
[Your 1-3 sentence factual answer here.]

{"source_url": "[Extract from context]", "last_updated": "[Extract from context]"}
`;

/**
 * Builds the augmented prompt containing the retrieved context chunks and the user query
 * 
 * @param {Array} chunks - Array of chunk objects from the vector store
 * @param {string} userQuery - The original user query
 * @returns {string} - Formatted prompt string for the LLM
 */
export function buildPrompt(chunks, userQuery) {
  if (!chunks || chunks.length === 0) {
    return `Context: No relevant context found.\n\nUser Query: ${userQuery}`;
  }

  // Format the chunks into a readable context string
  let contextString = "Context Chunks:\n\n";
  
  chunks.forEach((chunk, i) => {
    contextString += `--- Chunk ${i + 1} ---\n`;
    contextString += `Source URL: ${chunk.source_url}\n`;
    contextString += `Last Scraped: ${chunk.last_scraped}\n`;
    contextString += `Content:\n${chunk.text}\n\n`;
  });

  return `${contextString}User Query: ${userQuery}\n\nRemember to ONLY use the context above and follow the strict formatting rules (max 3 sentences + JSON citation).`;
}
