cf_ai_edge_study_coach

Edge Study Coach is an AI-powered study assistant built entirely on Cloudflare Workers, Workers AI, and Durable Objects.
It lets users set study goals, chat with an AI tutor, and maintain personalized progress through persistent state.

This implementation fully satisfies all requirements for the Cloudflare AI Fast-Track Assignment.

🚀 Live Deployment

Production URL:
Add your deployed link here after running npm run deploy

🧠 Overview

Edge Study Coach uses Cloudflare’s serverless stack end-to-end:

Browser (HTML/JS UI)
      ↓   /api/chat   /api/history
Cloudflare Worker (index.ts)
      ↓
Durable Object: ChatSession
    - Stores study goals
    - Persists message history
    - Builds personalized LLM prompts
      ↓
Workers AI (Llama 3.3)
    - env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast")


No backend servers or external APIs are required — everything runs at the edge.

📁 Project Structure
src/
  index.ts          # Worker routing + API endpoints
  chatSession.ts    # Durable Object: state + LLM calls

public/
  index.html        # Chat interface
  styles.css        # UI styling
  app.js            # Frontend logic (fetch + rendering)

wrangler.toml       # Cloudflare configuration (AI + DO + assets)
package.json
tsconfig.json
README.md
PROMPTS.md

🧪 Local Development
1. Install dependencies
npm install

2. Log in to Cloudflare
wrangler login

3. Start the development server
npm run dev


Then open:

http://localhost:8787


You should see the chat interface and be able to interact with the AI locally.

🌐 Deployment

Deploy the Worker:

npm run deploy


Copy the generated *.workers.dev URL and paste it into the Live Deployment section above.

🔧 Key Features
✔ Workers AI (LLM)

Uses Llama 3.3 via:

env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {...})

✔ Durable Objects for Memory

Each user session retains:

Study goals

Message history

Context for improved LLM responses

✔ Lightweight Web Interface

Goal editor

Chat input

Real-time message rendering

Session persistence via localStorage

✔ 100% Edge Execution

No servers

No API keys

Fully Cloudflare-native architecture

✔ Assignment Checklist
Requirement	Completed
LLM	Workers AI (Llama 3.3)
Workflow / Coordination	Durable Object session handler
User Input / Chat	Browser UI + Worker API
Memory / State	DO persistent storage
Documentation	README.md + PROMPTS.md
Repo Prefix	Yes (cf_ai_…)
Original Work	✔ Fully original
📜 License

MIT License — free to use, modify, and extend.
