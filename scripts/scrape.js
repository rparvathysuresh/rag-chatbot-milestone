/**
 * Web Scraper for Groww Mutual Fund Pages
 *
 * Scrapes the 5 HDFC Mutual Fund scheme pages from Groww,
 * extracts meaningful text content, and saves raw HTML + cleaned text.
 *
 * Usage: node scripts/scrape.js
 *
 * @see docs/implementationPlan.md - Phase 2, Task 2A
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const SOURCES = [
  {
    scheme: "HDFC Large Cap Fund",
    url: "https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth",
  },
  {
    scheme: "HDFC Mid-Cap Fund",
    url: "https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth",
  },
  {
    scheme: "HDFC Small Cap Fund",
    url: "https://groww.in/mutual-funds/hdfc-small-cap-fund-direct-growth",
  },
  {
    scheme: "HDFC Gold ETF FoF",
    url: "https://groww.in/mutual-funds/hdfc-gold-etf-fund-of-fund-direct-plan-growth",
  },
  {
    scheme: "HDFC Silver ETF FoF",
    url: "https://groww.in/mutual-funds/hdfc-silver-etf-fof-direct-growth",
  },
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

const DELAY_MS = 2000; // Polite delay between requests

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert scheme name to a URL-friendly slug.
 * "HDFC Large Cap Fund" → "hdfc-large-cap-fund"
 */
function toSlug(scheme) {
  return scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Compute SHA-256 hash of content for change detection.
 */
function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Extraction — structured data from the Groww mutual fund page
// ---------------------------------------------------------------------------

/**
 * Extract clean, structured text from Groww mutual fund page HTML.
 *
 * Groww uses SSR with Next.js — the page has real content in the HTML.
 * We target specific CSS class patterns to extract meaningful sections
 * and ignore navigation, ads, footers, and interactive widgets.
 */
function extractCleanText($, schemeName, sourceUrl) {
  const sections = [];

  // ── 1. Scheme Name & Category ──────────────────────────────────────────
  const schemeTitle = $("h1").first().text().trim();
  const pills = [];
  $(".pill12Pill span").each((_, el) => {
    const txt = $(el).text().trim();
    if (txt) pills.push(txt);
  });

  if (schemeTitle) {
    sections.push(`Scheme Name: ${schemeTitle}`);
    if (pills.length) {
      sections.push(`Category: ${pills.join(" | ")}`);
    }
  }

  // ── 2. Return Stats (headline) ─────────────────────────────────────────
  const returnContainer = $('[class*="returnStats_returnStatsContainer"]');
  if (returnContainer.length) {
    const mainReturn = returnContainer
      .find('[class*="returnStats_mainReturnContainer"]')
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const oneDayReturn = returnContainer
      .find('[class*="returnStats_oneDayReturn"]')
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (mainReturn) sections.push(`Returns: ${mainReturn}`);
    if (oneDayReturn) sections.push(`1-Day Return: ${oneDayReturn}`);
  }

  // ── 3. Fund Details (NAV, Min SIP, AUM, Expense Ratio, Rating) ────────
  const fundDetails = $('[class*="fundDetails_fundDetailsContainer"]');
  if (fundDetails.length) {
    const details = [];
    fundDetails.find('[class*="fundDetails_gap4"]').each((_, group) => {
      const label = $(group)
        .find('[class*="contentTertiary"]')
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const value = $(group)
        .find('[class*="contentPrimary"]')
        .last()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (label && value && label !== value) {
        details.push(`${label}: ${value}`);
      }
    });
    if (details.length) {
      sections.push("\n--- Fund Details ---");
      sections.push(...details);
    }
  }

  // ── 4. Return Calculator Table (SIP returns over 1Y/3Y/5Y) ────────────
  const returnCalcTable = $('[class*="returnCalculator_container"]');
  if (returnCalcTable.length) {
    sections.push("\n--- Return Calculator ---");
    returnCalcTable.find("table").each((_, table) => {
      const rows = [];
      $(table)
        .find("thead tr th")
        .each((__, th) => {
          rows.push($(th).text().replace(/\s+/g, " ").trim());
        });
      if (rows.length) sections.push(rows.join(" | "));

      $(table)
        .find("tbody tr")
        .each((__, tr) => {
          const cells = [];
          $(tr)
            .find("td")
            .each((___, td) => {
              const text = $(td).text().replace(/\s+/g, " ").trim();
              if (text) cells.push(text);
            });
          if (cells.length) sections.push(cells.join(" | "));
        });
    });
  }

  // ── 5. Fund Key Information / Features ─────────────────────────────────
  $('[class*="keyFeature"], [class*="fundFeature"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text && text.length > 10) {
      sections.push(text);
    }
  });

  // ── 6. Exit Load, Lock-in, Min Investment, etc. ────────────────────────
  const fundInfo = $('[class*="fundInfo_container"], [class*="aboutFund"]');
  if (fundInfo.length) {
    sections.push("\n--- Fund Information ---");
    fundInfo.find('[class*="infoRow"], [class*="fundInfo_row"]').each((_, row) => {
      const text = $(row).text().replace(/\s+/g, " ").trim();
      if (text && text.length > 5) {
        sections.push(text);
      }
    });
  }

  // ── 7. Holdings / Portfolio section ────────────────────────────────────
  const holdings = $('[class*="holdings"], [class*="portfolio"]');
  if (holdings.length) {
    const holdingsText = [];
    holdings.find("table").each((_, table) => {
      $(table)
        .find("tr")
        .each((__, tr) => {
          const cells = [];
          $(tr)
            .find("td, th")
            .each((___, cell) => {
              cells.push($(cell).text().replace(/\s+/g, " ").trim());
            });
          if (cells.length && cells.some((c) => c.length > 0)) {
            holdingsText.push(cells.join(" | "));
          }
        });
    });
    if (holdingsText.length) {
      sections.push("\n--- Portfolio Holdings ---");
      sections.push(...holdingsText.slice(0, 20)); // Top 20 holdings
    }
  }

  // ── 8. Peer Comparison ─────────────────────────────────────────────────
  const peerSection = $('[class*="peerComparison"], [class*="peerFund"]');
  if (peerSection.length) {
    sections.push("\n--- Peer Comparison ---");
    peerSection.find("table tr").each((_, tr) => {
      const cells = [];
      $(tr)
        .find("td, th")
        .each((__, cell) => {
          cells.push($(cell).text().replace(/\s+/g, " ").trim());
        });
      if (cells.length && cells.some((c) => c.length > 0)) {
        sections.push(cells.join(" | "));
      }
    });
  }

  // ── 9. All <h2>, <h3> headings with their sibling text ────────────────
  //    Captures "About", "Taxation", "Pros & Cons", etc.
  $("h2, h3").each((_, heading) => {
    const headingText = $(heading).text().replace(/\s+/g, " ").trim();
    // Skip generic/nav headings
    if (
      !headingText ||
      headingText.length < 3 ||
      /^(Stocks|F&O|Mutual Funds|More|Invest|Trade)$/i.test(headingText)
    ) {
      return;
    }

    // Gather text from siblings/children until the next heading
    const parent = $(heading).parent();
    const siblingText = parent
      .find("p, li, span, div")
      .map((__, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 15)
      .slice(0, 10); // Max 10 sub-elements

    if (siblingText.length > 0) {
      sections.push(`\n--- ${headingText} ---`);
      siblingText.forEach((t) => {
        // Avoid duplicates
        if (!sections.includes(t)) {
          sections.push(t);
        }
      });
    }
  });

  // ── 10. Structured data from JSON-LD (if available) ────────────────────
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html());
      if (data && data.name) {
        sections.push(`\n--- Schema.org Data ---`);
        if (data.name) sections.push(`Name: ${data.name}`);
        if (data.description) sections.push(`Description: ${data.description}`);
        if (data.url) sections.push(`URL: ${data.url}`);
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  // ── 11. All tables not yet captured (generic fallback) ─────────────────
  const contentContainer = $('[class*="pw14ContentWrapper"], [class*="layout-main"]').first();
  if (contentContainer.length) {
    contentContainer.find("table").each((_, table) => {
      // Skip tables already captured (return calculator)
      if ($(table).closest('[class*="returnCalculator"]').length) return;

      const rows = [];
      $(table)
        .find("tr")
        .each((__, tr) => {
          const cells = [];
          $(tr)
            .find("td, th")
            .each((___, cell) => {
              cells.push($(cell).text().replace(/\s+/g, " ").trim());
            });
          if (cells.length && cells.some((c) => c.length > 0)) {
            rows.push(cells.join(" | "));
          }
        });
      if (rows.length > 1) {
        sections.push("\n--- Additional Data ---");
        sections.push(...rows);
      }
    });
  }

  // ── Assemble final text ────────────────────────────────────────────────
  const header = [
    `Source: ${sourceUrl}`,
    `Scheme: ${schemeName}`,
    `Scraped: ${new Date().toISOString()}`,
    "=".repeat(60),
  ].join("\n");

  // Deduplicate and clean
  const seen = new Set();
  const deduped = sections.filter((line) => {
    const normalized = line.trim().toLowerCase();
    if (!normalized || normalized.length < 3) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return `${header}\n\n${deduped.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Main scraping workflow
// ---------------------------------------------------------------------------

async function scrapeAll() {
  console.log("🕷️  Groww Mutual Fund Scraper");
  console.log("=".repeat(50));
  console.log(`Scraping ${SOURCES.length} scheme pages...\n`);

  // Ensure directories exist
  const rawDir = join(PROJECT_ROOT, "data", "raw");
  const processedDir = join(PROJECT_ROOT, "data", "processed");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(processedDir, { recursive: true });

  const metadata = [];
  const results = { success: 0, failed: 0 };

  for (let i = 0; i < SOURCES.length; i++) {
    const { scheme, url } = SOURCES[i];
    const slug = toSlug(scheme);

    console.log(`[${i + 1}/${SOURCES.length}] Scraping: ${scheme}`);
    console.log(`   URL: ${url}`);

    try {
      // ── Fetch HTML ─────────────────────────────────────────────────────
      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 30000,
        maxRedirects: 5,
      });

      const html = response.data;

      // ── Save raw HTML ──────────────────────────────────────────────────
      const rawPath = join(rawDir, `${slug}.html`);
      writeFileSync(rawPath, html, "utf8");
      console.log(`   ✅ Raw HTML saved (${(html.length / 1024).toFixed(1)} KB)`);

      // ── Parse and extract text ─────────────────────────────────────────
      const $ = cheerio.load(html);

      // Remove unwanted elements before extraction
      $(
        "script, style, noscript, iframe, svg, " +
          '[class*="header2025"], [class*="loggedOut_"], ' +
          '[class*="footer"], [class*="Footer"], ' +
          '[class*="hoverDiv"], [class*="dropdownUI"], ' +
          '[class*="freshchat"], [class*="webengage"], ' +
          '[class*="adSlot"], [class*="stickyBanner"], ' +
          '[class*="loginSignup"], [class*="downloadApp"]'
      ).remove();

      const cleanText = extractCleanText($, scheme, url);

      // ── Save cleaned text ──────────────────────────────────────────────
      const processedPath = join(processedDir, `${slug}.txt`);
      writeFileSync(processedPath, cleanText, "utf8");

      const lineCount = cleanText.split("\n").filter((l) => l.trim()).length;
      console.log(
        `   ✅ Clean text saved (${(cleanText.length / 1024).toFixed(1)} KB, ${lineCount} lines)`
      );

      // ── Build metadata entry ───────────────────────────────────────────
      metadata.push({
        scheme_name: scheme,
        source_url: url,
        slug: slug,
        last_scraped: new Date().toISOString(),
        content_hash: `sha256:${sha256(cleanText)}`,
        raw_size_bytes: html.length,
        clean_size_bytes: cleanText.length,
        clean_line_count: lineCount,
      });

      results.success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.failed++;

      metadata.push({
        scheme_name: scheme,
        source_url: url,
        slug: slug,
        last_scraped: new Date().toISOString(),
        content_hash: null,
        error: error.message,
      });
    }

    // Polite delay between requests
    if (i < SOURCES.length - 1) {
      console.log(`   ⏳ Waiting ${DELAY_MS}ms...\n`);
      await sleep(DELAY_MS);
    }
  }

  // ── Save metadata.json ─────────────────────────────────────────────────
  const metadataPath = join(PROJECT_ROOT, "data", "metadata.json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`\n📋 Metadata saved to data/metadata.json`);

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Success: ${results.success}/${SOURCES.length}`);
  if (results.failed > 0) {
    console.log(`❌ Failed: ${results.failed}/${SOURCES.length}`);
  }
  console.log("=".repeat(50));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

scrapeAll().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
