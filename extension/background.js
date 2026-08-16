/**
 * PhishShield — background.js (Service Worker) v1.2
 * Handles extension lifecycle, badge updates, and inter-component messaging.
 *
 * NOTE: Make sure your popup saves scan records with these exact field names:
 *   subject      — email subject line
 *   sender       — from address
 *   risk_level   — "High Risk" | "Medium Risk" | "Low Risk" | "Safe"
 *   risk_score   — number 0–10
 *   is_phishing  — boolean
 *   timestamp    — Date.now() milliseconds
 *   xai_explanation — AI explanation string (optional)
 *   rag_match    — RAG match string (optional)
 */

"use strict";

// ── Badge config ───────────────────────────────────────────────────────────────
const BADGE_CONFIG = {
  "High Risk":   { text: "!",  color: "#dc2626" },
  "Medium Risk": { text: "!!", color: "#d97706" },
  "Low Risk":    { text: "▲",  color: "#1e6aff" },
  "Safe":        { text: "✓",  color: "#10b981" },
};

// ── Badge helpers ──────────────────────────────────────────────────────────────

function setBadge(tabId, riskLevel) {
  const cfg = BADGE_CONFIG[riskLevel];
  if (!cfg) { clearBadge(tabId); return; }
  chrome.action.setBadgeText({ tabId, text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
  chrome.action.setBadgeTextColor?.({ tabId, color: "#ffffff" });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: "" });
}

// ── Risk severity helper ───────────────────────────────────────────────────────

function shouldWarn(riskLevel) {
  return riskLevel === "High Risk" || riskLevel === "Medium Risk";
}

// ── Message listener ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Popup → background: analysis complete → update badge + optionally inject banner
  if (msg.action === "analysisComplete") {
    const tabId = msg.tabId;
    setBadge(tabId, msg.riskLevel);

    if (msg.isPhishing && shouldWarn(msg.riskLevel)) {
      chrome.tabs.sendMessage(tabId, {
        action:     "showWarning",
        riskLevel:  msg.riskLevel,
        reason:     msg.reason,
        badgeColor: BADGE_CONFIG[msg.riskLevel]?.color ?? "#dc2626",
      }).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }

  // Clear badge on explicit request
  if (msg.action === "clearBadge") {
    clearBadge(sender.tab?.id);
    sendResponse({ ok: true });
    return true;
  }

  // Popup requests the latest history entry count for the badge label
  if (msg.action === "getHistoryCount") {
    chrome.storage.local.get("scan_history", (res) => {
      const count = (res.scan_history || []).length;
      sendResponse({ count });
    });
    return true;
  }
});

// ── Tab lifecycle ──────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearBadge(tabId);
  }
});

// ── Storage: prune history to 200 entries ──────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.scan_history) return;
  const history = changes.scan_history.newValue || [];
  if (history.length > 200) {
    const pruned = history.slice(history.length - 200);
    chrome.storage.local.set({ scan_history: pruned });
  }
});

// ── Install / Update ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[PhishShield] Installed — ready to protect your inbox. 🛡");
    chrome.storage.local.set({ scan_history: [] });
  } else if (reason === "update") {
    console.log("[PhishShield] Updated to latest version.");
  }
});
