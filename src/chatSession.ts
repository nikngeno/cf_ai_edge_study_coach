import type { Ai } from "@cloudflare/workers-types";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  role: Role;
  content: string;
  timestamp: number;
}

interface Goal {
  id: string;
  title: string;
  notes: string;
}

interface Folder {
  id: string;       // e.g. "general", "os", "csharp"
  name: string;     // e.g. "General", "Operating Systems"
  goals: Goal[];    // individual goals in this folder
}

interface SessionState {
  folders: Folder[];
  activeFolderId: string | null;
  activeGoalId: string | null;
  // Per-goal conversation history
  messagesByGoal: Record<string, ChatMessage[]>;
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

  // --- Helpers --------------------------------------------------------------

  private normalizeFolders(rawFolders: any[]): Folder[] {
    return rawFolders.map((f: any, idx: number) => {
      const id =
        typeof f.id === "string"
          ? f.id
          : idx === 0
          ? "general"
          : `folder-${idx}`;

      const name = typeof f.name === "string" ? f.name : "Folder";

      const rawGoals = Array.isArray(f.goals) ? f.goals : [];
      const goals: Goal[] = rawGoals.map((g: any, gIdx: number) => {
        if (typeof g === "string") {
          return {
            id: `${id}-goal-${gIdx}`,
            title: g,
            notes: ""
          };
        }

        const goalId =
          typeof g.id === "string" ? g.id : `${id}-goal-${gIdx}`;
        const title =
          typeof g.title === "string" ? g.title : "Goal";
        const notes =
          typeof g.notes === "string" ? g.notes : "";

        return { id: goalId, title, notes };
      });

      return { id, name, goals };
    });
  }

  private async loadState(): Promise<SessionState> {
    if (this.cache) return this.cache;

    const stored = await this.state.storage.get<any>("state");

    if (stored) {
      // --- New shape already (messagesByGoal present) -----------------------
      if (stored && stored.messagesByGoal) {
        const folders: Folder[] = this.normalizeFolders(
          Array.isArray(stored.folders) ? stored.folders : []
        );

        let activeFolderId: string | null =
          typeof stored.activeFolderId === "string"
            ? stored.activeFolderId
            : folders[0]?.id ?? "general";

        if (!folders.find((f) => f.id === activeFolderId) && folders[0]) {
          activeFolderId = folders[0].id;
        }

        let activeGoalId: string | null =
          typeof stored.activeGoalId === "string"
            ? stored.activeGoalId
            : null;

        const messagesByGoal: Record<string, ChatMessage[]> =
          typeof stored.messagesByGoal === "object" &&
          stored.messagesByGoal !== null
            ? stored.messagesByGoal
            : {};

        const migrated: SessionState = {
          folders,
          activeFolderId,
          activeGoalId,
          messagesByGoal
        };

        this.cache = migrated;
        await this.state.storage.put("state", migrated);
        return migrated;
      }

      // --- Old shape: messages array + folders with goals: string[] --------
      const folders: Folder[] = this.normalizeFolders(
        Array.isArray(stored.folders) ? stored.folders : []
      );

      let activeFolderId: string | null =
        typeof stored.activeFolderId === "string"
          ? stored.activeFolderId
          : folders[0]?.id ?? "general";

      if (!folders.find((f) => f.id === activeFolderId) && folders[0]) {
        activeFolderId = folders[0].id;
      }

      // Old messages: single array, no goal separation
      const oldMessages: ChatMessage[] = Array.isArray(stored.messages)
        ? stored.messages
        : [];

      const messagesByGoal: Record<string, ChatMessage[]> = {};

      // Attach all old messages to a single "legacy" goal in the active folder
      let activeGoalId: string | null = null;
      let targetFolder =
        folders.find((f) => f.id === activeFolderId) ?? folders[0];

      if (!targetFolder) {
        targetFolder = {
          id: "general",
          name: "General",
          goals: []
        };
        folders.push(targetFolder);
        activeFolderId = targetFolder.id;
      }

      if (targetFolder.goals.length === 0) {
        const legacyGoal: Goal = {
          id: `${targetFolder.id}-goal-legacy`,
          title: "Legacy session",
          notes: ""
        };
        targetFolder.goals.push(legacyGoal);
      }

      activeGoalId = targetFolder.goals[0].id;
      messagesByGoal[activeGoalId] = oldMessages.filter(
        (m) => m.role !== "system"
      );

      const migrated: SessionState = {
        folders,
        activeFolderId,
        activeGoalId,
        messagesByGoal
      };

      this.cache = migrated;
      await this.state.storage.put("state", migrated);
      return migrated;
    }

    // --- Fresh state (no previous storage) ---------------------------------
    const fresh: SessionState = {
      folders: [
        {
          id: "general",
          name: "General",
          goals: []
        }
      ],
      activeFolderId: "general",
      activeGoalId: null,
      messagesByGoal: {}
    };

    this.cache = fresh;
    return fresh;
  }

  private async saveState(state: SessionState) {
    this.cache = state;
    await this.state.storage.put("state", state);
  }

  // -------------------------------------------------------------------------

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
        state.activeGoalId = null;
        await this.saveState(state);
      }

      // We return messagesByGoal so the frontend can decide what to show.
      // System messages are not stored in messagesByGoal.
      return Response.json({
        folders: state.folders,
        activeFolderId: state.activeFolderId,
        activeGoalId: state.activeGoalId,
        messagesByGoal: state.messagesByGoal
      });
    }

    // ---- POST /message ----
    if (request.method === "POST" && pathname === "/message") {
      const body = await request.json<{
        message: string;
        goals?: string[]; // legacy, ignored now
        folderId?: string;
        folderName?: string;
        goalId?: string;
        goalTitle?: string;
        goalNotes?: string;
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
        state.activeGoalId = null;
      }

      // ----- Folder handling -----
      let activeFolder: Folder;

      if (body.folderId) {
        const existing = state.folders.find((f) => f.id === body.folderId);
        if (existing) {
          activeFolder = existing;
        } else {
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

      // ----- Goal handling -----
      let activeGoal: Goal | undefined;

      if (body.goalId) {
        activeGoal = activeFolder.goals.find((g) => g.id === body.goalId);
        if (!activeGoal) {
          activeGoal = {
            id: body.goalId,
            title: body.goalTitle || "New goal",
            notes: body.goalNotes || ""
          };
          activeFolder.goals.push(activeGoal);
        } else {
          // Update title if provided
          if (typeof body.goalTitle === "string" && body.goalTitle.trim()) {
            activeGoal.title = body.goalTitle.trim();
          }
        }
        if (typeof body.goalNotes === "string") {
          activeGoal.notes = body.goalNotes;
        }
        state.activeGoalId = activeGoal.id;
      } else {
        // No goalId provided: fall back to existing activeGoal or first goal
        if (state.activeGoalId) {
          activeGoal = activeFolder.goals.find(
            (g) => g.id === state.activeGoalId
          );
        }
        if (!activeGoal && activeFolder.goals.length > 0) {
          activeGoal = activeFolder.goals[0];
          state.activeGoalId = activeGoal.id;
        }
        if (!activeGoal) {
          // Create a default goal
          const newGoal: Goal = {
            id: `${activeFolder.id}-goal-${Date.now()}`,
            title: "New goal",
            notes: body.goalNotes || ""
          };
          activeFolder.goals.push(newGoal);
          activeGoal = newGoal;
          state.activeGoalId = newGoal.id;
        }
      }

      const goalId = activeGoal.id;

      if (!state.messagesByGoal[goalId]) {
        state.messagesByGoal[goalId] = [];
      }

      // ----- Add user message -----
      const userMessage: ChatMessage = {
        role: "user",
        content: userText,
        timestamp: Date.now()
      };
      state.messagesByGoal[goalId].push(userMessage);

      const recent = state.messagesByGoal[goalId].slice(-15);

      const goalContext =
        activeGoal.notes && activeGoal.notes.trim().length > 0
          ? `The user's current study goal is "${activeGoal.title}". Notes for this goal: ${activeGoal.notes}`
          : `The user's current study goal is "${activeGoal.title}".`;

      const systemContext: ChatMessage = {
        role: "system",
        content:
          `${goalContext}\n` +
          `Folder: "${activeFolder.name}".\n` +
          "Always respond as a study coach: explain briefly, then ask a follow-up " +
          "question or propose a small exercise related to this specific goal.",
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
        console.error("Workers AI error:", err);

        answerText =
          "I'm having trouble reaching the AI model right now. " +
          "Please try your question again in a moment.";
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answerText,
        timestamp: Date.now()
      };
      state.messagesByGoal[goalId].push(assistantMessage);

      await this.saveState(state);

      return Response.json({
        reply: assistantMessage.content,
        folders: state.folders,
        activeFolderId: state.activeFolderId,
        activeGoalId: state.activeGoalId
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
