import { readFileSync } from "fs";
import { join } from "path";

// Note: In Next.js App Router, process.cwd() is the root of the project
const VECTOR_STORE_PATH = join(process.cwd(), "data", "processed", "vector_store.json");

// Cache the vector store in memory
let vectorStoreCache = null;

function loadVectorStore() {
  if (!vectorStoreCache) {
    try {
      const data = readFileSync(VECTOR_STORE_PATH, "utf8");
      vectorStoreCache = JSON.parse(data);
    } catch (error) {
      console.error("Failed to load vector_store.json", error);
      throw new Error("Vector store not found. Ensure 'npm run embed' has been executed.");
    }
  }
  return vectorStoreCache;
}

/**
 * Computes cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  // Assuming vectors are the same length (384)
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches the local JSON vector store for chunks similar to the query vector.
 * 
 * @param {number[]} queryVector - 384-dimensional query embedding
 * @param {number} topK - Number of top results to return (default: 3)
 * @param {object} filters - Optional metadata filters (e.g., { scheme_name: "HDFC Small Cap Fund" })
 * @returns {Array} - Array of chunk objects sorted by similarity
 */
export function searchSimilar(queryVector, topK = 3, filters = {}) {
  const store = loadVectorStore();
  let candidateChunks = store.chunks;

  // Apply metadata filters if provided
  if (filters.scheme_name) {
    candidateChunks = candidateChunks.filter(
      chunk => chunk.scheme_name.toLowerCase().includes(filters.scheme_name.toLowerCase())
    );
  }

  // Calculate similarity scores
  const scoredChunks = candidateChunks.map(chunk => {
    const score = cosineSimilarity(queryVector, chunk.embedding);
    return {
      chunk_id: chunk.chunk_id,
      scheme_name: chunk.scheme_name,
      source_url: chunk.source_url,
      section: chunk.section,
      last_scraped: chunk.last_scraped,
      text: chunk.text,
      score: score
    };
  });

  // Sort by descending score
  scoredChunks.sort((a, b) => b.score - a.score);

  // Apply similarity threshold (e.g., discard scores < 0.70)
  // For highly relevant retrieval, 0.70 is a good baseline for BGE models
  const filteredChunks = scoredChunks.filter(chunk => chunk.score >= 0.70);

  // Return top K
  return filteredChunks.slice(0, topK);
}
