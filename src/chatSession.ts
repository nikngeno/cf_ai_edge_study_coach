// src/chatSession.ts
import type { Ai } from "@cloudflare/workers-types";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  role: Role;
  content: string;
  timestamp: number;
}

interface SessionState {
  goals: string[];
  messages: ChatMessage[];
}

// Env for this file – AI binding only
export interface ChatEnv {
  AI: Ai;
}

export class ChatSession {
  state: DurableObjectState;
  env: ChatEnv;
  private cache: SessionState | null = null;

  constructor(state: DurableObjectState, env: ChatEnv) {
    this.state = state;
    this.env = env;
  }

  private async loadState(): Promise<SessionState> {
    if (this.cache) return this.cache;

    const stored = await this.state.storage.get<SessionState>("state");
    if (stored) {
      this.cache = stored;
      return stored;
    }

    const fresh: SessionState = {
      goals: [],
      messages: [
        {
          role: "system",
          content:
            "You are Edge Study Coach, an encouraging AI study partner. " +
            "You help the user break topics into smaller chunks, quiz them, " +
            "and build on their previous conversations and goals.",
          timestamp: Date.now()
        }
      ]
    };

    this.cache = fresh;
    return fresh;
  }

  private async saveState(state: SessionState) {
    this.cache = state;
    await this.state.storage.put("state", state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/history") {
      const state = await this.loadState();
      return Response.json({
        goals: state.goals,
        messages: state.messages.filter((m) => m.role !== "system")
      });
    }

    if (request.method === "POST" && pathname === "/message") {
      const body = await request.json<{ message: string; goals?: string[] }>();
      const userText = body.message?.trim();
      if (!userText) {
        return new Response("Missing message", { status: 400 });
      }

      const state = await this.loadState();

      if (Array.isArray(body.goals)) {
        state.goals = body.goals.slice(0, 5);
      }

      const userMessage: ChatMessage = {
        role: "user",
        content: userText,
        timestamp: Date.now()
      };
      state.messages.push(userMessage);

      const recent = state.messages.slice(-15);

      const goalsText =
        state.goals.length > 0
          ? `The user's current study goals: ${state.goals.join("; ")}`
          : "The user has not specified explicit study goals yet.";

      const systemContext: ChatMessage = {
        role: "system",
        content:
          `${goalsText}\n` +
          "Always respond as a study coach: explain briefly, then ask a follow-up question or propose a small exercise.",
        timestamp: Date.now()
      };

      const messagesForModel = [systemContext, ...recent].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const aiResponse = await this.env.AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        {
          messages: messagesForModel,
          max_tokens: 400,
          temperature: 0.7
        }
      );

      // Workers AI returns a JSON object with a 'response' or 'result' depending on model.
      const answerText =
        typeof aiResponse === "string"
          ? aiResponse
          : (aiResponse as any).response ??
            (aiResponse as any).result ??
            JSON.stringify(aiResponse);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answerText,
        timestamp: Date.now()
      };
      state.messages.push(assistantMessage);

      await this.saveState(state);

      return Response.json({
        reply: assistantMessage.content,
        goals: state.goals
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
