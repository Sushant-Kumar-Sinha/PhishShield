/**
 * PhishShield — popup.js
 */

const API_BASE = "http://localhost:8000";

const statusDot    = document.getElementById("statusDot");
const emailPreview = document.getElementById("emailPreview");
const analyzeBtn   = document.getElementById("analyzeBtn");
const loadingState = document.getElementById("loadingState");
const resultPanel  = document.getElementById("resultPanel");

const riskBadge   = document.getElementById("riskBadge");
const scoreValue  = document.getElementById("scoreValue");
const gaugeLabel  = document.getElementById("gaugeLabel");
const linksVal    = document.getElementById("linksVal");
const keywordsVal = document.getElementById("keywordsVal");
const ragVal      = document.getElementById("ragVal");
const xaiText     = document.getElementById("xaiText");

function drawGauge(score) {
  const canvas = document.getElementById("gaugeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = 240, H = 120;
  const cx = W / 2, cy = H - 10;
  const R = 90;

  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#21262d";
  ctx.stroke();

  const fraction = Math.min(Math.max(score / 10, 0), 1);
  const color = score >= 6 ? "#ff5468" : score >= 4 ? "#ffb238" : score >= 2 ? "#1ce8c9" : "#33e59a";
  const endAngle = Math.PI + fraction * Math.PI;

  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, endAngle);
  ctx.lineWidth = 14;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.stroke();

  const nx = cx + R * Math.cos(endAngle);
  const ny = cy + R * Math.sin(endAngle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = "#e6edf3";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#e6edf3";
  ctx.fill();
}

function setStatus(state, text) {
  if (!statusDot) return;
  const dot   = statusDot.querySelector(".dot");
  const label = statusDot.querySelector(".status-text");
  if (dot) dot.className = `dot dot--${state}`;
  if (label) label.textContent = text;
}

function renderResult(data) {
  loadingState.style.display = "none";
  analyzeBtn.style.display   = "flex";
  resultPanel.style.display  = "flex";

  const level = data.risk_level?.toLowerCase() || "safe";

  riskBadge.textContent = data.risk_level || "Safe";
  riskBadge.className = `risk-badge badge--${
    level.includes("high") ? "high" :
    level.includes("medium") ? "medium" :
    level.includes("low") ? "low" : "safe"
  }`;

  scoreValue.textContent = `${data.risk_score ?? 0}/10`;
  gaugeLabel.textContent = data.risk_level || "Safe";

  drawGauge(data.risk_score ?? 0);

  linksVal.textContent = data.links ? `${data.links.length} total, ${data.suspicious_links?.length || 0} suspicious` : (data.url ? "1 URL" : "0");
  keywordsVal.textContent = data.keywords_found?.length ? data.keywords_found.slice(0, 3).join(", ") : "None";
  ragVal.textContent = data.rag_similarity !== undefined ? `${(data.rag_similarity * 100).toFixed(0)}% match` : (data.phishing_probability ? `${data.phishing_probability}%` : "—");
  xaiText.textContent = data.xai_explanation || (data.is_phishing ? "Target matches phishing patterns." : "Page appears normal.");

  const isDanger = level.includes("high") || level.includes("medium");
  setStatus(isDanger ? "danger" : "safe", data.is_phishing ? "Threat Detected" : "All Clear");
}

async function analyzeTarget() {
  try {
    setStatus("scanning", "Scanning…");
    analyzeBtn.style.display   = "none";
    loadingState.style.display = "flex";
    resultPanel.style.display  = "none";

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.id) throw new Error("No active tab");

    let pageData;
    try {
      pageData = await chrome.tabs.sendMessage(tab.id, { action: "extractPage" });
    } catch {
      pageData = {
        type: tab.url.includes("mail.google.com") || tab.url.includes("outlook") ? "email" : "website",
        url: tab.url,
        subject: tab.title,
        body: ""
      };
    }

    let endpoint = `${API_BASE}/analyze`;
    let payload = {};

    if (pageData.type === "website" || (!pageData.sender && !tab.url.includes("mail"))) {
      endpoint = `${API_BASE}/analyze-website`;
      payload = { url: tab.url, threshold: 0.5 };
      emailPreview.innerHTML = `
        <p style="font-size:11px;color:#8b949e">Target Website</p>
        <p style="font-size:12px;font-weight:600;word-break:break-all">${tab.url}</p>
      `;
    } else {
      payload = {
        subject: pageData.subject || tab.title,
        body: pageData.body || "",
        sender: pageData.sender || ""
      };
      emailPreview.innerHTML = `
        <p style="font-size:11px;color:#8b949e">${pageData.sender || "Webmail Sender"}</p>
        <p style="font-size:12px;font-weight:600">${pageData.subject || tab.title}</p>
      `;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
    const data = await res.json();

    // Standardize website score if risk_level is missing
    if (data.type === "website" && !data.risk_level) {
      const score = Math.round((data.phishing_probability / 100) * 10);
      data.risk_score = score;
      data.risk_level = score >= 6 ? "High Risk" : score >= 4 ? "Medium Risk" : score >= 2 ? "Low Risk" : "Safe";
    }

    renderResult(data);

    chrome.storage.local.get("scan_history", (resStorage) => {
      const history = resStorage.scan_history || [];
      history.unshift({
        ...data,
        subject: pageData.subject || tab.title,
        sender: pageData.sender || tab.url,
        timestamp: Date.now()
      });
      chrome.storage.local.set({ scan_history: history.slice(0, 100) });
    });

    chrome.runtime.sendMessage({
      action: "analysisComplete",
      tabId: tab.id,
      riskLevel: data.risk_level,
      isPhishing: data.is_phishing,
      reason: data.decision_reason || (data.is_phishing ? "Phishing threat detected" : "Safe")
    }).catch(() => {});

  } catch (err) {
    console.error(err);
    loadingState.style.display = "none";
    analyzeBtn.style.display   = "flex";
    setStatus("idle", "Error");
    emailPreview.innerHTML = `
      <p style="color:#f85149">
        ⚠️ Backend not reachable.<br>Ensure FastAPI server is running on port 8000.
      </p>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (analyzeBtn) analyzeBtn.addEventListener("click", analyzeTarget);

  document.getElementById("fbYes")?.addEventListener("click", () => {
    emailPreview.innerHTML = `<p>✓ Feedback sent</p>`;
  });
  document.getElementById("fbNo")?.addEventListener("click", () => {
    emailPreview.innerHTML = `<p>✓ Feedback sent</p>`;
  });

  document.getElementById("dashboardLink")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
});