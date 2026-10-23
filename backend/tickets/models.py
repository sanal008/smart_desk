import uuid

from django.db import models
from django.utils import timezone

from accounts.models import Team, User


class Category(models.Model):
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    description = models.TextField(blank=True)
    default_team = models.ForeignKey(
        Team, null=True, blank=True, on_delete=models.SET_NULL, related_name="categories"
    )
    icon = models.CharField(max_length=40, blank=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SLAPolicy(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="sla_policies")
    priority = models.CharField(max_length=10, choices=Priority.choices)
    response_minutes = models.PositiveIntegerField(help_text="Time allowed for first response.")
    resolution_minutes = models.PositiveIntegerField(help_text="Time allowed to resolve.")

    class Meta:
        unique_together = ("category", "priority")

    def __str__(self) -> str:
        return f"{self.category} / {self.priority}: {self.response_minutes}m response"


class TicketQuerySet(models.QuerySet):
    def open(self):
        return self.exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])

    def sla_breaching(self, now=None):
        now = now or timezone.now()
        return self.open().filter(due_at__lt=now)

    def for_user(self, user):
        if user.is_staff_side:
            return self
        return self.filter(requester=user)


class Ticket(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW", "New"
        TRIAGED = "TRIAGED", "Triaged"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        WAITING_CUSTOMER = "WAITING_CUSTOMER", "Waiting on Customer"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=12, unique=True, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    is_priority_ai_suggested = models.BooleanField(default=False)

    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets"
    )
    team = models.ForeignKey(Team, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    requester = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="requested_tickets"
    )
    assignee = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )

    sentiment = models.CharField(max_length=10, blank=True, default="")

    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True, help_text="SLA resolution deadline.")
    first_response_due_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TicketQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["-created_at"]),
            models.Index(fields=["due_at"]),
        ]

    def save(self, *args, **kwargs):
        creating = self._state.adding
        if creating and not self.number:
            from django.db.models import Max

            last = Ticket.objects.aggregate(m=Max("number"))["m"]
            seq = 1
            if last and last.startswith("TCK-"):
                try:
                    seq = int(last.split("-")[1]) + 1
                except (IndexError, ValueError):
                    seq = 1
            self.number = f"TCK-{seq:05d}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.number} — {self.title}"

    @property
    def text_blob(self) -> str:
        return f"{self.title}\n{self.description}"

    def apply_sla(self):
        if not self.category:
            return
        policy = SLAPolicy.objects.filter(
            category=self.category, priority=self.priority
        ).first()
        if not policy:
            return
        now = timezone.now()
        from datetime import timedelta

        self.first_response_due_at = (
            self.first_response_at or now
        ) + timedelta(minutes=policy.response_minutes)
        base = self.resolved_at or now
        self.due_at = base + timedelta(minutes=policy.resolution_minutes)

    @property
    def is_sla_breached(self) -> bool:
        return bool(self.due_at and self.due_at < timezone.now() and self.status not in (
            self.Status.RESOLVED,
            self.Status.CLOSED,
        ))

    @property
    def is_first_response_breached(self) -> bool:
        return bool(
            self.first_response_due_at
            and self.first_response_due_at < timezone.now()
            and not self.first_response_at
        )


class TicketComment(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="Staff-only note.")
    is_ai_draft = models.BooleanField(default=False, help_text="Drafted by the AI reply assistant.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Comment on {self.ticket.number} by {self.author.username}"


class Attachment(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="tickets/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="uploads")
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.file and not self.original_name:
            self.original_name = self.file.name
        if self.file and not self.size:
            try:
                self.size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.original_name or str(self.file.name)


class TicketActivity(models.Model):
    class Action(models.TextChoices):
        CREATED = "CREATED", "Created"
        UPDATED = "UPDATED", "Updated"
        STATUS_CHANGED = "STATUS_CHANGED", "Status changed"
        PRIORITY_CHANGED = "PRIORITY_CHANGED", "Priority changed"
        ASSIGNED = "ASSIGNED", "Assigned"
        COMMENTED = "COMMENTED", "Commented"
        ATTACHED = "ATTACHED", "File attached"
        AI_PREDICTED = "AI_PREDICTED", "AI prediction"
        AI_OVERRIDE = "AI_OVERRIDE", "AI recommendation overridden"
        FEEDBACK = "FEEDBACK", "Feedback on prediction"

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="activities"
    )
    is_ai_actor = models.BooleanField(default=False)
    action = models.CharField(max_length=30, choices=Action.choices)
    field = models.CharField(max_length=40, blank=True)
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.ticket.number}: {self.action}"
