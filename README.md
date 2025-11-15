cf_ai_edge_study_coach

Edge Study Coach is an AI-powered study assistant built entirely on Cloudflare Workers, Workers AI, and Durable Objects.

Users can:

Set study goals

Chat with an AI tutor

Receive context-aware explanations

Persist progress through Durable Object memory

This project fulfills all requirements for the Cloudflare AI Fast-Track Assignment.

🚀 Live Deployment

Production URL:
👉 Add your deployed URL here after running npm run deploy

🧠 How It Works
Browser (HTML/CSS/JS UI)
      ↓  /api/chat      /api/history
Cloudflare Worker (index.ts)
      ↓
Durable Object: ChatSession
    - Saves goals
    - Stores message history
    - Builds LLM prompts
      ↓
Workers AI (Llama 3.3)
    - env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast")


Edge Study Coach runs fully on Cloudflare’s serverless platform — no external servers or APIs required.

📁 Project Structure
src/
  index.ts          # Worker routing + API
  chatSession.ts    # Durable Object (memory + LLM calls)

public/
  index.html        # Chat interface
  styles.css        # UI styling
  app.js            # Frontend logic

wrangler.toml       # Cloudflare config (AI + DO + assets)
package.json
tsconfig.json
README.md
PROMPTS.md

🧪 Running Locally
1. Install dependencies
npm install

2. Log in to Cloudflare
wrangler login

3. Start dev environment
npm run dev


Then open:

http://localhost:8787

You’ll see the chat interface.

🌐 Deployment

Deploy to Cloudflare:

npm run deploy


Wrangler will output your final Workers URL.
Paste that URL under Live Deployment above.

🔧 Technical Features
✔ Workers AI

Uses Llama 3.3 via:

env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {...})

✔ Durable Objects for Memory

Each user session has persistent state:

Study goals

Chat history

Context injection into AI prompt

✔ Web UI

A simple and clean chat interface:

Local session tracking

Goal editor

Real-time messages

✔ Edge Execution

All processing runs close to the user.
No servers. No API keys. No backend needed.

✔ Cloudflare Assignment Requirements (Scored Criteria)
Requirement	Completed
LLM	Workers AI: Llama 3.3
Workflow / Coordination	Durable Object session manager
User Input / Chat	Browser UI via / + JS
Memory / State	DO persistent storage
Documentation	README + PROMPTS.md
Repo Prefix	Yes → cf_ai_
Fully Original	✔ 100%
📜 License

MIT License – free for modification and extension.
