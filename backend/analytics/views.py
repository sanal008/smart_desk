from __future__ import annotations

from collections import Counter

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from ai.services import volume_timeseries
from tickets.models import Ticket
from tickets.serializers import TicketListSerializer


class OverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Ticket.objects.for_user(request.user)
        open_qs = qs.open()
        now = timezone.now()
        week_ago = now - timezone.timedelta(days=7)

        by_priority = Counter(qs.values_list("priority", flat=True))
        by_status = Counter(qs.values_list("status", flat=True))
        by_category = Counter(
            qs.exclude(category=None).values_list("category__name", flat=True)
        )
        by_sentiment = Counter(qs.exclude(sentiment="").values_list("sentiment", flat=True))

        breaching = open_qs.sla_breaching().count()
        at_risk = open_qs.filter(due_at__gte=now, due_at__lt=now + timezone.timedelta(hours=4)).count()

        responded = qs.filter(first_response_at__isnull=False, created_at__isnull=False)
        avg_minutes = None
        if responded.exists():
            total_minutes = 0
            count = 0
            for t in responded.only("created_at", "first_response_at")[:200]:
                delta = t.first_response_at - t.created_at
                total_minutes += delta.total_seconds() / 60
                count += 1
            avg_minutes = round(total_minutes / count, 1) if count else None

        avg_resolution = None
        resolved = qs.filter(resolved_at__isnull=False)[:200]
        if resolved:
            total = 0
            count = 0
            for t in resolved:
                total += (t.resolved_at - t.created_at).total_seconds() / 3600
                count += 1
            avg_resolution = round(total / count, 1) if count else None

        return Response(
            {
                "totals": {
                    "all": qs.count(),
                    "open": open_qs.count(),
                    "unassigned": open_qs.filter(assignee=None).count(),
                    "created_this_week": qs.filter(created_at__gte=week_ago).count(),
                    "resolved_this_week": qs.filter(resolved_at__gte=week_ago).count(),
                    "sla_breached": breaching,
                    "sla_at_risk": at_risk,
                },
                "by_priority": dict(by_priority),
                "by_status": dict(by_status),
                "by_category": dict(by_category),
                "by_sentiment": dict(by_sentiment),
                "sla": {
                    "breached": breaching,
                    "at_risk": at_risk,
                    "on_track": max(open_qs.filter(due_at__isnull=False).count() - breaching - at_risk, 0),
                    "avg_first_response_minutes": avg_minutes,
                    "avg_resolution_hours": avg_resolution,
                },
            }
        )


class VolumeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = min(int(request.query_params.get("days", 30)), 90)
        return Response({"days": days, "series": volume_timeseries(days)})


class AgentWorkloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        agents = (
            User.objects.filter(role__in=[User.Role.AGENT, User.Role.TEAM_LEAD])
            .annotate(
                open_assigned=Count(
                    "assigned_tickets",
                    filter=~Q(assigned_tickets__status__in=["RESOLVED", "CLOSED"]),
                ),
                resolved_total=Count(
                    "assigned_tickets",
                    filter=Q(assigned_tickets__status__in=["RESOLVED", "CLOSED"]),
                ),
                urgent_open=Count(
                    "assigned_tickets",
                    filter=Q(
                        assigned_tickets__status__in=["NEW", "TRIAGED", "IN_PROGRESS"],
                        assigned_tickets__priority="URGENT",
                    ),
                ),
            )
            .order_by("-open_assigned")
        )
        data = []
        for a in agents:
            responded = [t for t in a.assigned_tickets.filter(first_response_at__isnull=False)[:50]]
            avg = None
            if responded:
                avg = round(
                    sum((t.first_response_at - t.created_at).total_seconds() / 60 for t in responded)
                    / len(responded),
                    1,
                )
            data.append(
                {
                    "id": a.id,
                    "username": a.username,
                    "full_name": a.get_full_name() or a.username,
                    "team": a.team.name if a.team else None,
                    "open_assigned": a.open_assigned,
                    "resolved_total": a.resolved_total,
                    "urgent_open": a.urgent_open,
                    "avg_first_response_minutes": avg,
                }
            )
        return Response({"agents": data})


class CategoryTrendsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = min(int(request.query_params.get("days", 30)), 90)
        since = timezone.now() - timezone.timedelta(days=days)
        from django.db.models.functions import TruncDate

        rows = (
            Ticket.objects.filter(created_at__gte=since, category__isnull=False)
            .annotate(day=TruncDate("created_at"))
            .values("day", "category__name")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        series: dict[str, list] = {}
        for row in rows:
            series.setdefault(row["category__name"], []).append(
                {"date": row["day"].isoformat(), "count": row["count"]}
            )
        return Response({"days": days, "series": series})


class SLAView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        open_qs = Ticket.objects.for_user(request.user).open().filter(due_at__isnull=False)
        now = timezone.now()
        breached = open_qs.sla_breaching().select_related("category", "assignee", "requester")
        at_risk = open_qs.filter(
            due_at__gte=now, due_at__lt=now + timezone.timedelta(hours=4)
        ).select_related("category", "assignee", "requester")
        return Response(
            {
                "breached": TicketListSerializer(breached[:50], many=True, context={"request": request}).data,
                "at_risk": TicketListSerializer(at_risk[:50], many=True, context={"request": request}).data,
                "counts": {"breached": breached.count(), "at_risk": at_risk.count()},
            }
        )
