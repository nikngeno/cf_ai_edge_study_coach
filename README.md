# 🚀 Edge Study Coach

An AI-powered study assistant built 100% on Cloudflare Workers, Workers AI, and Durable Objects.

Easily set study goals, chat with your personal AI tutor, and track progress—all with edge-native persistent state.  
This implementation satisfies all requirements for the **Cloudflare AI Fast-Track Assignment**.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy_to-Cloudflare-blue?logo=Cloudflare)](#)

---

## 🌐 Live Deployment

**Production URL:**  
_Add your deployed link here after running `npm run deploy`_

---

## 🧠 Overview

A fully serverless stack using Cloudflare:
src/
index.ts # Worker routing + API endpoints
chatSession.ts # Durable Object: state + LLM calls

public/
index.html # Chat interface
styles.css # UI styling
app.js # Frontend logic (fetch + rendering)

wrangler.toml # Cloudflare config (AI, DO, assets)
package.json
tsconfig.json
README.md
PROMPTS.md

## 🗂️ Project Structure


---

## 🧪 Local Development

1. **Install dependencies**
    ```
    npm install
    ```

2. **Log in to Cloudflare**
    ```
    wrangler login
    ```

3. **Start the development server**
    ```
    npm run dev
    ```

Open [http://localhost:8787](http://localhost:8787) in your browser to see the chat interface and interact with the AI locally.

---

## 🚚 Deployment

1. **Deploy the Worker:**
    ```
    npm run deploy
    ```
2. Copy the generated `*.workers.dev` URL and add it to the "Live Deployment" section above.

---

## ✨ Features

- 🤖 **Workers AI (LLM):**  
  Uses Llama 3.3 via  
  `env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {...})`

- 💾 **Durable Objects for Memory:**  
  - Persistent study goals  
  - Retained message history  
  - Personalized session context

- 🏷️ **Lightweight Web Interface:**  
  - Goal editor  
  - Chat input  
  - Real-time message rendering  
  - Session persistence via `localStorage`

- 🛰️ **100% Edge Execution:**  
  - No backend servers  
  - No external API keys  
  - Fully Cloudflare-native architecture

---

## ✅ Assignment Checklist

| Requirement            | Completed                             |
|------------------------|---------------------------------------|
| LLM                    | Workers AI (Llama 3.3)                |
| Workflow/Coordination  | Durable Object session handler        |
| User Input/Chat        | Browser UI + Worker API               |
| Memory/State           | DO persistent storage                 |
| Documentation          | README.md + PROMPTS.md                |
| Repo Prefix            | Yes (`cf_ai_…`)                       |
| Original Work          | ✔ Fully original                      |

---

## 📄 License

Free to use
