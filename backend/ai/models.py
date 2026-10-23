from django.conf import settings
from django.db import models


class MLPrediction(models.Model):
    class Task(models.TextChoices):
        CATEGORY = "category", "Category"
        PRIORITY = "priority", "Priority"
        SENTIMENT = "sentiment", "Sentiment"
        TEAM = "team", "Team routing"
        AGENT = "agent", "Agent suggestion"
        SUMMARY = "summary", "Summary"
        REPLY = "reply", "Reply draft"

    ticket = models.ForeignKey("tickets.Ticket", on_delete=models.CASCADE, related_name="predictions")
    task = models.CharField(max_length=20, choices=Task.choices)
    predicted_label = models.CharField(max_length=255)
    confidence = models.FloatField(default=0.0)
    explanation = models.JSONField(default=dict, blank=True)
    model_version = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("ticket", "task")
        indexes = [models.Index(fields=["task", "created_at"])]

    def __str__(self) -> str:
        return f"{self.ticket.number} {self.task} -> {self.predicted_label} ({self.confidence:.2f})"


class AgentFeedback(models.Model):
    prediction = models.ForeignKey(MLPrediction, on_delete=models.CASCADE, related_name="feedback")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_feedback"
    )
    accepted = models.BooleanField(help_text="False when the agent overrode the AI.")
    corrected_label = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "agent feedback"

    def __str__(self) -> str:
        verdict = "accepted" if self.accepted else f"corrected to {self.corrected_label}"
        return f"{self.prediction} — {verdict}"


class ModelRun(models.Model):
    version = models.CharField(max_length=40, unique=True)
    trained_at = models.DateTimeField()
    train_size = models.PositiveIntegerField(default=0)
    test_size = models.PositiveIntegerField(default=0)
    metrics = models.JSONField(default=dict, blank=True)
    artifact_path = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-trained_at"]

    def __str__(self) -> str:
        return self.version
