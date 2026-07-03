import { pipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/bge-small-en-v1.5";
const BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

// Singleton pattern to cache the pipeline across API calls
let extractorInstance = null;

async function getExtractor() {
  if (!extractorInstance) {
    // Note: In a real serverless edge environment (like Vercel Edge), 
    // ONNX models can be tricky to load. For this local/Node implementation,
    // this works perfectly.
    extractorInstance = await pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorInstance;
}

/**
 * Generates a 384-dimensional embedding for a given text query.
 * Applies the BGE-required prefix for optimal retrieval.
 * 
 * @param {string} text - The user's query
 * @returns {Promise<number[]>} - 384-dimensional vector
 */
export async function embedQuery(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text provided to embedQuery");
  }

  try {
    const extractor = await getExtractor();
    const prefixedQuery = `${BGE_QUERY_PREFIX}${text.trim()}`;
    
    // BGE requires pooling="mean" and normalize=true for cosine similarity
    const output = await extractor(prefixedQuery, { pooling: "mean", normalize: true });
    
    return Array.from(output.data);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw new Error("Failed to generate embedding for query");
  }
}
