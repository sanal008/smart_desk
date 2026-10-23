from django.contrib.auth import get_user_model
from django.db.models import Count, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsOwnerOrStaff, IsTeamLeadOrAdmin

from .filters import TicketFilter
from .models import Attachment, Category, SLAPolicy, Ticket, TicketActivity, TicketComment
from .serializers import (
    AssignSerializer,
    AttachmentSerializer,
    CategorySerializer,
    SLAPolicySerializer,
    StatusSerializer,
    TicketActivitySerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    TicketUpdateSerializer,
)

User = get_user_model()


def log_activity(ticket, actor, action, **kwargs):
    return TicketActivity.objects.create(
        ticket=ticket, actor=actor, action=action, **kwargs
    )


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    lookup_field = "slug"
    filterset_fields = ["slug"]

    def get_queryset(self):
        return Category.objects.select_related("default_team").annotate(
            open_ticket_count=Count("tickets", filter=~Q(status__in=["RESOLVED", "CLOSED"]))
        )

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsOwnerOrStaff()]
        return [IsTeamLeadOrAdmin()]


class SLAPolicyViewSet(viewsets.ModelViewSet):
    serializer_class = SLAPolicySerializer
    queryset = SLAPolicy.objects.select_related("category")
    filterset_fields = ["category", "priority"]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsOwnerOrStaff()]
        return [IsTeamLeadOrAdmin()]


class TicketViewSet(viewsets.ModelViewSet):
    filterset_class = TicketFilter
    permission_classes = [IsOwnerOrStaff]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = "pk"

    def get_queryset(self):
        qs = (
            Ticket.objects.for_user(self.request.user)
            .select_related("category", "assignee", "requester", "team")
            .prefetch_related(
                Prefetch("comments", queryset=TicketComment.objects.select_related("author")),
                "attachments",
                Prefetch("activities", queryset=TicketActivity.objects.select_related("actor")),
            )
            .annotate(comment_count=Count("comments"))
            .distinct()
        )
        ordering = self.request.query_params.get("ordering")
        if ordering in ("created_at", "-created_at", "due_at", "-due_at", "priority", "-priority"):
            return qs.order_by(ordering)
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        if self.action in ("update", "partial_update"):
            return TicketUpdateSerializer
        if self.action == "retrieve":
            return TicketDetailSerializer
        return TicketListSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["ai_summaries"] = self._ai_summaries()
        return ctx

    def _ai_summaries(self):
        from collections import defaultdict

        from ai.models import MLPrediction

        page_ids = list(
            Ticket.objects.for_user(self.request.user).values_list("id", flat=True)[:500]
        )
        preds = MLPrediction.objects.filter(task="summary", ticket_id__in=page_ids).order_by(
            "-created_at"
        )
        out = defaultdict(dict)
        for p in preds:
            if str(p.ticket_id) not in out:
                out[str(p.ticket_id)] = {
                    "text": p.predicted_label,
                    "confidence": p.confidence,
                    "model_version": p.model_version,
                }
        return out

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save(requester=request.user)

        files = request.data.getlist("attachments") if hasattr(request.data, "getlist") else []
        for f in files:
            Attachment.objects.create(ticket=ticket, file=f, uploaded_by=request.user)

        log_activity(ticket, request.user, TicketActivity.Action.CREATED,
                     metadata={"source": "web"})
        ticket.apply_sla()
        ticket.save(update_fields=["due_at", "first_response_due_at"])

        from ai.services import triage_ticket

        triage_ticket(ticket, actor=None)

        return Response(
            TicketDetailSerializer(ticket, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        ticket = self.get_object()
        before = {f: getattr(ticket, f) for f in ("status", "priority", "category_id", "assignee_id", "team_id")}
        serializer = self.get_serializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        mapping = {
            "status": (TicketActivity.Action.STATUS_CHANGED, "status"),
            "priority": (TicketActivity.Action.PRIORITY_CHANGED, "priority"),
            "category": (TicketActivity.Action.UPDATED, "category"),
            "assignee": (TicketActivity.Action.ASSIGNED, "assignee"),
            "team": (TicketActivity.Action.UPDATED, "team"),
        }
        field_map = {
            "status": ("status", before["status"], ticket.status),
            "priority": ("priority", before["priority"], ticket.priority),
            "category": ("category_id", before["category_id"], ticket.category_id),
            "assignee": ("assignee_id", before["assignee_id"], ticket.assignee_id),
            "team": ("team_id", before["team_id"], ticket.team_id),
        }
        for changed in serializer.validated_data:
            if changed in field_map:
                fname, old, new = field_map[changed]
                if old != new:
                    action_kind, field_name = mapping[changed]
                    is_override = changed in ("priority", "category", "team") and (
                        ticket.is_priority_ai_suggested or ticket.category_id
                    )
                    log_activity(
                        ticket,
                        request.user,
                        TicketActivity.Action.AI_OVERRIDE if is_override and changed != "status" else action_kind,
                        field=field_name,
                        old_value=str(old or ""),
                        new_value=str(new or ""),
                        is_ai_actor=False,
                        metadata={"human_override": bool(is_override)},
                    )

        if "status" in serializer.validated_data:
            self._handle_status_side_effects(ticket, serializer.validated_data["status"], request.user)
        if "assignee" in serializer.validated_data or "priority" in serializer.validated_data:
            ticket.apply_sla()
            ticket.save(update_fields=["due_at", "first_response_due_at"])

        return Response(TicketDetailSerializer(ticket, context={"request": request}).data)

    def _handle_status_side_effects(self, ticket, new_status, user):
        from django.utils import timezone

        if new_status in (Ticket.Status.IN_PROGRESS, Ticket.Status.WAITING_CUSTOMER):
            if not ticket.first_response_at:
                ticket.first_response_at = timezone.now()
                ticket.save(update_fields=["first_response_at"])
                ticket.apply_sla()
                ticket.save(update_fields=["due_at"])
        if new_status in (Ticket.Status.RESOLVED, Ticket.Status.CLOSED):
            if not ticket.resolved_at:
                ticket.resolved_at = timezone.now()
                ticket.save(update_fields=["resolved_at"])

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignee_id = serializer.validated_data.get("assignee")
        team_id = serializer.validated_data.get("team")

        if assignee_id is not None:
            user = User.objects.filter(pk=assignee_id).first()
            if assignee_id and not user:
                return Response({"detail": "User not found."}, status=400)
            old = ticket.assignee_id
            ticket.assignee = user
            if user and user.team_id:
                ticket.team = user.team
            ticket.save()
            log_activity(ticket, request.user, TicketActivity.Action.ASSIGNED,
                         field="assignee", old_value=str(old or ""), new_value=str(user.id if user else ""))

        if team_id is not None:
            old_team = ticket.team_id
            ticket.team_id = team_id
            ticket.save(update_fields=["team"])
            log_activity(ticket, request.user, TicketActivity.Action.UPDATED,
                         field="team", old_value=str(old_team or ""), new_value=str(team_id))

        ticket.apply_sla()
        ticket.save(update_fields=["due_at", "first_response_due_at"])
        return Response(TicketDetailSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        ticket = self.get_object()
        serializer = StatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old = ticket.status
        ticket.status = serializer.validated_data["status"]
        ticket.save(update_fields=["status", "updated_at"])
        log_activity(ticket, request.user, TicketActivity.Action.STATUS_CHANGED,
                     field="status", old_value=old, new_value=ticket.status)
        self._handle_status_side_effects(ticket, ticket.status, request.user)
        return Response(TicketDetailSerializer(ticket, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        ticket = self.get_object()
        if request.method == "GET":
            qs = ticket.comments.select_related("author")
            if not request.user.is_staff_side:
                qs = qs.filter(is_internal=False)
            return Response(TicketCommentSerializer(qs, many=True).data)
        serializer = TicketCommentSerializer(data={**request.data, "ticket": ticket.id})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(author=request.user)
        log_activity(ticket, request.user, TicketActivity.Action.COMMENTED,
                     metadata={"comment_id": comment.id})
        if not ticket.first_response_at and not request.user.role == User.Role.CUSTOMER:
            from django.utils import timezone

            ticket.first_response_at = timezone.now()
            ticket.save(update_fields=["first_response_at"])
            ticket.apply_sla()
            ticket.save(update_fields=["due_at", "first_response_due_at"])
        return Response(TicketCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=["post"], url_path="attachments")
    def add_attachment(self, request, pk=None):
        ticket = self.get_object()
        files = request.FILES.getlist("files") or ([request.FILES["file"]] if "file" in request.FILES else [])
        if not files:
            return Response({"detail": "No files provided."}, status=400)
        created = [
            Attachment.objects.create(ticket=ticket, file=f, uploaded_by=request.user)
            for f in files
        ]
        log_activity(ticket, request.user, TicketActivity.Action.ATTACHED,
                     metadata={"count": len(created)})
        return Response(AttachmentSerializer(created, many=True).data, status=201)

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        ticket = self.get_object()
        qs = ticket.activities.select_related("actor")[:100]
        return Response(TicketActivitySerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="board")
    def board(self, request):
        qs = self.filter_queryset(self.get_queryset())
        data = TicketListSerializer(
            qs, many=True, context={"request": request, "ai_summaries": self._ai_summaries()}
        ).data
        grouped = {key: [] for key, _ in Ticket.Status.choices}
        for item in data:
            grouped[item["status"]].append(item)
        return Response({"columns": grouped, "total": len(data)})
