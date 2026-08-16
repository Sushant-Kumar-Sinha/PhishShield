/**
 * PhishShield — dashboard.js
 * Dual-Engine Version: Email Text Analysis + Direct Website URL ML Scanning
 */

const API_BASE = typeof window !== "undefined" && window.location.origin.includes("localhost:8000")
  ? "" 
  : "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
  // ── Session timer ─────────────────────────────────────────────────────────
  const sessionEl = document.getElementById("sessionTime");
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    if (sessionEl) sessionEl.textContent = `${h}:${m}:${s}`;
  }, 1000);

  // ── Close button ──────────────────────────────────────────────────────────
  const closeBtn = document.getElementById("closeDashBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => window.close());

  // ── Search ────────────────────────────────────────────────────────────────
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", filterHistory);

  // ── Clear All ─────────────────────────────────────────────────────────────
  const clearBtn = document.getElementById("clearAllBtn");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmCancel = document.getElementById("confirmCancel");
  const confirmOk = document.getElementById("confirmOk");
  const confirmCountEl = document.getElementById("confirmCount");

  if (clearBtn && confirmOverlay) {
    clearBtn.addEventListener("click", () => {
      chrome.storage.local.get("scan_history", (res) => {
        const count = (res.scan_history || []).length;
        if (confirmCountEl) confirmCountEl.textContent = count;
        confirmOverlay.classList.add("confirm-visible");
      });
    });
  }
  if (confirmCancel) confirmCancel.addEventListener("click", () => confirmOverlay.classList.remove("confirm-visible"));
  if (confirmOk) {
    confirmOk.addEventListener("click", () => {
      chrome.storage.local.set({ scan_history: [] }, () => {
        confirmOverlay.classList.remove("confirm-visible");
        loadDashboardData();
        showToast("All scan history cleared successfully", "success");
      });
    });
  }
  if (confirmOverlay) {
    confirmOverlay.addEventListener("click", (e) => {
      if (e.target === confirmOverlay) confirmOverlay.classList.remove("confirm-visible");
    });
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  loadDashboardData();

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.scan_history) loadDashboardData();
    });
  }

  // ── URL ANALYZE FEATURE ───────────────────────────────────────────────────
  const analyzeUrlBtn = document.getElementById("analyzeUrlBtn");
  const urlInput = document.getElementById("urlInput");
  const urlResult = document.getElementById("urlAnalysisResult");

  if (analyzeUrlBtn && urlInput && urlResult) {
    analyzeUrlBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();

      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        showUrlResult("Please enter a valid URL starting with http:// or https://", "error");
        return;
      }

      analyzeUrlBtn.disabled = true;
      analyzeUrlBtn.innerHTML = `Analyzing...`;

      const isWebmail = url.includes("mail.google.com") || url.includes("outlook");

      try {
        let payload = {};
        let endpoint = `${API_BASE}/analyze`;
        let displaySubject = url;
        let displaySender = "Website Target";

        if (isWebmail) {
          const tab = await chrome.tabs.create({ url: url, active: false });

          await new Promise((resolve) => {
            const listener = (tabId, changeInfo) => {
              if (tabId === tab.id && changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });

          await new Promise((r) => setTimeout(r, 1800));

          let emailData;
          try {
            emailData = await chrome.tabs.sendMessage(tab.id, { action: "extractEmail" });
          } catch {
            const [result] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                let sender = "";
                const senderEl = document.querySelector("span.gD") || 
                                document.querySelector(".gD") || 
                                document.querySelector("span[email]");
                if (senderEl) {
                  sender = senderEl.getAttribute("email") || senderEl.innerText || "";
                }
                const subject = document.querySelector("h2.hP")?.innerText || 
                                document.querySelector("[data-testid='subject']")?.innerText || 
                                document.title;
                return {
                  body: document.body.innerText.slice(0, 4000),
                  subject: subject || "No Subject",
                  sender: sender || ""
                };
              }
            });
            emailData = result.result;
          }

          payload = emailData;
          displaySubject = emailData.subject || "No Subject";
          displaySender = emailData.sender || "Unknown";
          setTimeout(() => chrome.tabs.remove(tab.id), 1200);

        } else {
          endpoint = `${API_BASE}/analyze-website`;
          payload = { url: url, threshold: 0.5 };
          try {
            displaySubject = new URL(url).hostname;
          } catch {
            displaySubject = url;
          }
          displaySender = url;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Analysis failed");
        const data = await res.json();

        // Standardize website score if risk_level is missing
        if (data.type === "website" && !data.risk_level) {
          const score = Math.round((data.phishing_probability / 100) * 10);
          data.risk_score = score;
          data.risk_level = score >= 6 ? "High Risk" : score >= 4 ? "Medium Risk" : score >= 2 ? "Low Risk" : "Safe";
        }

        chrome.storage.local.get("scan_history", (resStorage) => {
          const history = resStorage.scan_history || [];
          history.unshift({
            ...data,
            subject: displaySubject,
            sender: displaySender,
            timestamp: Date.now(),
            source: isWebmail ? "webmail" : "website"
          });
          chrome.storage.local.set({ scan_history: history.slice(0, 100) });
        });

        const rl = (data.risk_level || "Safe").toLowerCase();
        const resultType = rl.includes("high") ? "high" : rl.includes("medium") ? "medium" : rl.includes("low") ? "low" : "safe";

        showUrlResult(`
          <strong>Analysis Complete</strong><br>
          <strong>Classification:</strong> <span class="risk-badge risk-${resultType}">${data.risk_level}</span> (${data.risk_score}/10 Score)<br>
          <strong>Target:</strong> ${displaySubject}<br>
          <strong>Verdict:</strong> ${data.is_phishing ? "⚠️ Threat Detected" : "🛡️ Legitimate / Safe"}
        `, resultType);

        loadDashboardData();

      } catch (err) {
        console.error(err);
        showUrlResult("❌ Failed to analyze. Make sure backend is running on port 8000.", "error");
      } finally {
        analyzeUrlBtn.disabled = false;
        analyzeUrlBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Analyze URL
        `;
      }
    });

    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") analyzeUrlBtn.click();
    });
  }
});

// ── Core Dashboard Functions ────────────────────────────────────────────────
let currentHistory = [];

function loadDashboardData() {
  chrome.storage.local.get("scan_history", (res) => {
    currentHistory = res.scan_history || [];
    updateStats(currentHistory);
    updateThreatBreakdown(currentHistory);
    renderHistoryTable(currentHistory);
  });
}

function updateStats(history) {
  const total = history.length;
  const phishing = history.filter(h => h.is_phishing === true || (h.risk_level && (h.risk_level.toLowerCase().includes("high") || h.risk_level.toLowerCase().includes("medium")))).length;
  const safe = total - phishing;
  const avg = total > 0 ? (history.reduce((sum, h) => sum + (parseFloat(h.risk_score) || 0), 0) / total).toFixed(1) : "—";

  document.getElementById("totalScans").textContent = total || "—";
  document.getElementById("phishingCount").textContent = phishing || "0";
  document.getElementById("safeCount").textContent = safe || "0";
  document.getElementById("avgScore").textContent = avg;

  const barTotal = document.getElementById("barTotal");
  const barPhish = document.getElementById("barPhish");
  const barSafe = document.getElementById("barSafe");
  const barAvg = document.getElementById("barAvg");

  if (total > 0) {
    if (barTotal) barTotal.style.width = "100%";
    if (barPhish) barPhish.style.width = `${Math.round((phishing / total) * 100)}%`;
    if (barSafe) barSafe.style.width = `${Math.round((safe / total) * 100)}%`;
    if (barAvg) barAvg.style.width = `${Math.round((parseFloat(avg) / 10) * 100)}%`;
  }
}

function updateThreatBreakdown(history) {
  const total = history.length || 1;
  const critical = history.filter(h => h.risk_level && h.risk_level.toLowerCase().includes("high")).length;
  const medium = history.filter(h => h.risk_level && h.risk_level.toLowerCase().includes("medium")).length;
  const low = history.filter(h => h.risk_level && h.risk_level.toLowerCase().includes("low")).length;
  const safe = history.filter(h => !h.risk_level || h.risk_level.toLowerCase().includes("safe")).length;

  const pCritical = Math.round((critical / total) * 100);
  const pMedium = Math.round((medium / total) * 100);
  const pLow = Math.round((low / total) * 100);
  const pSafe = Math.round((safe / total) * 100);

  document.getElementById("bdCritical").style.width = `${pCritical}%`;
  document.getElementById("pctCritical").textContent = `${pCritical}%`;
  document.getElementById("bdMedium").style.width = `${pMedium}%`;
  document.getElementById("pctMedium").textContent = `${pMedium}%`;
  document.getElementById("bdLow").style.width = `${pLow}%`;
  document.getElementById("pctLow").textContent = `${pLow}%`;
  document.getElementById("bdSafe").style.width = `${pSafe}%`;
  document.getElementById("pctSafe").textContent = `${pSafe}%`;
}

function renderHistoryTable(history, searchTerm = "") {
  const tbody = document.getElementById("historyBody");
  const emptyState = document.getElementById("emptyState");
  const countBadge = document.getElementById("countBadge");
  if (!tbody || !emptyState || !countBadge) return;

  tbody.innerHTML = "";
  let filtered = history;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = history.filter(h =>
      (h.subject || "").toLowerCase().includes(term) ||
      (h.sender || "").toLowerCase().includes(term)
    );
  }
  countBadge.textContent = `${filtered.length} records`;

  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    return;
  } else {
    emptyState.style.display = "none";
  }

  filtered.forEach((record) => {
    const tr = document.createElement("tr");
    const dateStr = record.timestamp ? new Date(record.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(",", " •") : "—";
    const riskLevel = record.risk_level || "Safe";
    const score = record.risk_score !== undefined ? record.risk_score : "—";
    const subject = record.subject || "—";
    const sender = record.sender || "—";

    let riskClass = "risk-safe";
    const rl = riskLevel.toLowerCase();
    if (rl.includes("high")) riskClass = "risk-high";
    else if (rl.includes("medium")) riskClass = "risk-medium";
    else if (rl.includes("low")) riskClass = "risk-low";

    let scoreClass = riskClass === "risk-high" ? "score-high" : riskClass === "risk-medium" ? "score-medium" : riskClass === "risk-low" ? "score-low" : "score-safe";

    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted);">${dateStr}</td>
      <td title="${subject}">${subject.length > 42 ? subject.slice(0,42)+"…" : subject}</td>
      <td title="${sender}">${sender.length > 28 ? sender.slice(0,28)+"…" : sender}</td>
      <td><span class="risk-badge ${riskClass}">${riskLevel}</span></td>
      <td><span class="score-val ${scoreClass}">${score}/10</span></td>
    `;
    tr.addEventListener("click", () => {
      const detail = `Subject: ${subject}\nSender: ${sender}\nRisk: ${riskLevel} (${score}/10)`;
      navigator.clipboard?.writeText(detail).then(() => showToast("Details copied!", "success"));
    });
    tbody.appendChild(tr);
  });
}

function filterHistory() {
  const term = document.getElementById("searchInput")?.value || "";
  renderHistoryTable(currentHistory, term);
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-visible toast-${type}`;
  setTimeout(() => toast.classList.remove("toast-visible"), 2400);
}

function showUrlResult(message, type = "safe") {
  const urlResult = document.getElementById("urlAnalysisResult");
  if (!urlResult) return;
  urlResult.innerHTML = message;
  urlResult.style.display = "block";
  urlResult.className = `url-analysis-result result--${type}`;
  if (type === "safe" || type === "low") {
    setTimeout(() => { urlResult.style.display = "none"; }, 8000);
  }
}