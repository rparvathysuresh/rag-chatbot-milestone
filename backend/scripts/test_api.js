/**
 * API Route Test Script
 * 
 * Tests the src/app/api/chat/route.js logic directly without
 * needing to start the Next.js dev server.
 */

import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

// Load environment variables
config({ path: join(PROJECT_ROOT, ".env") });
config({ path: join(PROJECT_ROOT, ".env.local") });

async function runApiTests() {
  const { POST } = await import("../src/app/api/chat/route.js");

  const testCases = [
    { name: "Factual Query", query: "What is the exit load for HDFC Mid-Cap Fund?" },
    { name: "Advisory Query", query: "Which fund should I buy right now?" },
    { name: "PII Query", query: "My PAN is ABCDE1234F, show my expense ratio" },
    { name: "Empty Query", query: "   " },
    { name: "Too Long Query", query: "a".repeat(501) }
  ];

  console.log("🌐 Testing Next.js API Route Logic\n" + "=".repeat(50));

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n▶️ Test ${i+1}: ${tc.name}`);
    console.log(`Query: "${tc.query.length > 50 ? tc.query.substring(0, 50) + "..." : tc.query}"`);
    
    // Mock the Next.js Request object
    const mockRequest = {
      json: async () => ({ query: tc.query })
    };

    try {
      const response = await POST(mockRequest);
      // Wait, NextResponse.json() returns a standard Web Response object.
      // We need to await .json() on it to see the body.
      const responseBody = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Body:`, JSON.stringify(responseBody, null, 2));
      
    } catch (e) {
      console.error("Test failed with error:", e);
    }
    
    console.log("-".repeat(50));
  }
}

runApiTests().catch(console.error);
