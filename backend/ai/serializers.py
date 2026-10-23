from rest_framework import serializers

from .models import AgentFeedback, MLPrediction, ModelRun


class MLPredictionSerializer(serializers.ModelSerializer):
    task_display = serializers.CharField(source="get_task_display", read_only=True)

    class Meta:
        model = MLPrediction
        fields = ["id", "ticket", "task", "task_display", "predicted_label", "confidence",
                  "explanation", "model_version", "created_at"]
        read_only_fields = fields


class AgentFeedbackSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source="reviewer.username", read_only=True)
    task = serializers.CharField(source="prediction.task", read_only=True)
    ticket_number = serializers.CharField(source="prediction.ticket.number", read_only=True)

    class Meta:
        model = AgentFeedback
        fields = ["id", "prediction", "reviewer", "reviewer_username", "task", "ticket_number",
                  "accepted", "corrected_label", "note", "created_at"]
        read_only_fields = ["reviewer", "created_at"]

    def validate(self, attrs):
        if not attrs.get("accepted") and not attrs.get("corrected_label"):
            raise serializers.ValidationError(
                {"corrected_label": "Provide the corrected label when overriding the AI."}
            )
        return attrs


class ModelRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelRun
        fields = ["id", "version", "trained_at", "train_size", "test_size", "metrics",
                  "artifact_path", "notes", "created_at"]


class DraftPredictSerializer(serializers.Serializer):
    text = serializers.CharField(min_length=10)
    tier = serializers.ChoiceField(
        choices=[("free", "Free"), ("standard", "Standard"), ("enterprise", "Enterprise")],
        default="standard",
    )


class SuggestReplySerializer(serializers.Serializer):
    body = serializers.CharField(required=False, allow_blank=True)
    save_as_draft = serializers.BooleanField(default=False)


class FeedbackRequestSerializer(serializers.Serializer):
    prediction_id = serializers.IntegerField()
    accepted = serializers.BooleanField()
    corrected_label = serializers.CharField(required=False, allow_blank=True, max_length=255)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("accepted") and not attrs.get("corrected_label"):
            raise serializers.ValidationError(
                {"corrected_label": "Provide the corrected label when overriding the AI."}
            )
        return attrs
