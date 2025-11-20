(function () {
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const goalsInput = document.getElementById("goalsInput");
  const saveGoalsBtn = document.getElementById("saveGoalsBtn");

  // New: folder list container on the left (not a dropdown)
  const folderListEl = document.getElementById("folderList");
  const newFolderInput = document.getElementById("newFolderInput");
  const createFolderBtn = document.getElementById("createFolderBtn");

  const STORAGE_KEY = "edge_study_coach_session_id";
  let sessionId = localStorage.getItem(STORAGE_KEY);

  let activeFolderId = "general";
  let folders = [{ id: "general", name: "General", goals: [] }];

  // "See more" state for folders
  const MAX_VISIBLE_FOLDERS = 6;
  let showAllFolders = false;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

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

  // --- NEW: render folders as a vertical list with "see more" ---
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

    // Title
    const title = document.createElement("div");
    title.textContent = "Folders";
    title.className = "folder-list-title"; // style in CSS
    folderListEl.appendChild(title);

    // Each folder as a button in the left sidebar
    visibleFolders.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "folder-item" + (f.id === activeFolderId ? " active" : "");
      btn.textContent = f.name;

      btn.addEventListener("click", () => {
        activeFolderId = f.id;
        const folder = folders.find((x) => x.id === activeFolderId);
        goalsInput.value =
          folder && Array.isArray(folder.goals)
            ? folder.goals.join("\n")
            : "";

        // Re-render to highlight the active folder
        renderFolderList();
      });

      folderListEl.appendChild(btn);
    });

    // "⋯ See more" button if there are extra folders
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

  async function loadHistory() {
    try {
      const res = await fetch(
        `/api/history?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (!res.ok) return;

      const data = await res.json();

      // Expecting: { folders, activeFolderId, activeFolderGoals, messages }
      if (Array.isArray(data.folders) && data.folders.length > 0) {
        folders = data.folders;
      } else {
        folders = [{ id: "general", name: "General", goals: [] }];
      }

      activeFolderId = data.activeFolderId || folders[0].id;

      // Sync goals textarea with active folder
      if (Array.isArray(data.activeFolderGoals)) {
        goalsInput.value = data.activeFolderGoals.join("\n");
        const activeFolder = folders.find((f) => f.id === activeFolderId);
        if (activeFolder) {
          activeFolder.goals = data.activeFolderGoals;
        }
      } else {
        const activeFolder = folders.find((f) => f.id === activeFolderId);
        goalsInput.value =
          activeFolder && Array.isArray(activeFolder.goals)
            ? activeFolder.goals.join("\n")
            : "";
      }

      // Render sidebar folders based on latest state
      renderFolderList();

      (data.messages || []).forEach((m) => renderMessage(m.role, m.content));
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }

  async function sendMessage(text) {
    const goals = goalsInput.value
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);

    // Update local folder goals before sending
    const folder = folders.find((f) => f.id === activeFolderId);
    if (folder) {
      folder.goals = goals;
    }

    // Show user message in UI immediately
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
          goals,
          folderId: activeFolderId,
          folderName: folder ? folder.name : activeFolderId
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

      // Update folders / activeFolderId from server response so sidebar stays in sync
      if (Array.isArray(data.folders)) {
        folders = data.folders;
      }
      if (data.activeFolderId) {
        activeFolderId = data.activeFolderId;
      }

      renderFolderList();

      renderMessage("assistant", data.reply || "(no reply)");
    } catch (err) {
      input.disabled = false;
      renderMessage("assistant", "Network error talking to the coach.");
      console.error(err);
    }
  }

  // Folder creation – still works, just re-renders the sidebar instead of a dropdown
  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", () => {
      const name = newFolderInput.value.trim();
      if (!name) return;

      const id = name.toLowerCase().replace(/\s+/g, "-");
      if (!folders.find((f) => f.id === id)) {
        folders.push({ id, name, goals: [] });
      }

      activeFolderId = id;
      newFolderInput.value = "";
      goalsInput.value = "";

      renderFolderList();
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendMessage(text);
  });

  saveGoalsBtn.addEventListener("click", () => {
    alert(
      "Goals saved for this folder. They’ll be sent with your next question."
    );
  });

  loadHistory();
})();
