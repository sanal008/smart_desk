from __future__ import annotations

import threading
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

SENTIMENT_COMPOUND_THRESHOLDS = (0.05, -0.05)


class ModelNotTrainedError(RuntimeError):
    pass


class TriageEngine:
    _instance: TriageEngine | None = None
    _lock = threading.Lock()

    def __init__(self, artifacts_dir: Path | None = None):
        self.artifacts_dir = Path(artifacts_dir or settings.ML_ARTIFACTS_DIR)
        self._payload = None
        self._vader = SentimentIntensityAnalyzer()

    @classmethod
    def instance(cls) -> TriageEngine:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._instance = None

    @property
    def artifact_file(self) -> Path:
        return self.artifacts_dir / "triage_models.joblib"

    @property
    def metrics_file(self) -> Path:
        return self.artifacts_dir / "metrics.json"

    def load(self):
        if self._payload is None:
            if not self.artifact_file.exists():
                raise ModelNotTrainedError(
                    f"No trained artifacts at {self.artifact_file}. "
                    "Run `python ml/train.py` or `manage.py train_models` first."
                )
            self._payload = joblib.load(self.artifact_file)
        return self._payload

    @property
    def version(self) -> str:
        return self.load().get("version", "unknown")

    @property
    def is_ready(self) -> bool:
        return self.artifact_file.exists()

    @staticmethod
    def explain(pipeline, text: str, label: str, top_n: int = 6) -> list[dict]:
        vectorizer = pipeline.named_steps["tfidf"]
        clf = pipeline.named_steps["clf"]
        X = vectorizer.transform([text])
        if label not in clf.classes_:
            return []
        class_idx = list(clf.classes_).index(label)
        coefs = clf.coef_[class_idx]
        contributions = np.asarray(X.multiply(coefs).todense()).ravel()
        feature_names = vectorizer.get_feature_names_out()
        top = np.argsort(contributions)[::-1][:top_n]
        return [
            {"feature": str(feature_names[i]), "weight": round(float(contributions[i]), 4)}
            for i in top
            if contributions[i] > 0
        ]

    def predict_with_confidence(self, pipeline, text: str) -> tuple[str, float, dict]:
        proba = pipeline.predict_proba([text])[0]
        classes = list(pipeline.classes_)
        idx = int(np.argmax(proba))
        label = str(classes[idx])
        confidence = float(proba[idx])
        all_probs = {
            str(c): round(float(p), 4) for c, p in sorted(zip(classes, proba, strict=False), key=lambda x: -x[1])
        }
        return label, confidence, all_probs

    def classify_category(self, text: str) -> dict:
        payload = self.load()
        label, confidence, probs = self.predict_with_confidence(payload["category"], text)
        return {
            "label": label,
            "confidence": round(confidence, 4),
            "probabilities": probs,
            "explanation": {"top_features": self.explain(payload["category"], text, label)},
            "model_version": payload["version"],
        }

    def predict_priority(self, text: str, tier: str = "standard") -> dict:
        payload = self.load()
        boosted = self._priority_features(text, tier)
        label, confidence, probs = self.predict_with_confidence(payload["priority"], boosted)
        return {
            "label": label,
            "confidence": round(confidence, 4),
            "probabilities": probs,
            "explanation": {
                "top_features": self.explain(payload["priority"], boosted, label),
                "customer_tier": tier,
            },
            "model_version": payload["version"],
        }

    def route_team(self, text: str, category: str | None = None) -> dict:
        payload = self.load()
        enriched = f"cat_{category or 'unknown'} {text}"
        label, confidence, probs = self.predict_with_confidence(payload["routing"], enriched)
        return {
            "label": label,
            "confidence": round(confidence, 4),
            "probabilities": probs,
            "explanation": {"driven_by_category": category},
            "model_version": payload["version"],
        }

    def analyze_sentiment(self, text: str) -> dict:
        scores = self._vader.polarity_scores(text)
        compound = scores["compound"]
        positive_thresh, negative_thresh = SENTIMENT_COMPOUND_THRESHOLDS
        if compound >= positive_thresh:
            label = "positive"
        elif compound <= negative_thresh:
            label = "negative"
        else:
            label = "neutral"
        confidence = min(abs(compound) * 1.6, 1.0)
        return {
            "label": label,
            "confidence": round(confidence, 4),
            "explanation": {
                "compound": compound,
                "positive": scores["pos"],
                "negative": scores["neg"],
                "neutral": scores["neu"],
                "method": "VADER lexicon",
            },
            "model_version": "vader-3.3.2",
        }

    def summarize(self, text: str, category: str | None = None) -> dict:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        subject = lines[0] if lines else text
        body = " ".join(lines[1:]) if len(lines) > 1 else text
        sentences = [s.strip() for s in body.replace("!", ".").replace("?", ".").split(".") if len(s.strip()) > 25]
        picked = sentences[:2]
        summary = subject if not picked else f"{subject}. {' '.join(picked)}."
        if category and len(summary) < 90:
            summary += f" Filed under {category}."
        return {
            "label": summary[:400],
            "confidence": 0.75 if picked else 0.5,
            "explanation": {"method": "extractive", "sentences_used": len(picked)},
            "model_version": "extractive-1",
        }

    def similar_resolved(self, text: str, k: int = 3) -> list[dict]:
        from sklearn.metrics.pairwise import cosine_similarity

        payload = self.load()
        cases = payload.get("resolved_cases") or []
        matrix = payload.get("resolved_matrix")
        if not cases or matrix is None:
            return []
        vec = payload["retrieval_vectorizer"].transform([text])
        sims = cosine_similarity(vec, matrix)[0]
        top = np.argsort(sims)[::-1][:k]
        return [
            {
                "category": cases[i]["category"],
                "subject": cases[i]["subject"],
                "resolution_note": cases[i]["resolution_note"],
                "similarity": round(float(sims[i]), 4),
            }
            for i in top
            if sims[i] > 0.05
        ]

    def draft_reply(
        self,
        text: str,
        category: str | None = None,
        sentiment: str = "neutral",
        requester_name: str = "there",
        agent_name: str = "Support",
    ) -> dict:
        similar = self.similar_resolved(text, k=1)
        retrieved = similar[0] if similar else None

        tone_openers = {
            "negative": "I'm sorry for the frustration and disruption this has caused.",
            "positive": "Thanks for the kind words and for taking the time to write in.",
            "neutral": "Thanks for getting in touch — I'm happy to help.",
        }
        opener = tone_openers.get(sentiment, tone_openers["neutral"])

        if retrieved and retrieved["resolution_note"]:
            body = (
                f"I've looked into this and here's what I found. {retrieved['resolution_note']} "
                "I've also linked a similar case we resolved so you can see the steps we took."
            )
        else:
            body = (
                "I've reviewed the details and routed this to the right specialist on our team. "
                "You'll get an update from us shortly with next steps."
            )

        close = (
            "If anything above doesn't match what you're seeing, just reply to this message "
            "and I'll pick it straight back up."
        )
        reply = (
            f"Hi {requester_name},\n\n{opener}\n\n{body}\n\n{close}\n\n"
            f"Best regards,\n{agent_name}\nSmartDesk Support"
        )
        return {
            "label": reply,
            "confidence": round((retrieved or {}).get("similarity", 0.4) * 0.9 + 0.25, 4)
            if retrieved
            else 0.45,
            "explanation": {
                "method": "retrieval-based draft",
                "retrieved_case": retrieved,
                "similar_cases": similar,
                "tone": sentiment,
            },
            "model_version": self.load().get("version", "unknown"),
        }

    @staticmethod
    def _priority_features(text: str, tier: str) -> str:
        payload_markers = " ".join(
            f"kw_{w}" for w in TriageEngine.lexicon() if w in text.lower()
        )
        return f"tier_{tier} {payload_markers} {text}"

    @staticmethod
    def lexicon() -> list[str]:
        try:
            payload = TriageEngine.instance().load()
            return list(payload.get("urgent_lexicon") or [])
        except ModelNotTrainedError:
            return []
