// src/chatSession.ts
import type { Ai } from "@cloudflare/workers-types";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  role: Role;
  content: string;
  timestamp: number;
}

interface Folder {
  id: string;       // e.g. "general", "os", "csharp"
  name: string;     // e.g. "General", "Operating Systems"
  goals: string[];  // goals specific to this folder
}

interface SessionState {
  folders: Folder[];
  activeFolderId: string | null;
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

    const stored = await this.state.storage.get<any>("state");

    if (stored) {
      // --- Migration from old shape (goals + messages) to folders + activeFolderId ---
      let migrated: SessionState;

      if (Array.isArray(stored.folders)) {
        // Already new shape, just normalize a bit
        const folders: Folder[] = stored.folders.map((f: any, idx: number) => ({
          id: typeof f.id === "string" ? f.id : idx === 0 ? "general" : `folder-${idx}`,
          name: typeof f.name === "string" ? f.name : "Folder",
          goals: Array.isArray(f.goals) ? f.goals : []
        }));

        const activeFolderId: string | null =
          typeof stored.activeFolderId === "string"
            ? stored.activeFolderId
            : (folders[0]?.id ?? "general");

        const messages: ChatMessage[] = Array.isArray(stored.messages)
          ? stored.messages
          : [];

        migrated = {
          folders,
          activeFolderId,
          messages
        };
      } else {
        // Old shape: { goals?: string[], messages?: ChatMessage[] }
        const oldGoals: string[] = Array.isArray(stored.goals) ? stored.goals : [];
        const messages: ChatMessage[] = Array.isArray(stored.messages)
          ? stored.messages
          : [];

        migrated = {
          folders: [
            {
              id: "general",
              name: "General",
              goals: oldGoals
            }
          ],
          activeFolderId: "general",
          messages
        };
      }

      this.cache = migrated;
      await this.state.storage.put("state", migrated);
      return migrated;
    }

    // Fresh state (no previous storage)
    const fresh: SessionState = {
      folders: [
        {
          id: "general",
          name: "General",
          goals: []
        }
      ],
      activeFolderId: "general",
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

    // ---- GET /history ----
    if (request.method === "GET" && pathname === "/history") {
      const state = await this.loadState();

      let folders = state.folders;
      if (!Array.isArray(folders) || folders.length === 0) {
        folders = [
          {
            id: "general",
            name: "General",
            goals: []
          }
        ];
        state.folders = folders;
        state.activeFolderId = "general";
        await this.saveState(state);
      }

      const activeFolder =
        folders.find((f) => f.id === state.activeFolderId) ?? folders[0];

      return Response.json({
        folders,
        activeFolderId: activeFolder?.id ?? null,
        activeFolderGoals: activeFolder?.goals ?? [],
        messages: state.messages.filter((m) => m.role !== "system")
      });
    }

    // ---- POST /message ----
    if (request.method === "POST" && pathname === "/message") {
      const body = await request.json<{
        message: string;
        goals?: string[];
        folderId?: string;
        folderName?: string;
      }>();

      const userText = body.message?.trim();
      if (!userText) {
        return new Response("Missing message", { status: 400 });
      }

      const state = await this.loadState();

      // Ensure folders array exists
      if (!Array.isArray(state.folders) || state.folders.length === 0) {
        state.folders = [
          { id: "general", name: "General", goals: [] }
        ];
        state.activeFolderId = "general";
      }

      // ----- Folder handling -----
      let activeFolder: Folder | undefined;

      if (body.folderId) {
        activeFolder = state.folders.find((f) => f.id === body.folderId);
        if (!activeFolder) {
          activeFolder = {
            id: body.folderId,
            name: body.folderName || body.folderId,
            goals: []
          };
          state.folders.push(activeFolder);
        }
        state.activeFolderId = activeFolder.id;
      } else {
        activeFolder =
          state.folders.find((f) => f.id === state.activeFolderId) ??
          state.folders[0];
        state.activeFolderId = activeFolder.id;
      }

      // Update goals for the active folder if provided
      if (Array.isArray(body.goals)) {
        activeFolder.goals = body.goals.slice(0, 10);
      }

      // ----- Add user message -----
      const userMessage: ChatMessage = {
        role: "user",
        content: userText,
        timestamp: Date.now()
      };
      state.messages.push(userMessage);

      const recent = state.messages.slice(-15);

      const goalsText =
        activeFolder.goals.length > 0
          ? `The user's current study goals in the "${activeFolder.name}" folder: ${activeFolder.goals.join(
              "; "
            )}`
          : `The user has no specific goals in the current folder ("${activeFolder.name}").`;

      const systemContext: ChatMessage = {
        role: "system",
        content:
          `${goalsText}\n` +
          "Always respond as a study coach: explain briefly, then ask a follow-up question " +
          "or propose a small exercise related to the user's current folder.",
        timestamp: Date.now()
      };

      const messagesForModel = [systemContext, ...recent].map((m) => ({
        role: m.role,
        content: m.content
      }));

     let answerText: string;

try {
  const aiResponse = await this.env.AI.run(
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    {
      messages: messagesForModel,
      max_tokens: 400,
      temperature: 0.7
    }
  );

  answerText =
    typeof aiResponse === "string"
      ? aiResponse
      : (aiResponse as any).response ??
        (aiResponse as any).result ??
        JSON.stringify(aiResponse);
} catch (err: any) {
  // Log to console for debugging in wrangler dev
  console.error("Workers AI error:", err);

  // Fallback message so the Worker doesn't 500 on the client
  answerText =
    "I'm having trouble reaching the AI model right now. " +
    "Please try your question again in a moment.";
}


      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answerText,
        timestamp: Date.now()
      };
      state.messages.push(assistantMessage);

      await this.saveState(state);

      return Response.json({
        reply: assistantMessage.content,
        folders: state.folders,
        activeFolderId: state.activeFolderId
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
