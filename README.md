# groww-factor (HDFC Mutual Fund FAQ Assistant)

A highly-compliant, RAG-powered chatbot designed to answer factual questions about specific HDFC Mutual Fund schemes on Groww. Built as a prototype for precision and compliance.

⚠️ **Disclaimer: Facts-only. No investment advice.**
This tool is strictly designed to retrieve and display public facts from scheme documents. It is equipped with guardrails to refuse predictive, comparative, and advisory queries.

## Overview

The application uses a **Retrieval-Augmented Generation (RAG)** pipeline to answer user questions using scraped facts.
- **Frontend:** Next.js (React), Tailwind CSS (Precision Fintech Narrative design system).
- **Embeddings:** `BAAI/bge-small-en-v1.5` (run locally via `@xenova/transformers`).
- **Vector Store:** Local JSON-based vector DB (in-memory cosine similarity search).
- **LLM:** `llama-3.3-70b-versatile` hosted on Groq API.

### Supported Schemes (Groww)
1. [HDFC Large Cap Fund](https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth)
2. [HDFC Mid-Cap Fund](https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth)
3. [HDFC Small Cap Fund](https://groww.in/mutual-funds/hdfc-small-cap-fund-direct-growth)
4. [HDFC Gold ETF FoF](https://groww.in/mutual-funds/hdfc-gold-etf-fund-of-fund-direct-plan-growth)
5. [HDFC Silver ETF FoF](https://groww.in/mutual-funds/hdfc-silver-etf-fof-direct-growth)

---

## Setup & Local Development

### 1. Prerequisites
- Node.js (v18+)
- Groq API Key

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone <your-repo-url>
cd "RAG chatbot"
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Data Ingestion Pipeline

The backend relies on scraped data that is processed and converted into vector embeddings. 

**Automated Updates:**
A GitHub Actions workflow (`.github/workflows/ingest.yml`) runs automatically every day at 10:30 AM IST. It checks for changes in the Groww source pages and automatically commits updated embeddings to the repository if changes are detected.

**Manual / Local Updates:**
If you want to manually run the ingestion pipeline locally to force a refresh:

```bash
npm run ingest
```

This single command will sequentially:
1. Scrape the 5 Groww URLs
2. Perform diff checking (skip chunking/embedding if no changes)
3. Chunk the updated text
4. Generate local BGE-Small embeddings and save to `vector_store.json`

---

## Deployment

This Next.js application is ready to be deployed to Vercel with zero configuration changes.

1. Connect your GitHub repository to Vercel.
2. In the Vercel deployment settings, add the `GROQ_API_KEY` to the Environment Variables.
3. Deploy!

### Known Limitations
- Groq API rate limits (30 Requests Per Minute on free tiers) might occasionally throttle simultaneous heavy usage. Exponential backoff has been implemented to mitigate this.
