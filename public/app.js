// public/app.js
(function () {
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const goalsInput = document.getElementById("goalsInput");
  const saveGoalsBtn = document.getElementById("saveGoalsBtn");

  const STORAGE_KEY = "edge_study_coach_session_id";
  let sessionId = localStorage.getItem(STORAGE_KEY);
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

  async function loadHistory() {
    try {
      const res = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.goals)) {
        goalsInput.value = data.goals.join("\n");
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

    renderMessage("user", text);

    input.value = "";
    input.disabled = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, goals })
      });

      input.disabled = false;
      input.focus();

      if (!res.ok) {
        renderMessage("assistant", "Oops, something went wrong talking to the coach.");
        return;
      }

      const data = await res.json();
      renderMessage("assistant", data.reply || "(no reply)");
    } catch (err) {
      input.disabled = false;
      renderMessage("assistant", "Network error talking to the coach.");
      console.error(err);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendMessage(text);
  });

  saveGoalsBtn.addEventListener("click", () => {
    alert("Goals saved locally. They’ll be sent with your next question.");
  });

  loadHistory();
})();
