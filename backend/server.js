import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // loads .env before other imports
import { scrubPII, PII_WARNING_MSG } from './lib/piiGuard.js';
import { classifyQuery } from './lib/classifier.js';
import { embedQuery } from './lib/embeddings.js';
import { searchSimilar } from './lib/vectorStore.js';
import { buildPrompt } from './lib/promptBuilder.js';
import { generateResponse } from './lib/llm.js';
import { verifyCitation } from './lib/sourceGuard.js';

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_QUERY_LENGTH = 500;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const rawQuery = req.body.query;

    // 1. Validation
    if (!rawQuery || typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
      return res.status(400).json({ error: "Please enter a valid question." });
    }

    if (rawQuery.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ error: `Query too long. Please limit to ${MAX_QUERY_LENGTH} characters.` });
    }

    // 2. PII Detection & Scrubbing
    const { scrubbedQuery, hasPII } = scrubPII(rawQuery);

    // 3. Classification & Guardrails
    const classification = await classifyQuery(scrubbedQuery);
    
    // Log for monitoring
    console.log(`[API] Query classified as: ${classification.type} (${classification.reason})`);

    if (classification.type === "ADVISORY" || classification.type === "OFF_TOPIC") {
      let finalAnswer = classification.refusal;
      if (hasPII) finalAnswer += PII_WARNING_MSG;
      
      return res.json({
        type: "ADVISORY_REFUSAL",
        answer: finalAnswer,
        source_url: null,
        last_updated: null,
        scheme: null
      });
    }

    // 4. Retrieval
    let queryVector;
    try {
      queryVector = await embedQuery(scrubbedQuery);
    } catch (e) {
      console.error("[API] Embedding error:", e);
      return res.status(503).json({ error: "Service temporarily unavailable." });
    }

    const chunks = searchSimilar(queryVector, 3);
    
    // If no relevant info found above threshold
    if (chunks.length === 0) {
      let finalAnswer = "I'm sorry, I don't have that information. Please check the official Groww website or scheme documents.";
      if (hasPII) finalAnswer += PII_WARNING_MSG;
      
      return res.json({
        type: "FACTUAL",
        answer: finalAnswer,
        source_url: null,
        last_updated: null,
        scheme: null
      });
    }

    // 5. LLM Generation
    const prompt = buildPrompt(chunks, scrubbedQuery);
    
    let llmResponse;
    try {
      llmResponse = await generateResponse(prompt);
    } catch (e) {
      console.error("[API] LLM error:", e);
      return res.status(503).json({ error: "Service temporarily unavailable." });
    }

    // 6. Verification & Formatting
    const validUrl = verifyCitation(llmResponse.source_url);
    
    let finalAnswer = llmResponse.answer;
    if (hasPII) {
      finalAnswer += PII_WARNING_MSG;
    }

    // Attempt to extract scheme name from top chunk for frontend context
    const scheme = chunks[0]?.scheme_name || null;

    return res.json({
      type: "FACTUAL",
      answer: finalAnswer,
      source_url: validUrl,
      last_updated: validUrl ? llmResponse.last_updated : null,
      scheme: scheme
    });

  } catch (error) {
    console.error("[API] Unhandled error:", error);
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
