async function testApi() {
  const query = "What is the exit load for HDFC Mid-Cap Fund?";
  
  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testApi();
