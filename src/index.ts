// src/index.ts
import { ChatSession, type ChatEnv } from "./chatSession";

export interface Env extends ChatEnv {
  CHAT_SESSION: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Health check
    if (pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Chat API
    if (pathname === "/api/chat" && request.method === "POST") {
      const body = await request.json<{ message: string; sessionId: string; goals?: string[] }>();

      if (!body.sessionId) {
        return new Response("Missing sessionId", { status: 400 });
      }

      const id = env.CHAT_SESSION.idFromName(body.sessionId);
      const stub = env.CHAT_SESSION.get(id);

     const res = await stub.fetch("https://dummy/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: body.message,
    goals: body.goals
  })
});

      return res;
    }

    if (pathname === "/api/history" && request.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response("Missing sessionId", { status: 400 });
      }

      const id = env.CHAT_SESSION.idFromName(sessionId);
      const stub = env.CHAT_SESSION.get(id);

      const res = await stub.fetch("https://dummy/history");
      return res;
    }

    // Static assets (frontend)
    // /  -> public/index.html
    // /styles.css, /app.js, ...
    if (env.ASSETS && "fetch" in env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("ASSETS binding not configured", { status: 500 });
  }
} satisfies ExportedHandler<Env>;

// Re-export DO for Wrangler to find it by class_name "ChatSession"
export { ChatSession };
