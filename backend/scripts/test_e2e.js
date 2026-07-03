import fs from 'fs';

const API_URL = 'http://localhost:3000/api/chat';

const testCases = [
  // 7.1 Factual Queries
  { id: 1, type: "factual", query: "What is the expense ratio of HDFC Large Cap Fund?" },
  { id: 2, type: "factual", query: "What is the exit load for HDFC Mid-Cap Fund?" },
  { id: 3, type: "factual", query: "What is the benchmark index for HDFC Small Cap Fund?" },
  { id: 4, type: "factual", query: "What is the minimum investment for HDFC Gold ETF FoF?" },
  { id: 5, type: "factual", query: "What is the riskometer category of HDFC Silver ETF FoF?" },
  
  // 7.2 Refusal Scenarios
  { id: 6, type: "advisory", query: "Should I invest in HDFC Large Cap Fund?" },
  { id: 7, type: "advisory", query: "Which fund gives the best returns?" },
  { id: 8, type: "advisory", query: "Compare HDFC Mid-Cap and Small Cap performance" },
  { id: 9, type: "off-topic", query: "What's the weather like?" },
  { id: 10, type: "pii", query: "My PAN is ABCDE1234F" },
  
  // 7.3 Edge Cases
  { id: 11, type: "edge-empty", query: "" },
  { id: 12, type: "edge-long", query: "A".repeat(501) },
  { id: 13, type: "edge-no-info", query: "Who is the CEO of SpaceX?" },
];

async function runTests() {
  console.log("=== Running Phase 7 Integration Tests ===\n");
  let passed = 0;
  let latencies = [];

  for (const test of testCases) {
    console.log(`Test ${test.id} [${test.type.toUpperCase()}]: "${test.query.substring(0, 50)}${test.query.length > 50 ? '...' : ''}"`);
    
    const start = Date.now();
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: test.query })
      });
      
      const latency = Date.now() - start;
      latencies.push(latency);
      
      const status = response.status;
      const data = await response.json();
      
      let testPassed = false;
      
      if (test.type === "factual") {
        testPassed = status === 200 && data.type === "FACTUAL";
      } else if (test.type === "advisory" || test.type === "off-topic") {
        testPassed = status === 200 && data.type === "ADVISORY_REFUSAL";
      } else if (test.type === "pii") {
        testPassed = status === 200 && data.answer.includes("avoid sharing");
      } else if (test.type === "edge-empty" || test.type === "edge-long") {
        testPassed = status === 400 && data.error;
      } else if (test.type === "edge-no-info") {
        testPassed = status === 200 && (data.answer.includes("I'm sorry") || data.type === "ADVISORY_REFUSAL");
      }
      
      if (testPassed) {
        passed++;
        console.log(`  ✅ PASS (${latency}ms)`);
      } else {
        console.log(`  ❌ FAIL (${latency}ms)`);
        console.log(`     Expected behaviour for ${test.type}, got status: ${status}, data:`, data);
      }
      
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
    }
  }
  
  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passed} / ${testCases.length}`);
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  
  console.log(`Avg Latency: ${Math.round(avgLatency)}ms`);
  console.log(`p95 Latency: ${p95}ms`);
}

runTests();
