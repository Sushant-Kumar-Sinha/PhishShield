"""
PhishShield — AI Agent (Decision + XAI)
Synthesizes ML model confidence and heuristics into a calibrated verdict.
"""

from typing import Tuple, List


class PhishingAgent:
    # Decision & Calibration Thresholds
    HIGH_RAG_SIMILARITY   = 0.75
    MEDIUM_RAG_SIMILARITY = 0.50
    LOW_RAG_SIMILARITY    = 0.25

    def decide(
        self,
        heuristic_score: int,
        rag_match: str,
        rag_similarity: float,
        keywords: List[str],
        suspicious_links: List[str],
    ) -> Tuple[str, bool, str, str, int]:
        """
        Calculates final score and verdict from ML model confidence + Heuristics.
        """
        # ML confidence is now a probability (0.0 - 1.0) from JellyPhish
        ml_score = round(rag_similarity * 10)
        
        # Combine ML score with heuristic triggers
        combined_score = max(ml_score, heuristic_score)
        if rag_similarity >= self.MEDIUM_RAG_SIMILARITY and (keywords or suspicious_links):
            combined_score = min(combined_score + 1, 10)

        final_score = min(max(combined_score, 0), 10)

        # 4-Tier Risk Classification
        if final_score >= 6 or rag_similarity >= self.HIGH_RAG_SIMILARITY:
            risk_level = "High Risk"
            is_phishing = True
        elif final_score >= 4 or rag_similarity >= self.MEDIUM_RAG_SIMILARITY:
            risk_level = "Medium Risk"
            is_phishing = True
        elif final_score >= 2 or rag_similarity >= self.LOW_RAG_SIMILARITY:
            risk_level = "Low Risk"
            is_phishing = False
        else:
            risk_level = "Safe"
            is_phishing = False

        # Build decision reason
        reasons = []
        if rag_similarity >= self.MEDIUM_RAG_SIMILARITY:
            reasons.append(f"ML model predicts phishing with {rag_similarity:.0%} confidence")
        if keywords:
            reasons.append(f"{len(keywords)} trigger keyword(s)")
        if suspicious_links:
            reasons.append(f"{len(suspicious_links)} suspicious link(s)")

        reason = "; ".join(reasons) if reasons else "no anomalous patterns identified"

        # Generate Explainable AI (XAI) output
        xai_lines = [
            f"📊 Composite Risk Score: {final_score}/10 → Classified as '{risk_level}'.",
            f"🧠 ML Model Confidence: {rag_similarity:.1%} probability of phishing.",
        ]

        if keywords:
            quoted = ', '.join(f'"{k}"' for k in keywords[:4])
            xai_lines.append(f"🔑 Trigger Keywords: {quoted}.")
        else:
            xai_lines.append("🔑 Trigger Keywords: None detected.")

        if suspicious_links:
            xai_lines.append(f"🔗 Detected {len(suspicious_links)} high-risk link destination(s).")
        else:
            xai_lines.append("🔗 Links: All URLs verified clean.")

        if is_phishing:
            xai_lines.append("⚠️ Recommendation: Do not interact with links or submit credentials.")
        else:
            xai_lines.append("✅ Recommendation: Content verified safe.")

        return risk_level, is_phishing, reason, "\n".join(xai_lines), final_score