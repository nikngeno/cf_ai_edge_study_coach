// public/app.js
(function () {
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const goalsInput = document.getElementById("goalsInput");
  const saveGoalsBtn = document.getElementById("saveGoalsBtn");

  // Folder-related elements (make sure these exist in index.html)
  const folderSelect = document.getElementById("folderSelect");
  const newFolderInput = document.getElementById("newFolderInput");
  const createFolderBtn = document.getElementById("createFolderBtn");

  const STORAGE_KEY = "edge_study_coach_session_id";
  let sessionId = localStorage.getItem(STORAGE_KEY);

  let activeFolderId = "general";
  let folders = [{ id: "general", name: "General", goals: [] }];

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

  function renderFolderOptions() {
    if (!folderSelect) return;

    folderSelect.innerHTML = "";
    folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === activeFolderId) {
        opt.selected = true;
      }
      folderSelect.appendChild(opt);
    });
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
      renderFolderOptions();

      if (Array.isArray(data.activeFolderGoals)) {
        goalsInput.value = data.activeFolderGoals.join("\n");
        const activeFolder = folders.find((f) => f.id === activeFolderId);
        if (activeFolder) {
          activeFolder.goals = data.activeFolderGoals;
        }
      }

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

      // Optionally update folders / activeFolderId from server response
      if (Array.isArray(data.folders)) {
        folders = data.folders;
      }
      if (data.activeFolderId) {
        activeFolderId = data.activeFolderId;
      }
      renderFolderOptions();

      renderMessage("assistant", data.reply || "(no reply)");
    } catch (err) {
      input.disabled = false;
      renderMessage(
        "assistant",
        "Network error talking to the coach."
      );
      console.error(err);
    }
  }

  // Folder creation
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

      renderFolderOptions();
    });
  }

  // Folder switching
  if (folderSelect) {
    folderSelect.addEventListener("change", () => {
      activeFolderId = folderSelect.value;
      const folder = folders.find((f) => f.id === activeFolderId);
      goalsInput.value = folder && folder.goals ? folder.goals.join("\n") : "";
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendMessage(text);
  });

  saveGoalsBtn.addEventListener("click", () => {
    alert("Goals saved for this folder. They’ll be sent with your next question.");
  });

  loadHistory();
})();
