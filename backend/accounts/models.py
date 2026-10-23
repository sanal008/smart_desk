from django.contrib.auth.models import AbstractUser
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    expertise = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        AGENT = "AGENT", "Agent"
        TEAM_LEAD = "TEAM_LEAD", "Team Lead"
        ADMIN = "ADMIN", "Admin"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    team = models.ForeignKey(
        Team, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    tier = models.CharField(
        max_length=20,
        choices=[("free", "Free"), ("standard", "Standard"), ("enterprise", "Enterprise")],
        default="standard",
    )
    title = models.CharField(max_length=120, blank=True)
    skills = models.JSONField(default=list, blank=True)
    avatar_url = models.URLField(blank=True)

    class Meta:
        ordering = ["username"]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_staff_side(self) -> bool:
        return self.role in (self.Role.AGENT, self.Role.TEAM_LEAD, self.Role.ADMIN) or self.is_staff

    @property
    def is_team_lead(self) -> bool:
        return self.role == self.Role.TEAM_LEAD or self.is_superuser
