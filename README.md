Edge Study Coach
Edge Study Coach is an AI-powered study assistant built entirely on Cloudflare Workers, Workers AI, and Durable Objects.
It enables users to set study goals, chat with an AI tutor, and maintain personalized progress through persistent state.
This implementation fully satisfies all requirements for the Cloudflare AI Fast-Track Assignment.

🚀 Live Deployment
Production URL:
Add your deployed link here after running npm run deploy

🧠 Overview
Edge Study Coach leverages Cloudflare’s serverless stack end-to-end:

text
Browser (HTML/JS UI)
      ↓    /api/chat   /api/history
Cloudflare Worker (index.ts)
      ↓
Durable Object: ChatSession
    • Stores study goals
    • Persists message history
    • Builds personalized LLM prompts
      ↓
Workers AI (Llama 3.3)
    • env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
No backend servers or external APIs required — everything runs at the edge.

📁 Project Structure
text
src/
  index.ts          # Worker routing + API endpoints
  chatSession.ts    # Durable Object: state + LLM calls

public/
  index.html        # Chat interface
  styles.css        # UI styling
  app.js            # Frontend logic (fetch + rendering)

wrangler.toml       # Cloudflare config (AI, DO, assets)
package.json
tsconfig.json
README.md
PROMPTS.md
🧪 Local Development
Install dependencies

text
npm install
Log in to Cloudflare

text
wrangler login
Start the development server

text
npm run dev
Then open http://localhost:8787 in your browser to access the chat interface and interact with the AI locally.

🌐 Deployment
Deploy the Worker:

text
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
Choose your preferred license and add license text here.
MIT License — free to use, modify, and extend.
