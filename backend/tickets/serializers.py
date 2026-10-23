from rest_framework import serializers

from accounts.serializers import TeamSerializer, UserSerializer

from .models import Attachment, Category, SLAPolicy, Ticket, TicketActivity, TicketComment


class CategorySerializer(serializers.ModelSerializer):
    default_team_name = serializers.CharField(source="default_team.name", read_only=True)
    open_ticket_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "default_team", "default_team_name",
                  "icon", "open_ticket_count"]


class SLAPolicySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = SLAPolicy
        fields = ["id", "category", "category_name", "priority", "response_minutes", "resolution_minutes"]


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "file", "url", "original_name", "size", "uploaded_by", "uploaded_by_username",
                  "created_at"]
        read_only_fields = ["original_name", "size", "uploaded_by"]

    def get_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class TicketCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_role = serializers.CharField(source="author.get_role_display", read_only=True)

    class Meta:
        model = TicketComment
        fields = ["id", "ticket", "author", "author_username", "author_role", "body",
                  "is_internal", "is_ai_draft", "created_at"]
        read_only_fields = ["author", "is_ai_draft"]


class TicketActivitySerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)

    class Meta:
        model = TicketActivity
        fields = ["id", "actor", "actor_username", "is_ai_actor", "action", "field",
                  "old_value", "new_value", "metadata", "created_at"]


class TicketListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_slug = serializers.CharField(source="category.slug", read_only=True, default=None)
    assignee_username = serializers.CharField(source="assignee.username", read_only=True, default=None)
    requester_username = serializers.CharField(source="requester.username", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True, default=None)
    comment_count = serializers.IntegerField(read_only=True)
    is_sla_breached = serializers.BooleanField(read_only=True)
    is_first_response_breached = serializers.BooleanField(read_only=True)
    ai_summary = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "number", "title", "status", "priority", "is_priority_ai_suggested",
            "category", "category_name", "category_slug",
            "team", "team_name",
            "requester", "requester_username",
            "assignee", "assignee_username",
            "sentiment", "due_at", "first_response_due_at",
            "created_at", "updated_at",
            "comment_count", "is_sla_breached", "is_first_response_breached", "ai_summary",
        ]

    def get_ai_summary(self, obj):
        summaries = self.context.get("ai_summaries") or {}
        return summaries.get(str(obj.id)) or summaries.get(obj.id)


class TicketDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    assignee_detail = UserSerializer(source="assignee", read_only=True)
    requester_detail = UserSerializer(source="requester", read_only=True)
    team_detail = TeamSerializer(source="team", read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    activities = TicketActivitySerializer(many=True, read_only=True)
    predictions = serializers.SerializerMethodField()
    sla = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "number", "title", "description", "status", "priority",
            "is_priority_ai_suggested", "sentiment",
            "category", "category_name", "team", "team_detail",
            "requester", "requester_detail", "assignee", "assignee_detail",
            "first_response_at", "resolved_at", "due_at", "first_response_due_at",
            "created_at", "updated_at",
            "comments", "attachments", "activities", "predictions", "sla",
        ]

    def get_predictions(self, obj):
        from ai.models import MLPrediction
        from ai.serializers import MLPredictionSerializer

        preds = MLPrediction.objects.filter(ticket=obj).order_by("-created_at")
        return MLPredictionSerializer(preds, many=True).data

    def get_sla(self, obj):
        return {
            "due_at": obj.due_at,
            "first_response_due_at": obj.first_response_due_at,
            "is_breached": obj.is_sla_breached,
            "is_first_response_breached": obj.is_first_response_breached,
        }


class TicketCreateSerializer(serializers.ModelSerializer):
    attachments = serializers.ListField(
        child=serializers.FileField(), write_only=True, required=False
    )

    class Meta:
        model = Ticket
        fields = ["title", "description", "category", "attachments", "priority", "team"]

    def validate_title(self, value):
        if len(value.strip()) < 8:
            raise serializers.ValidationError("Title must be at least 8 characters.")
        return value

    def validate_description(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError(
                "Please describe the issue in at least 20 characters so we can route it correctly."
            )
        return value


class TicketUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ["title", "description", "status", "priority", "category", "team", "assignee",
                  "sentiment"]


class AssignSerializer(serializers.Serializer):
    assignee = serializers.IntegerField(required=False, allow_null=True)
    team = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)


class StatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Ticket.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)
