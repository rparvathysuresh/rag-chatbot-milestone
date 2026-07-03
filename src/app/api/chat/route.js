import { NextResponse } from "next/server";
import { scrubPII, PII_WARNING_MSG } from "@/lib/piiGuard";
import { classifyQuery } from "@/lib/classifier";
import { embedQuery } from "@/lib/embeddings";
import { searchSimilar } from "@/lib/vectorStore";
import { buildPrompt } from "@/lib/promptBuilder";
import { generateResponse } from "@/lib/llm";
import { verifyCitation } from "@/lib/sourceGuard";

const MAX_QUERY_LENGTH = 500;

export async function POST(request) {
  try {
    const body = await request.json();
    const rawQuery = body.query;

    // 1. Validation
    if (!rawQuery || typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter a valid question." },
        { status: 400 }
      );
    }

    if (rawQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query too long. Please limit to ${MAX_QUERY_LENGTH} characters.` },
        { status: 400 }
      );
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
      
      return NextResponse.json({
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
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }

    const chunks = searchSimilar(queryVector, 3);
    
    // If no relevant info found above threshold
    if (chunks.length === 0) {
      let finalAnswer = "I'm sorry, I don't have that information. Please check the official Groww website or scheme documents.";
      if (hasPII) finalAnswer += PII_WARNING_MSG;
      
      return NextResponse.json({
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
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }

    // 6. Verification & Formatting
    const validUrl = verifyCitation(llmResponse.source_url);
    
    let finalAnswer = llmResponse.answer;
    if (hasPII) {
      finalAnswer += PII_WARNING_MSG;
    }

    // Attempt to extract scheme name from top chunk for frontend context
    const scheme = chunks[0]?.scheme_name || null;

    return NextResponse.json({
      type: "FACTUAL",
      answer: finalAnswer,
      source_url: validUrl,
      last_updated: validUrl ? llmResponse.last_updated : null,
      scheme: scheme
    });

  } catch (error) {
    console.error("[API] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
