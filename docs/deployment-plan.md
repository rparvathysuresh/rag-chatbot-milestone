# Deployment Plan: Frontend on Vercel & Backend on Railway

## 1. Goal & Architecture Overview

Currently, the project is a **monolithic Next.js application** where both the frontend UI and the backend API logic (including local ML embeddings) reside together. 

The goal is to split the architecture to deploy the **Frontend on Vercel** and the **Backend on Railway**.

### Why split the architecture?
The chatbot uses `@xenova/transformers` for local embeddings (`BAAI/bge-small-en-v1.5`). 
- **Vercel** uses Serverless Functions for API routes. These have strict size limits (50MB zipped on the Hobby tier) and execution timeouts (10 to 60 seconds). Running ML models within Vercel serverless functions often leads to cold-start delays, memory limit crashes, and timeout errors.
- **Railway** provisions long-running containerized environments (Node.js processes or Docker containers). This makes it perfectly suited to load the embedding models into memory once and serve requests quickly without serverless constraints.

---

## 2. Target Architecture

### Frontend (Vercel)
- **Tech Stack:** Next.js (React), Tailwind CSS.
- **Role:** Serves the static/SSR UI components and handles user interactions.
- **Integration:** Makes HTTP `POST` requests to the Railway backend URL.

### Backend (Railway)
- **Tech Stack:** Node.js, Express.js, `@xenova/transformers`, Groq SDK.
- **Role:** Handles query classification, vector embeddings, vector store retrieval (`data/processed/vector_store.json`), and communicates with the Groq LLM.
- **Integration:** Exposes a `POST /api/chat` endpoint and accepts requests via CORS from the Vercel frontend domain.

---

## 3. Step-by-Step Implementation Plan

### Phase 1: Backend Extraction (Node.js + Express)
1. **Initialize Backend Structure:**
   - Create a new directory (e.g., `backend/` at the root, or initialize a completely separate repository).
   - Initialize a new `package.json` and install backend dependencies: `express`, `cors`, `dotenv`, `@xenova/transformers`, `groq-sdk`, `langchain`, etc.
2. **Migrate Logic:**
   - Move the existing backend logic from `src/lib/` (`classifier.js`, `embeddings.js`, `vectorStore.js`, `promptBuilder.js`, `llm.js`) into the backend directory.
   - Move the `data/` folder (which contains the indexed `vector_store.json`) to the backend.
3. **Setup Express Server (`server.js`):**
   - Create an Express server that exposes `POST /api/chat`.
   - Implement the logic previously found in `src/app/api/chat/route.js`.
   - Configure **CORS** to accept requests from your future Vercel domain and `localhost:3000`.
4. **Railway Configuration:**
   - Add a `start` script to the backend `package.json`: `"start": "node server.js"`.
   - (Optional) Add a `railway.json` or `Procfile` if needed.

### Phase 2: Frontend Refactoring (Next.js)
1. **Remove Backend Code:**
   - Delete `src/app/api/chat/route.js`.
   - Remove heavy backend dependencies from the Next.js `package.json` to keep the frontend bundle light (e.g., remove `@xenova/transformers`, `cheerio`).
2. **Update API Calls:**
   - Modify the frontend component that triggers the chat (e.g., `InputBar.jsx` or `ChatWindow.jsx`).
   - Change the fetch URL from `/api/chat` to `process.env.NEXT_PUBLIC_BACKEND_URL + '/api/chat'`.
3. **Environment Variables:**
   - Add `.env.local` variable: `NEXT_PUBLIC_BACKEND_URL=http://localhost:5000` (for local dev).

### Phase 3: Deployment Strategy

#### 1. Deploy Backend to Railway
- Connect your GitHub repository to Railway.
- If using a monorepo setup, configure the Railway project's **Root Directory** to point to the `backend/` folder.
- Add necessary Environment Variables in the Railway dashboard:
  - `GROQ_API_KEY`
  - `PORT=5000`
- Deploy the service and obtain the public URL (e.g., `https://rag-backend-production.up.railway.app`).

#### 2. Deploy Frontend to Vercel
- Connect your GitHub repository to Vercel.
- Ensure the **Root Directory** is set to the frontend folder (or leave as root if Next.js is at the root).
- Add necessary Environment Variables in the Vercel dashboard:
  - `NEXT_PUBLIC_BACKEND_URL=https://rag-backend-production.up.railway.app`
- Deploy the Next.js application.

#### 3. Final Integration Testing
- Open the Vercel URL.
- Submit a query and monitor the Railway logs to ensure the request is properly received, processed by the ML embedding model, and successfully returned.

---

## 4. Work Breakdown (Tasks for Execution)
- [ ] Create `backend` folder and initialize Express server.
- [ ] Migrate AI, vector DB, and embedding logic to `backend`.
- [ ] Configure CORS and `POST /api/chat` endpoint on the Express server.
- [ ] Clean up Next.js frontend (remove API routes and heavy dependencies).
- [ ] Update frontend to use `NEXT_PUBLIC_BACKEND_URL` for fetching chat responses.
- [ ] Test the decoupled architecture locally (Frontend on port 3000, Backend on port 5000).
- [ ] Ready for deployment to Railway and Vercel.
