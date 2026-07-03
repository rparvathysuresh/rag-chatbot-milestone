/**
 * PII Detection & Scrubbing Module
 * 
 * Protects user privacy by stripping out sensitive Indian PII
 * before the query is processed by the RAG backend.
 */

const PII_PATTERNS = [
  { name: "PAN", regex: /[A-Z]{5}[0-9]{4}[A-Z]/gi },
  { name: "Aadhaar", regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { name: "Phone", regex: /(?:\+91|91)?\s?\b\d{10}\b/g },
  { name: "Email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi }
];

export const PII_WARNING_MSG = "\n\n⚠️ Note: Personal information was detected and removed from your query. Please avoid sharing sensitive details.";

/**
 * Scrubs PII from the user query.
 * 
 * @param {string} query - The raw user query
 * @returns {Object} { scrubbedQuery, hasPII }
 */
export function scrubPII(query) {
  let scrubbedQuery = query;
  let hasPII = false;

  for (const { name, regex } of PII_PATTERNS) {
    if (regex.test(scrubbedQuery)) {
      hasPII = true;
      scrubbedQuery = scrubbedQuery.replace(regex, `[REDACTED_${name}]`);
    }
  }

  return {
    scrubbedQuery,
    hasPII
  };
}
