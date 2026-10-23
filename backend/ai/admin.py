from django.contrib import admin

from .models import AgentFeedback, MLPrediction, ModelRun


@admin.register(MLPrediction)
class MLPredictionAdmin(admin.ModelAdmin):
    list_display = ("ticket", "task", "predicted_label", "confidence", "model_version", "created_at")
    list_filter = ("task", "model_version")
    search_fields = ("predicted_label", "ticket__number")
    readonly_fields = ("ticket", "task", "predicted_label", "confidence", "explanation",
                       "model_version", "created_at")


@admin.register(AgentFeedback)
class AgentFeedbackAdmin(admin.ModelAdmin):
    list_display = ("prediction", "reviewer", "accepted", "corrected_label", "created_at")
    list_filter = ("accepted", "prediction__task")
    readonly_fields = ("prediction", "reviewer", "accepted", "corrected_label", "note", "created_at")


@admin.register(ModelRun)
class ModelRunAdmin(admin.ModelAdmin):
    list_display = ("version", "trained_at", "train_size", "test_size", "created_at")
    readonly_fields = ("version", "trained_at", "train_size", "test_size", "metrics",
                       "artifact_path", "notes", "created_at")
