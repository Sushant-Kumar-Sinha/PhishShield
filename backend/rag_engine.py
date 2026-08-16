"""
PhishShield — Email Phishing Classifier
Uses JellyPhish BERT model for email phishing detection
"""

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import numpy as np


class RAGEngine:
    """
    Phishing email classifier using fine-tuned BERT model.
    """

    def __init__(self, model_name: str = "RamzyBakir/jellyphish-bert-base-mail"):
        print("[RAG] Loading JellyPhish email classifier...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        print("[RAG] ✅ Model loaded successfully")

    def query(self, text: str, top_k: int = 1) -> tuple[str, float]:
        """
        Return (classification_result, confidence_score)
        """
        if not text.strip():
            return "No content to evaluate", 0.0

        # Tokenize and predict
        inputs = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors="pt"
        )
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
            confidence = probabilities[0][1].item()  # Probability of phishing class
            
        # Get prediction
        predicted_class = torch.argmax(outputs.logits, dim=-1).item()
        label = "Phishing" if predicted_class == 1 else "Legitimate"
        
        return label, confidence

    def add_document(self, text: str):
        """Not used for classifier - kept for compatibility"""
        pass

    def doc_count(self) -> int:
        return 1