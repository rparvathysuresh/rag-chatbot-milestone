import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const METADATA_PATH = join(PROJECT_ROOT, 'data', 'metadata.json');

function runCommand(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
}

function getMetadataHashes() {
  if (!existsSync(METADATA_PATH)) return {};
  try {
    const data = JSON.parse(readFileSync(METADATA_PATH, 'utf8'));
    const hashes = {};
    for (const entry of data) {
      if (entry.slug && entry.content_hash) {
        hashes[entry.slug] = entry.content_hash;
      }
    }
    return hashes;
  } catch (e) {
    console.error('Error reading metadata.json:', e.message);
    return {};
  }
}

async function ingestAll() {
  console.log('🚀 Starting Data Ingestion Pipeline (Scheduler)');
  
  // 1. Capture old hashes
  const oldHashes = getMetadataHashes();
  
  // 2. Run Scraper
  runCommand('npm run scrape');
  
  // 3. Capture new hashes
  const newHashes = getMetadataHashes();
  
  // 4. Compare hashes
  let changed = false;
  let changedSchemes = [];
  
  for (const slug of Object.keys(newHashes)) {
    if (newHashes[slug] !== oldHashes[slug]) {
      changed = true;
      changedSchemes.push(slug);
    }
  }
  
  if (!changed && Object.keys(oldHashes).length > 0 && Object.keys(newHashes).length > 0) {
    console.log('\n✅ No data changes detected across any schemes. Skipping chunking and embedding to save resources.');
    process.exit(0);
  }
  
  console.log(`\n⚠️ Detected data changes in: ${changedSchemes.join(', ') || 'All/New'}. Proceeding to Chunking and Embedding...`);
  
  // 5. Run Chunker
  runCommand('npm run chunk');
  
  // 6. Run Embedder
  runCommand('npm run embed');
  
  console.log('\n🎉 Pipeline completed successfully!');
}

ingestAll().catch(e => {
  console.error('\n❌ Fatal Pipeline Error:', e);
  process.exit(1);
});
