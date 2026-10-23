from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Team, User


class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = ["id", "name", "slug", "description", "expertise", "member_count", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "team",
            "team_name",
            "tier",
            "title",
            "skills",
            "avatar_url",
            "password",
            "date_joined",
        ]
        read_only_fields = ["date_joined"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class RegisterSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = ["id", "username", "email", "first_name", "last_name", "password", "role", "tier"]
        extra_kwargs = {"role": {"default": User.Role.CUSTOMER}}


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
