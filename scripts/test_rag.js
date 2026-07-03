/**
 * E2E RAG Pipeline Test Script
 * 
 * Simulates an end-to-end API request by combining the four core modules:
 * 1. Embed query
 * 2. Search vector store
 * 3. Build prompt
 * 4. Generate LLM response
 *
 * Usage: node scripts/test_rag.js "What is the expense ratio for HDFC Large Cap?"
 */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

// Load environment variables from .env and .env.local
config({ path: join(PROJECT_ROOT, ".env") });
config({ path: join(PROJECT_ROOT, ".env.local") });

async function runPipeline(userQuery) {
  // Dynamically import library modules AFTER dotenv has populated process.env
  // This prevents the Groq SDK from initializing with a missing API key due to ESM hoisting.
  const { embedQuery } = await import("../src/lib/embeddings.js");
  const { searchSimilar } = await import("../src/lib/vectorStore.js");
  const { buildPrompt } = await import("../src/lib/promptBuilder.js");
  const { generateResponse } = await import("../src/lib/llm.js");
  console.log(`\n🔍 QUERY: "${userQuery}"`);
  console.log("-".repeat(50));

  try {
    // 1. Embed Query
    console.log("1. Generating query embedding...");
    const queryVector = await embedQuery(userQuery);

    // 2. Retrieve relevant chunks
    console.log("2. Searching vector store...");
    const chunks = searchSimilar(queryVector, 3);
    
    if (chunks.length === 0) {
      console.log("No relevant chunks found. Score threshold might be too high.");
      return;
    }
    
    console.log(`   Found ${chunks.length} chunks.`);
    chunks.forEach((c, i) => console.log(`   - Chunk ${i+1}: [${c.score.toFixed(3)}] ${c.scheme_name} - ${c.section}`));

    // 3. Build Prompt
    console.log("\n3. Building augmented prompt...");
    const prompt = buildPrompt(chunks, userQuery);

    // 4. Generate Response
    console.log("4. Calling LLM (llama-3.3-70b-versatile)...\n");
    const response = await generateResponse(prompt);

    console.log("=".repeat(50));
    console.log("🤖 FINAL ANSWER:\n");
    console.log(response.answer);
    console.log("\n📚 CITATION:");
    if (response.source_url) {
      console.log(`URL: ${response.source_url}`);
      console.log(`Last Updated: ${response.last_updated}`);
    } else {
      console.log("No citation provided (unknown info).");
    }
    console.log("=".repeat(50));

  } catch (error) {
    console.error("Pipeline Error:", error);
  }
}

// Accept query from CLI or use a default
const query = process.argv[2] || "What is the expense ratio of HDFC Large Cap Fund?";
runPipeline(query);
