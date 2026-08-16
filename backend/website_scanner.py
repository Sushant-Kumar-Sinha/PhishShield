"""
PhishShield — Website Phishing Scanner (URLBERT + Heuristic Fallback)
"""

import re
import requests
from urllib.parse import urlparse
from typing import Dict, Any
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch


class WebsiteScanner:
    def __init__(self, model_dir: str = "pretrained_models"):
        print("[Scanner] Loading URLBERT phishing classifier...")
        try:
            # Try to load the smaller URLBERT model
            self.model_name = "CrabInHoney/urlbert-tiny-v4-phishing-classifier"
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self.model.eval()
            self.use_ml = True
            print("[Scanner] ✅ URLBERT model loaded successfully")
        except Exception as e:
            print(f"[Scanner] ⚠️ Could not load URLBERT: {e}")
            print("[Scanner] Falling back to heuristic-only mode")
            self.use_ml = False

        # Heuristic rules as fallback
        self.suspicious_keywords = [
            "login", "signin", "verify", "account", "secure", "update", "banking",
            "password", "credential", "wallet", "support", "authenticate", "confirm"
        ]
        self.suspicious_domains = [
            "bit.ly", "tinyurl.com", "t.co", "goo.gl", "phish", "fake",
            "secure-login", "account-verify", "paypal-security", "apple-id", "signin-"
        ]
        self.trusted_domains = [
            "google.com", "github.com", "wikipedia.org", "openai.com",
            "microsoft.com", "cloudflare.com", "claude.ai", "netcraft.com"
        ]

    def scan_url(self, url: str, threshold: float = 0.5) -> Dict[str, Any]:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # 1. Trusted Domain Whitelist Bypass
        if any(domain.endswith(trusted) for trusted in self.trusted_domains):
            return {
                "url": url,
                "is_phishing": False,
                "risk_level": "Safe",
                "risk_score": 0,
                "phishing_probability": 1.0,
                "verdict": "LEGITIMATE",
                "engine_used": "Trusted Domain Authority"
            }

        # 2. ML-based prediction if available
        if self.use_ml:
            try:
                inputs = self.tokenizer(
                    url,
                    truncation=True,
                    padding=True,
                    max_length=128,
                    return_tensors="pt"
                )
                with torch.no_grad():
                    outputs = self.model(**inputs)
                    probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
                    # Assuming class 1 = phishing
                    prob = probabilities[0][1].item()
                
                risk_score = round(prob * 10)
                
                # 4-Tier Classification
                if risk_score >= 6 or prob >= 0.60:
                    risk_level = "High Risk"
                    is_phishing = True
                elif risk_score >= 4 or prob >= 0.40:
                    risk_level = "Medium Risk"
                    is_phishing = True
                elif risk_score >= 2 or prob >= 0.20:
                    risk_level = "Low Risk"
                    is_phishing = False
                else:
                    risk_level = "Safe"
                    is_phishing = False

                return {
                    "url": url,
                    "is_phishing": is_phishing,
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "phishing_probability": round(prob * 100, 2),
                    "verdict": "PHISHING" if is_phishing else "LEGITIMATE",
                    "engine_used": "URLBERT ML Classifier"
                }
            except Exception as e:
                print(f"[Scanner] ⚠️ ML prediction failed: {e}")
                print("[Scanner] Falling back to heuristics")

        # 3. Heuristic Fallback
        return self._heuristic_scan(url, domain)

    def _heuristic_scan(self, url: str, domain: str) -> Dict[str, Any]:
        """Fallback heuristic scanner when ML is not available"""
        score = 0.0

        # Fetch HTML
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            res = requests.get(url, timeout=6, headers=headers)
            html = res.text.lower()
        except Exception:
            html = ""

        # URL Heuristics
        if any(bad in domain for bad in self.suspicious_domains):
            score += 0.45
        if re.search(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", domain):
            score += 0.35
        if "@" in url:
            score += 0.25
        if len(url) > 85:
            score += 0.10

        # DOM / HTML Heuristics
        if html:
            has_password = bool(re.search(r'<input[^>]+type=["\']password["\']', html))
            form_actions = re.findall(r'<form[^>]+action=["\']([^"\']+)["\']', html)
            external_forms = sum(1 for act in form_actions if act.startswith("http") and domain not in act)
            matched_kw = [kw for kw in self.suspicious_keywords if kw in html]

            if has_password and (any(b in domain for b in self.suspicious_domains) or external_forms > 0):
                score += 0.40
            if external_forms > 0:
                score += 0.25
            if len(matched_kw) >= 2:
                score += min(len(matched_kw) * 0.08, 0.30)

        prob = min(max(score, 0.02), 0.99)
        risk_score = round(prob * 10)

        # 4-Tier Classification
        if risk_score >= 6 or prob >= 0.60:
            risk_level = "High Risk"
            is_phishing = True
        elif risk_score >= 4 or prob >= 0.40:
            risk_level = "Medium Risk"
            is_phishing = True
        elif risk_score >= 2 or prob >= 0.20:
            risk_level = "Low Risk"
            is_phishing = False
        else:
            risk_level = "Safe"
            is_phishing = False

        return {
            "url": url,
            "is_phishing": is_phishing,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "phishing_probability": round(prob * 100, 2),
            "verdict": "PHISHING" if is_phishing else "LEGITIMATE",
            "engine_used": "Heuristic Fallback (ML unavailable)"
        }