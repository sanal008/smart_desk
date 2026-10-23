from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Team, User


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "role", "team", "tier", "is_active")
    list_filter = ("role", "team", "tier", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("SmartDesk", {"fields": ("role", "team", "tier", "title", "skills", "avatar_url")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("SmartDesk", {"fields": ("role", "team", "tier", "email")}),
    )
