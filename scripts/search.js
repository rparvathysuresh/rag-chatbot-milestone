/**
 * Vector Search Tester
 *
 * Loads the local JSON vector store and performs pure JS cosine similarity
 * search to verify embeddings and retrieval logic.
 *
 * Usage: node scripts/search.js
 *
 * @see docs/implementationPlan.md - Phase 2C
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@xenova/transformers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const VECTOR_STORE_PATH = join(PROJECT_ROOT, "data", "processed", "vector_store.json");

// Query prefix required by BGE models
const BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

/**
 * Computes cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runTests() {
  console.log("🔍 Vector Search Tester");
  console.log("=".repeat(50));

  // Load vector store
  let vectorStore;
  try {
    vectorStore = JSON.parse(readFileSync(VECTOR_STORE_PATH, "utf8"));
  } catch (err) {
    console.error("❌ Failed to load vector_store.json. Did you run embed.js?");
    process.exit(1);
  }

  const chunks = vectorStore.chunks;
  console.log(`Loaded ${chunks.length} chunks from vector store.`);

  // Load embedding model
  console.log("Loading embedding model...");
  const extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5");
  console.log("Model loaded.\n");

  const testQueries = [
    {
      query: "expense ratio HDFC Large Cap",
      expected: "HDFC Large Cap Fund",
    },
    {
      query: "top holdings HDFC Mid Cap Fund",
      expected: "HDFC Mid-Cap Fund",
    },
    {
      query: "minimum SIP amount for gold fund",
      expected: "HDFC Gold ETF FoF",
    },
    {
      query: "who manages HDFC Small Cap Fund",
      expected: "HDFC Small Cap Fund",
    },
    {
      query: "3 year return HDFC Silver ETF",
      expected: "HDFC Silver ETF FoF",
    }
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    console.log(`Test ${i + 1}: "${test.query}"`);
    
    // 1. Embed the query with prefix
    const prefixedQuery = `${BGE_QUERY_PREFIX}${test.query}`;
    const output = await extractor(prefixedQuery, { pooling: "mean", normalize: true });
    const queryVector = Array.from(output.data);

    // 2. Compute similarity against all chunks
    const results = chunks.map(chunk => {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      return { ...chunk, score };
    });

    // 3. Sort by descending similarity
    results.sort((a, b) => b.score - a.score);
    
    // 4. Output Top 3
    const topResult = results[0];
    const isMatch = topResult.scheme_name === test.expected;
    
    console.log(`  Top match: [${topResult.score.toFixed(3)}] ${topResult.scheme_name} - ${topResult.section}`);
    
    if (isMatch) {
      console.log(`  ✅ Passed (Expected: ${test.expected})`);
    } else {
      console.log(`  ❌ Failed (Expected: ${test.expected})`);
      console.log(`  Top 3 results were:`);
      results.slice(0, 3).forEach(r => console.log(`    - [${r.score.toFixed(3)}] ${r.scheme_name} - ${r.section}`));
    }
    console.log();
  }
}

runTests().catch(console.error);
