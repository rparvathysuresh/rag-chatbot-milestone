/**
 * Source Verification Guard
 * 
 * Prevents LLM hallucination of source URLs by ensuring the
 * cited URL belongs to our exact scraped allowlist.
 */

const ALLOWED_SOURCES = [
  "https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth",
  "https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth",
  "https://groww.in/mutual-funds/hdfc-small-cap-fund-direct-growth",
  "https://groww.in/mutual-funds/hdfc-gold-etf-fund-of-fund-direct-plan-growth",
  "https://groww.in/mutual-funds/hdfc-silver-etf-fof-direct-growth"
];

/**
 * Validates if the LLM's citation URL is legitimate.
 * 
 * @param {string} url - The URL extracted from the LLM's JSON citation
 * @returns {string|null} - The valid URL, or null if it was hallucinated
 */
export function verifyCitation(url) {
  if (!url) return null;
  
  // Clean up any trailing slashes or spaces the LLM might have added
  const cleanUrl = url.trim().replace(/\/$/, "");

  // Check if it strictly matches our allowlist
  if (ALLOWED_SOURCES.includes(cleanUrl)) {
    return cleanUrl;
  }
  
  console.warn(`[Source Guard] Stripped hallucinated/invalid URL: ${url}`);
  return null;
}
