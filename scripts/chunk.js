/**
 * Section-Aware Text Chunker for Groww Mutual Fund Data
 *
 * Two-pass chunking strategy:
 *   Pass 1: Clean & deduplicate noisy scraper output
 *   Pass 2: Section-aware splitting with merge/split logic
 *
 * Usage: node scripts/chunk.js
 *
 * @see docs/implementationPlan.md - Phase 2B
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const PROCESSED_DIR = join(PROJECT_ROOT, "data", "processed");
const METADATA_PATH = join(PROJECT_ROOT, "data", "metadata.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "data", "processed", "chunks.json");

// Chunking thresholds (in characters — ~4 chars per token)
const MIN_CHUNK_CHARS = 150 * 4; // ~150 tokens → merge if smaller
const MAX_CHUNK_CHARS = 800 * 4; // ~800 tokens → split if larger
const SPLIT_CHUNK_SIZE = 600 * 4; // ~600 tokens for sub-splitting
const SPLIT_OVERLAP = 100 * 4; // ~100 tokens overlap

// Section delimiter pattern
const SECTION_DELIMITER = /^---\s+(.+?)\s+---$/;

// ---------------------------------------------------------------------------
// Pass 1: Clean & Deduplicate
// ---------------------------------------------------------------------------

/**
 * Noise patterns to remove from the scraped text.
 * These are artifacts of the heading-based extraction in scrape.js.
 */
function isNoisyLine(line, previousLines) {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // 1. Concatenated SIP/return calculator text (no spaces between values)
  if (/Monthly SIP.*One time.*Monthly investment/i.test(trimmed)) return true;
  if (/^Monthly SIPOne time$/i.test(trimmed)) return true;
  if (/^Monthly investment₹[\d,]+$/i.test(trimmed)) return true;
  if (/^Monthly investment$/i.test(trimmed)) return true;

  // 2. Concatenated holdings blob (no pipe separators, >200 chars, has % symbols)
  if (
    trimmed.length > 200 &&
    !trimmed.includes(" | ") &&
    (trimmed.match(/%/g) || []).length > 5
  ) {
    return true;
  }

  // 3. Concatenated compare/peer data (no pipe separators, has fund names + percentages)
  if (
    trimmed.length > 150 &&
    !trimmed.includes(" | ") &&
    /Fund.*Growth.*[+-]?\d+\.\d+%/.test(trimmed) &&
    !SECTION_DELIMITER.test(trimmed)
  ) {
    return true;
  }

  // 4. Concatenated fund management text (initials + name + date + "View details")
  if (/^[A-Z]{2}[A-Z][a-z].*View details/i.test(trimmed) && trimmed.length > 100) {
    return true;
  }

  // 5. Concatenated minimum investment text
  if (/^Min\. for.*₹\d+Min\. for/i.test(trimmed)) return true;

  // 6. Concatenated term definitions
  if (/^Annualised returns.*Absolute returns/i.test(trimmed) && trimmed.length > 100) {
    return true;
  }

  // 7. Short fragments that are substrings of previously seen lines
  if (trimmed.length < 80 && trimmed.length > 3) {
    for (const prev of previousLines) {
      if (prev.length > trimmed.length && prev.includes(trimmed)) {
        return true;
      }
    }
  }

  // 8. Bare "View details" or "See All" or "Compare" fragments
  if (/^(View details|See All|Compare)$/i.test(trimmed)) return true;

  // 9. Section headers that are just concatenated initials+names (spurious headings)
  if (SECTION_DELIMITER.test(trimmed)) {
    const sectionName = trimmed.match(SECTION_DELIMITER)[1];
    // Legitimate section names we want to keep
    const legitimateSections = [
      "Fund Details",
      "Return Calculator",
      "Portfolio Holdings",
      "Holdings",
      "Minimum investments",
      "Understand terms",
      "Compare similar funds",
      "Fund management",
      "Additional Data",
    ];
    // Check if it's a legitimate section
    const isLegitimate = legitimateSections.some(
      (s) => sectionName.toLowerCase().includes(s.toLowerCase())
    );
    if (!isLegitimate) return true; // Remove spurious heading sections
  }

  return false;
}

/**
 * Clean and deduplicate the raw scraped text.
 * Returns { header, cleanedLines, schemePrefix }
 */
function cleanText(rawText) {
  const lines = rawText.split("\n");

  // Extract metadata header (first 4 lines: Source, Scheme, Scraped, ===)
  const header = {};
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith("Source:")) header.source_url = line.replace("Source:", "").trim();
    if (line.startsWith("Scheme:")) header.scheme_name = line.replace("Scheme:", "").trim();
    if (line.startsWith("Scraped:")) header.last_scraped = line.replace("Scraped:", "").trim();
  }

  // Find the scheme name and category from the body
  let schemeName = "";
  let category = "";
  for (const line of lines) {
    if (line.startsWith("Scheme Name:")) {
      schemeName = line.replace("Scheme Name:", "").trim();
    }
    if (line.startsWith("Category:")) {
      // Extract only the meaningful parts (skip "Annualised returns" / "Absolute returns")
      const parts = line
        .replace("Category:", "")
        .trim()
        .split("|")
        .map((p) => p.trim())
        .filter(
          (p) =>
            p &&
            !p.toLowerCase().includes("annualised") &&
            !p.toLowerCase().includes("absolute")
        );
      category = parts.join(" | ");
    }
  }

  const schemePrefix = schemeName
    ? `${schemeName}${category ? ` (${category})` : ""}`
    : header.scheme_name || "";

  // Skip the header lines (Source, Scheme, Scraped, ===, blank) and body header lines
  const bodyStartIdx = lines.findIndex((l) => l.startsWith("===")) + 1;
  const bodyLines = lines.slice(bodyStartIdx);

  // Filter out noisy lines
  const previousCleanLines = [];
  const cleanedLines = [];
  for (const line of bodyLines) {
    if (!isNoisyLine(line, previousCleanLines)) {
      cleanedLines.push(line);
      previousCleanLines.push(line.trim());
    }
  }

  return { header, cleanedLines, schemePrefix };
}

// ---------------------------------------------------------------------------
// Pass 2: Section-Aware Splitting
// ---------------------------------------------------------------------------

/**
 * Split cleaned lines into sections based on `--- Section Name ---` delimiters.
 * Returns array of { name, lines[] }
 */
function splitIntoSections(cleanedLines) {
  const sections = [];
  let currentSection = { name: "Overview", lines: [] };

  for (const line of cleanedLines) {
    const match = line.match(SECTION_DELIMITER);
    if (match) {
      // Save current section if it has content
      if (currentSection.lines.some((l) => l.trim())) {
        sections.push(currentSection);
      }
      currentSection = { name: match[1].trim(), lines: [] };
    } else {
      currentSection.lines.push(line);
    }
  }

  // Save last section
  if (currentSection.lines.some((l) => l.trim())) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Estimate token count from text (rough: ~4 chars per token for English).
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Split text at line boundaries, respecting max size.
 * Returns array of text chunks.
 */
function splitOversizedText(text, maxChars, overlapChars) {
  const lines = text.split("\n").filter((l) => l.trim());
  const chunks = [];
  let currentChunk = [];
  let currentLen = 0;

  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for newline
    if (currentLen + lineLen > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));

      // Keep overlap: take last few lines that fit within overlapChars
      const overlapLines = [];
      let overlapLen = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const oLen = currentChunk[i].length + 1;
        if (overlapLen + oLen > overlapChars) break;
        overlapLines.unshift(currentChunk[i]);
        overlapLen += oLen;
      }

      currentChunk = [...overlapLines, line];
      currentLen = overlapLen + lineLen;
    } else {
      currentChunk.push(line);
      currentLen += lineLen;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks;
}

/**
 * Process sections into chunks: merge small ones, split large ones.
 * Returns array of { text, section }
 */
function sectionsToChunks(sections, schemePrefix) {
  const chunks = [];
  let mergeBuffer = { names: [], lines: [] };

  function flushMergeBuffer() {
    if (mergeBuffer.lines.length === 0) return;
    const text = mergeBuffer.lines.filter((l) => l.trim()).join("\n");
    if (text.trim()) {
      chunks.push({
        text: `${schemePrefix}\n\n${text}`,
        section: mergeBuffer.names.join(" + "),
      });
    }
    mergeBuffer = { names: [], lines: [] };
  }

  for (const section of sections) {
    const sectionText = section.lines.filter((l) => l.trim()).join("\n");
    const sectionChars = sectionText.length;

    if (sectionChars === 0) continue;

    if (sectionChars < MIN_CHUNK_CHARS) {
      // Small section → add to merge buffer
      mergeBuffer.names.push(section.name);
      mergeBuffer.lines.push(...section.lines);

      // Flush if merge buffer is big enough
      const bufferText = mergeBuffer.lines.filter((l) => l.trim()).join("\n");
      if (bufferText.length >= MIN_CHUNK_CHARS) {
        flushMergeBuffer();
      }
    } else if (sectionChars > MAX_CHUNK_CHARS) {
      // Flush any pending merge buffer first
      flushMergeBuffer();

      // Split oversized section
      const subChunks = splitOversizedText(sectionText, SPLIT_CHUNK_SIZE, SPLIT_OVERLAP);
      subChunks.forEach((subText, idx) => {
        chunks.push({
          text: `${schemePrefix}\n\n--- ${section.name} ---\n${subText}`,
          section: subChunks.length > 1 ? `${section.name} (Part ${idx + 1})` : section.name,
        });
      });
    } else {
      // Normal-sized section → flush merge buffer, then add as its own chunk
      flushMergeBuffer();
      chunks.push({
        text: `${schemePrefix}\n\n--- ${section.name} ---\n${sectionText}`,
        section: section.name,
      });
    }
  }

  // Flush any remaining merge buffer
  flushMergeBuffer();

  return chunks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function chunkAll() {
  console.log("📦 Section-Aware Text Chunker");
  console.log("=".repeat(50));

  // Load metadata
  const metadata = JSON.parse(readFileSync(METADATA_PATH, "utf8"));

  // Find all .txt files in processed directory (exclude chunks.json)
  const txtFiles = readdirSync(PROCESSED_DIR).filter(
    (f) => f.endsWith(".txt") && !f.startsWith("chunks")
  );

  console.log(`Found ${txtFiles.length} processed text files\n`);

  const allChunks = [];
  let totalChunkCount = 0;

  for (const file of txtFiles) {
    const slug = file.replace(".txt", "");
    const filePath = join(PROCESSED_DIR, file);
    const rawText = readFileSync(filePath, "utf8");

    // Look up metadata for this file
    const meta = metadata.find((m) => m.slug === slug) || {};

    console.log(`[${slug}]`);

    // Pass 1: Clean & Deduplicate
    const { header, cleanedLines, schemePrefix } = cleanText(rawText);
    const cleanLineCount = cleanedLines.filter((l) => l.trim()).length;
    const originalLineCount = rawText.split("\n").filter((l) => l.trim()).length;
    console.log(
      `  Pass 1: ${originalLineCount} lines → ${cleanLineCount} clean lines (removed ${originalLineCount - cleanLineCount} noisy lines)`
    );

    // Pass 2: Section-Aware Splitting
    const sections = splitIntoSections(cleanedLines);
    console.log(`  Pass 2: ${sections.length} sections detected: [${sections.map((s) => s.name).join(", ")}]`);

    const chunks = sectionsToChunks(sections, schemePrefix);
    console.log(`  Result: ${chunks.length} chunks`);

    // Build final chunk objects with metadata
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${slug}__${chunk.section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

      allChunks.push({
        chunk_id: chunkId,
        chunk_index: totalChunkCount + i,
        scheme_name: meta.scheme_name || header.scheme_name || slug,
        source_url: meta.source_url || header.source_url || "",
        section: chunk.section,
        last_scraped: meta.last_scraped || header.last_scraped || "",
        text: chunk.text,
        char_count: chunk.text.length,
        estimated_tokens: estimateTokens(chunk.text),
      });
    }

    // Print chunk details
    chunks.forEach((c, i) => {
      const tokens = estimateTokens(c.text);
      console.log(`    Chunk ${i + 1}: "${c.section}" (${tokens} tokens)`);
    });

    totalChunkCount += chunks.length;
    console.log();
  }

  // Save all chunks
  writeFileSync(OUTPUT_PATH, JSON.stringify(allChunks, null, 2), "utf8");

  // Summary
  console.log("=".repeat(50));
  console.log(`✅ Total chunks: ${allChunks.length}`);
  console.log(`📋 Saved to: data/processed/chunks.json`);

  // Token stats
  const tokenCounts = allChunks.map((c) => c.estimated_tokens);
  console.log(
    `📊 Token range: ${Math.min(...tokenCounts)}–${Math.max(...tokenCounts)} (avg: ${Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length)})`
  );
  console.log("=".repeat(50));
}

chunkAll();
