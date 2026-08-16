"""
PhishShield — Unified Backend API & Web Server
Handles Email Phishing Detection (RAG + Agent) & Website URL Scanning (ML),
and serves the Web Dashboard locally at http://localhost:8000.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import re
import time

from rag_engine import RAGEngine
from agent import PhishingAgent
from website_scanner import WebsiteScanner

app = FastAPI(
    title="PhishShield Unified API",
    description="Dual-Engine Phishing Detection for Emails and Websites",
    version="2.0.0"
)

# CORS configuration for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines at startup
rag = RAGEngine()
agent = PhishingAgent()
scanner = WebsiteScanner(model_dir="pretrained_models")

# Path to the extension folder containing HTML/CSS/JS
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTENSION_DIR = os.path.join(BASE_DIR, "extension")

if os.path.exists(EXTENSION_DIR):
    app.mount("/static", StaticFiles(directory=EXTENSION_DIR), name="static")


# ── Web GUI Routes ────────────────────────────────────────────────────────────

@app.get("/")
@app.get("/dashboard")
async def serve_dashboard():
    dashboard_path = os.path.join(EXTENSION_DIR, "dashboard.html")
    if os.path.exists(dashboard_path):
        return FileResponse(dashboard_path)
    return {"message": "Dashboard HTML file not found in extension directory."}

@app.get("/popup")
async def serve_popup():
    popup_path = os.path.join(EXTENSION_DIR, "popup.html")
    if os.path.exists(popup_path):
        return FileResponse(popup_path)
    return {"message": "Popup HTML file not found in extension directory."}


# ── Pydantic Request / Response Schemas ────────────────────────────────────────

class EmailPayload(BaseModel):
    subject: Optional[str] = ""
    body: str
    sender: Optional[str] = ""
    headers: Optional[Dict[str, Any]] = {}

class WebsitePayload(BaseModel):
    url: str
    threshold: Optional[float] = 0.5

class EmailAnalysisResult(BaseModel):
    type: str = "email"
    is_phishing: bool
    risk_level: str
    risk_score: int
    links: List[str]
    suspicious_links: List[str]
    keywords_found: List[str]
    rag_match: str
    rag_similarity: float
    decision_reason: str
    xai_explanation: str
    latency_ms: float


# ── Email Heuristics ──────────────────────────────────────────────────────────

PHISHING_KEYWORDS = [
    "urgent", "immediately", "verify", "password", "bank",
    "account", "suspended", "click here", "login", "confirm",
    "update", "security alert", "unauthorized", "limited time",
    "act now", "winner", "prize", "free", "expire", "internship"
]

SUSPICIOUS_DOMAINS = [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl",
    "phish", "fake", "secure-login", "account-verify",
    "paypal-security", "apple-id", "signin-"
]

def extract_links(text: str) -> List[str]:
    return re.findall(r"https?://\S+", text)

def is_suspicious_link(url: str) -> bool:
    url_lower = url.lower()
    return any(domain in url_lower for domain in SUSPICIOUS_DOMAINS)

def find_keywords(text: str) -> List[str]:
    text_lower = text.lower()
    return [kw for kw in PHISHING_KEYWORDS if kw in text_lower]

def score_email(keywords: List[str], suspicious_links: List[str], sender: str) -> int:
    score = 0
    score += min(len(keywords) * 1, 5)
    score += min(len(suspicious_links) * 2, 4)
    if sender and any(d in sender.lower() for d in SUSPICIOUS_DOMAINS):
        score += 1
    return min(score, 10)


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=EmailAnalysisResult)
async def analyze_email(payload: EmailPayload):
    t0 = time.time()
    full_text = f"{payload.subject} {payload.body}"

    # 1. Extract structural heuristics
    links = extract_links(full_text)
    suspicious_links = [l for l in links if is_suspicious_link(l)]
    keywords = find_keywords(full_text)
    heuristic_score = score_email(keywords, suspicious_links, payload.sender)

    # 2. Run Neural SentenceTransformer + FAISS embedding inference
    rag_match, rag_similarity = rag.query(full_text)

    # 3. Agent synthesizes ML vectors and heuristics into calibrated verdict
    risk_level, is_phishing, reason, explanation, final_score = agent.decide(
        heuristic_score, rag_match, rag_similarity, keywords, suspicious_links
    )

    latency = round((time.time() - t0) * 1000, 2)

    return EmailAnalysisResult(
        type="email",
        is_phishing=is_phishing,
        risk_level=risk_level,
        risk_score=final_score,
        links=links,
        suspicious_links=suspicious_links,
        keywords_found=keywords,
        rag_match=rag_match,
        rag_similarity=round(rag_similarity, 3),
        decision_reason=reason,
        xai_explanation=explanation,
        latency_ms=latency
    )


@app.post("/analyze-website")
async def analyze_website(payload: WebsitePayload):
    try:
        result = scanner.scan_url(payload.url, threshold=payload.threshold)
        return {
            "type": "website",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scan URL: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "─" * 65)
    print("🛡️  PhishShield Extension Dashboard:")
    print("👉 chrome-extension://felclkchhakcbmnfnpigmoeophieioii/dashboard.html")
    print("─" * 65 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)