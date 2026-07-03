/**
 * View Embeddings Script
 *
 * A simple utility to inspect the chunks and their generated embeddings
 * stored in the local vector_store.json file.
 *
 * Usage: node scripts/view_embeddings.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const VECTOR_STORE_PATH = join(PROJECT_ROOT, "data", "processed", "vector_store.json");

function viewEmbeddings() {
  console.log("👁️  Vector Store Viewer");
  console.log("=".repeat(50));

  let vectorStore;
  try {
    vectorStore = JSON.parse(readFileSync(VECTOR_STORE_PATH, "utf8"));
  } catch (err) {
    console.error("❌ Failed to load vector_store.json. Ensure you have run 'npm run embed' first.");
    process.exit(1);
  }

  // Print Metadata
  console.log("Metadata:");
  console.log(JSON.stringify(vectorStore.metadata, null, 2));
  console.log("\n" + "=".repeat(50) + "\n");

  const chunks = vectorStore.chunks;

  // Print each chunk with an embedding preview
  chunks.forEach((chunk, index) => {
    console.log(`[${index + 1}/${chunks.length}] ID: ${chunk.chunk_id}`);
    console.log(`Scheme: ${chunk.scheme_name}`);
    console.log(`Section: ${chunk.section}`);
    
    // Preview the embedding (show first 3 and last 3 elements)
    const vec = chunk.embedding;
    const vecPreview = `[${vec[0].toFixed(4)}, ${vec[1].toFixed(4)}, ${vec[2].toFixed(4)}, ..., ${vec[vec.length-3].toFixed(4)}, ${vec[vec.length-2].toFixed(4)}, ${vec[vec.length-1].toFixed(4)}]`;
    
    console.log(`Embedding (${vec.length} dimensions): ${vecPreview}`);
    console.log("-".repeat(50));
  });

  console.log(`✅ Displayed ${chunks.length} embeddings.`);
}

viewEmbeddings();
