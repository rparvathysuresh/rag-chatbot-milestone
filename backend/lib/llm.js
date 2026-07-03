import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "./promptBuilder.js";

// Initialize Groq client
const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
const groq = apiKey ? new Groq({ apiKey }) : new Groq();

if (!apiKey) {
  console.warn("WARNING: GROQ_API_KEY is not set in environment variables");
}


const MODEL = "llama-3.3-70b-versatile";
const MAX_RETRIES = 3;

/**
 * Utility to wait for a specified number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calls the Groq API with exponential backoff for rate limits (429 errors).
 * Handles the strict limits of llama-3.3-70b-versatile (30 RPM, 12K TPM).
 */
async function callGroqWithRetry(messages, retryCount = 0) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: MODEL,
      temperature: 0.1, // Highly deterministic for factual retrieval
      max_tokens: 300,  // Keep responses concise
      top_p: 0.9,
    });
    
    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    // Check if it's a 429 Too Many Requests error
    if (error.status === 429 && retryCount < MAX_RETRIES) {
      // Exponential backoff: Wait (retryCount + 1) * 2 seconds
      const waitSeconds = (retryCount + 1) * 2;
      console.warn(`[Groq Rate Limit] 429 Too Many Requests. Retrying in ${waitSeconds}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await sleep(waitSeconds * 1000);
      return callGroqWithRetry(messages, retryCount + 1);
    }
    
    // For other errors or if we exceeded max retries, throw
    console.error("Groq API Error:", error.message);
    throw error;
  }
}

/**
 * Generates a response using the LLM and parses the answer and citation.
 * 
 * @param {string} prompt - The augmented prompt containing context and query
 * @returns {Promise<Object>} - { answer, source_url, last_updated }
 */
export async function generateResponse(prompt) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ];

  const rawResponse = await callGroqWithRetry(messages);
  
  // Parse the response
  // We expect the LLM to output the answer followed by a JSON block
  
  let answer = rawResponse;
  let source_url = null;
  let last_updated = null;

  try {
    // Look for a JSON block at the end of the text
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsedJson = JSON.parse(jsonStr);
      
      source_url = parsedJson.source_url || null;
      last_updated = parsedJson.last_updated || null;
      
      // The answer is everything before the JSON block
      answer = rawResponse.replace(jsonStr, "").trim();
    }
  } catch (parseError) {
    console.warn("Failed to parse JSON citation from LLM response:", parseError.message);
    // Fallback: just return the raw text if JSON parsing fails
    answer = rawResponse.trim();
  }

  // Handle the specific "unknown" case from the system prompt
  if (answer.includes("I'm sorry, I don't have that information")) {
    source_url = null;
    last_updated = null;
  }

  return {
    answer,
    source_url,
    last_updated
  };
}
