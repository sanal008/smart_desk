from datetime import timedelta

import django_filters
from django.db.models import Q
from django.utils import timezone

from .models import Ticket


class TicketFilter(django_filters.FilterSet):
    q = django_filters.CharFilter(method="filter_search", label="Free-text search")
    sla_status = django_filters.ChoiceFilter(
        choices=[("breached", "Breached"), ("at_risk", "At risk"), ("ok", "On track")],
        method="filter_sla",
    )
    created_after = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    open_only = django_filters.BooleanFilter(method="filter_open")

    class Meta:
        model = Ticket
        fields = {
            "status": ["exact", "in"],
            "priority": ["exact", "in"],
            "category": ["exact"],
            "assignee": ["exact"],
            "team": ["exact"],
            "requester": ["exact"],
        }

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(number__icontains=value)
        )

    def filter_open(self, queryset, name, value):
        if value:
            return queryset.open()
        return queryset

    def filter_sla(self, queryset, name, value):
        now = timezone.now()
        open_qs = queryset.open()
        if value == "breached":
            return open_qs.filter(due_at__lt=now)
        if value == "at_risk":
            return open_qs.filter(due_at__gte=now, due_at__lt=now + timedelta(hours=4))
        if value == "ok":
            return open_qs.filter(due_at__gte=now + timedelta(hours=4))
        return queryset
