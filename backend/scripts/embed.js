/**
 * Embedding Generator
 *
 * Generates vector embeddings for text chunks using
 * BGE BAAI/bge-small-en-v1.5 model via @xenova/transformers.
 * Saves the output to a local JSON vector store.
 *
 * Usage: node scripts/embed.js
 *
 * @see docs/implementationPlan.md - Phase 2C
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@xenova/transformers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const CHUNKS_PATH = join(PROJECT_ROOT, "data", "processed", "chunks.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "data", "processed", "vector_store.json");

// Document prefix required by BGE models
const BGE_DOC_PREFIX = "Represent this sentence: ";

async function generateEmbeddings() {
  console.log("🧠 Embedding Generator");
  console.log("=".repeat(50));

  // Load chunks
  const chunksData = readFileSync(CHUNKS_PATH, "utf8");
  const chunks = JSON.parse(chunksData);
  
  if (chunks.length === 0) {
    console.log("❌ No chunks found in chunks.json");
    return;
  }

  console.log(`Loaded ${chunks.length} chunks from chunks.json`);
  console.log("Initializing BAAI/bge-small-en-v1.5 model (may take a moment to download)...");

  // Load the feature extraction pipeline
  // BGE requires pooling="mean" and normalize=true for cosine similarity
  const extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5");
  
  console.log("Model loaded successfully. Generating embeddings...");
  
  const vectorStore = {
    metadata: {
      model: "Xenova/bge-small-en-v1.5",
      dimensions: 384,
      generated_at: new Date().toISOString(),
      chunk_count: chunks.length
    },
    chunks: []
  };

  let count = 0;
  for (const chunk of chunks) {
    count++;
    process.stdout.write(`Embedding chunk ${count}/${chunks.length} (${chunk.chunk_id})...\r`);
    
    // BGE models require a prefix for optimal performance
    const textToEmbed = `${BGE_DOC_PREFIX}${chunk.text}`;
    
    // Generate embedding
    const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });
    
    // Output is a tensor, we need to convert it to a standard JS array
    // output.data is a Float32Array containing the 384-dim vector
    const embedding = Array.from(output.data);
    
    vectorStore.chunks.push({
      ...chunk,
      embedding
    });
  }
  
  console.log(`\n\n✅ Generated embeddings for ${chunks.length} chunks.`);
  
  // Save to vector store
  writeFileSync(OUTPUT_PATH, JSON.stringify(vectorStore, null, 2), "utf8");
  
  console.log(`📋 Saved vector store to: data/processed/vector_store.json`);
  console.log("=".repeat(50));
}

generateEmbeddings().catch(console.error);
