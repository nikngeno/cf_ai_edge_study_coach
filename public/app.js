(function () {
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const goalsInput = document.getElementById("goalsInput");
  const saveGoalsBtn = document.getElementById("saveGoalsBtn");

  // Sidebar elements
  const folderListEl = document.getElementById("folderList");
  const newFolderInput = document.getElementById("newFolderInput");
  const createFolderBtn = document.getElementById("createFolderBtn");

  const STORAGE_KEY = "edge_study_coach_session_id";
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  // State
  let folders = [{ id: "general", name: "General", goals: [] }];
  let activeFolderId = "general";
  let activeGoalId = null; // which goal is currently selected
  let messagesByGoal = {}; // { [goalId]: ChatMessage[] }

  const MAX_VISIBLE_FOLDERS = 6;
  let showAllFolders = false;

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = `
      <div class="role">${role === "user" ? "You" : "Coach"}</div>
      <div class="text">${escapeHtml(text)}</div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function clearChatUI() {
    messagesEl.innerHTML = "";
  }

  // ---------- Sidebar rendering (folders + goals) --------------------------

  function renderFolderList() {
    if (!folderListEl) return;

    folderListEl.innerHTML = "";

    const visibleFolders = showAllFolders
      ? folders
      : folders.slice(0, MAX_VISIBLE_FOLDERS);

    const hiddenCount =
      folders.length > MAX_VISIBLE_FOLDERS
        ? folders.length - MAX_VISIBLE_FOLDERS
        : 0;

    visibleFolders.forEach((folder) => {
      // Folder button
      const folderBtn = document.createElement("button");
      folderBtn.type = "button";
      folderBtn.className =
        "folder-item" + (folder.id === activeFolderId ? " active" : "");
      folderBtn.textContent = folder.name;

      folderBtn.addEventListener("click", () => {
        activeFolderId = folder.id;
        // Don't auto-load any goal; wait until user clicks a specific goal.
        activeGoalId = null;
        goalsInput.value = "";
        clearChatUI();
        renderFolderList();
      });

      folderListEl.appendChild(folderBtn);

      // Goals under this folder
      if (Array.isArray(folder.goals) && folder.goals.length > 0) {
        const goalsContainer = document.createElement("div");
        goalsContainer.className = "folder-goal-list";

        folder.goals.forEach((goal) => {
          const goalBtn = document.createElement("button");
          goalBtn.type = "button";
          goalBtn.className =
            "folder-goal-item" +
            (goal.id === activeGoalId ? " active-goal" : "");
          goalBtn.textContent = goal.title;

          goalBtn.addEventListener("click", () => {
            activeFolderId = folder.id;
            activeGoalId = goal.id;

            // Load notes into textarea
            goalsInput.value = goal.notes || "";

            // Load chat history for this goal
            clearChatUI();
            const msgs = messagesByGoal[goal.id] || [];
            msgs.forEach((m) => renderMessage(m.role, m.content));

            renderFolderList();
          });

          goalsContainer.appendChild(goalBtn);
        });

        folderListEl.appendChild(goalsContainer);
      }
    });

    if (hiddenCount > 0) {
      const seeMoreBtn = document.createElement("button");
      seeMoreBtn.type = "button";
      seeMoreBtn.className = "folder-see-more";
      seeMoreBtn.textContent = showAllFolders
        ? "Show fewer folders"
        : `⋯ See more (${hiddenCount} more)`;

      seeMoreBtn.addEventListener("click", () => {
        showAllFolders = !showAllFolders;
        renderFolderList();
      });

      folderListEl.appendChild(seeMoreBtn);
    }
  }

  // ---------- History load (initial blank main area) -----------------------

  async function loadHistory() {
    try {
      const res = await fetch(
        `/api/history?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (!res.ok) return;

      const data = await res.json();

      if (Array.isArray(data.folders) && data.folders.length > 0) {
        folders = data.folders;
      } else {
        folders = [{ id: "general", name: "General", goals: [] }];
      }

      activeFolderId =
        typeof data.activeFolderId === "string"
          ? data.activeFolderId
          : folders[0]?.id || "general";

      activeGoalId =
        typeof data.activeGoalId === "string" ? data.activeGoalId : null;

      messagesByGoal =
        typeof data.messagesByGoal === "object" && data.messagesByGoal !== null
          ? data.messagesByGoal
          : {};

      // BUT: we keep UI blank until user clicks a goal or creates one
      goalsInput.value = "";
      clearChatUI();

      renderFolderList();
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }

  // ---------- Goal helpers --------------------------------------------------

  function getActiveFolder() {
    return (
      folders.find((f) => f.id === activeFolderId) || folders[0] || null
    );
  }

  function getActiveGoal() {
    const folder = getActiveFolder();
    if (!folder || !activeGoalId) return null;
    return folder.goals.find((g) => g.id === activeGoalId) || null;
  }

  function ensureGoalForCurrentState() {
    let folder = getActiveFolder();
    if (!folder) {
      folder = { id: "general", name: "General", goals: [] };
      folders = [folder];
      activeFolderId = folder.id;
    }

    let goal = getActiveGoal();
    if (!goal) {
      // Create a new goal using current textarea content as notes
      const notes = goalsInput.value || "";
      const trimmedTitle = notes.trim().split("\n")[0].slice(0, 60);
      const title = trimmedTitle || "New goal";

      const id = `${folder.id}-goal-${Date.now()}`;
      goal = { id, title, notes };

      folder.goals.push(goal);
      activeGoalId = id;

      if (!messagesByGoal[id]) {
        messagesByGoal[id] = [];
      }
    }

    return goal;
  }

  // ---------- Sending a message ---------------------------------------------

  async function sendMessage(text) {
    const folder = getActiveFolder();
    const goal = ensureGoalForCurrentState();

    // Update goal notes from textarea before sending
    goal.notes = goalsInput.value || "";

    if (!messagesByGoal[goal.id]) {
      messagesByGoal[goal.id] = [];
    }

    // Optimistic UI
    messagesByGoal[goal.id].push({
      role: "user",
      content: text,
      timestamp: Date.now()
    });
    renderMessage("user", text);

    input.value = "";
    input.disabled = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          goals: [], // legacy field, unused now
          folderId: folder.id,
          folderName: folder.name,
          goalId: goal.id,
          goalTitle: goal.title,
          goalNotes: goal.notes
        })
      });

      input.disabled = false;
      input.focus();

      if (!res.ok) {
        renderMessage(
          "assistant",
          "Oops, something went wrong talking to the coach."
        );
        return;
      }

      const data = await res.json();

      // Update folders / active ids from server response
      if (Array.isArray(data.folders)) {
        folders = data.folders;
      }
      if (data.activeFolderId) {
        activeFolderId = data.activeFolderId;
      }
      if (data.activeGoalId) {
        activeGoalId = data.activeGoalId;
      }

      const currentGoalId = activeGoalId || goal.id;
      if (!messagesByGoal[currentGoalId]) {
        messagesByGoal[currentGoalId] = [];
      }

      messagesByGoal[currentGoalId].push({
        role: "assistant",
        content: data.reply || "(no reply)",
        timestamp: Date.now()
      });

      renderMessage("assistant", data.reply || "(no reply)");
      renderFolderList();
    } catch (err) {
      input.disabled = false;
      renderMessage(
        "assistant",
        "Network error talking to the coach."
      );
      console.error(err);
    }
  }

  // ---------- Save goal (create or update) ----------------------------------
  if (saveGoalsBtn) {
    saveGoalsBtn.addEventListener("click", async () => {
      const folder = getActiveFolder();
      if (!folder) return;

      const notes = goalsInput.value || "";
      const trimmedTitle = notes.trim().split("\n")[0].slice(0, 60);
      const title = trimmedTitle || "New goal";

      // If we don't yet have a goal id, propose one (backend will use it)
      let goalIdToUse = activeGoalId;
      if (!goalIdToUse) {
        goalIdToUse = `${folder.id}-goal-${Date.now()}`;
      }

      try {
        const res = await fetch("/api/save-goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            folderId: folder.id,
            folderName: folder.name,
            goalId: goalIdToUse,
            goalTitle: title,   // Option 1: title always follows first line
            goalNotes: notes
          })
        });

        if (!res.ok) {
          alert("Failed to save goal on the server.");
          return;
        }

        const data = await res.json();

        // Update local state from server
        if (Array.isArray(data.folders)) {
          folders = data.folders;
        }
        if (data.activeFolderId) {
          activeFolderId = data.activeFolderId;
        }
        if (data.activeGoalId) {
          activeGoalId = data.activeGoalId;
        } else {
          activeGoalId = goalIdToUse;
        }

        // Ensure messages bucket exists locally
        if (activeGoalId && !messagesByGoal[activeGoalId]) {
          messagesByGoal[activeGoalId] = [];
        }

        renderFolderList();
        alert("Goal saved. When you chat, this goal's notes will be used as context.");
      } catch (err) {
        console.error("Error saving goal:", err);
        alert("Network error while saving goal.");
      }
    });
  }


  // ---------- Folder creation -----------------------------------------------

  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", () => {
      const name = newFolderInput.value.trim();
      if (!name) return;

      const id = name.toLowerCase().replace(/\s+/g, "-");
      if (!folders.find((f) => f.id === id)) {
        folders.push({ id, name, goals: [] });
      }

      activeFolderId = id;
      activeGoalId = null;
      newFolderInput.value = "";
      goalsInput.value = "";
      clearChatUI();

      renderFolderList();
    });
  }

  // ---------- Form submit (send message) ------------------------------------

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendMessage(text);
  });

  loadHistory();
})();
