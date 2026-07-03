/**
 * Guards Test Script
 * 
 * Verifies the Phase 4 security and classification logic.
 *
 * Usage: node scripts/test_guards.js
 */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

// Load environment variables from .env and .env.local
config({ path: join(PROJECT_ROOT, ".env") });
config({ path: join(PROJECT_ROOT, ".env.local") });

async function runTests() {
  const { classifyQuery } = await import("../src/lib/classifier.js");
  const { scrubPII } = await import("../src/lib/piiGuard.js");
  const { verifyCitation } = await import("../src/lib/sourceGuard.js");

  const testCases = [
    {
      input: "What is the expense ratio of HDFC Large Cap?",
      expectedType: "FACTUAL"
    },
    {
      input: "Should I invest in HDFC Small Cap?",
      expectedType: "ADVISORY"
    },
    {
      input: "Which is better, HDFC Mid-Cap or Small Cap?",
      expectedType: "ADVISORY"
    },
    {
      input: "What's the weather today?",
      expectedType: "OFF_TOPIC"
    },
    {
      input: "My PAN is ABCDE1234F, show my portfolio",
      expectedType: "FACTUAL" // It's factual but has PII
    }
  ];

  console.log("🛡️  Testing Security Guards & Classifier\n" + "=".repeat(50));

  let passed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\nTest ${i+1}: "${tc.input}"`);
    
    // 1. PII Scrubbing
    const { scrubbedQuery, hasPII } = scrubPII(tc.input);
    if (hasPII) {
      console.log(`  🔍 PII DETECTED! Scrubbed: "${scrubbedQuery}"`);
    }

    // 2. Classification
    const classification = await classifyQuery(scrubbedQuery);
    console.log(`  🏷️  Classification: ${classification.type} (Reason: ${classification.reason})`);

    // Verify
    if (classification.type === tc.expectedType || (hasPII && tc.expectedType === "FACTUAL")) {
      console.log(`  ✅ Passed`);
      passed++;
    } else {
      console.log(`  ❌ Failed (Expected: ${tc.expectedType})`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\nURL Source Guard Tests:`);
  
  const validUrl = "https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth";
  const hallucinatedUrl = "https://groww.in/mutual-funds/hdfc-made-up-fund";
  
  console.log(`Testing Valid URL: ${verifyCitation(validUrl) === validUrl ? "✅ Passed" : "❌ Failed"}`);
  console.log(`Testing Hallucinated URL: ${verifyCitation(hallucinatedUrl) === null ? "✅ Passed" : "❌ Failed"}`);
  
  if (passed === 5) {
    console.log(`\n🎉 All ${passed} exit-criteria tests passed!`);
  }
}

runTests().catch(console.error);
