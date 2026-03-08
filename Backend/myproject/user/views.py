from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PortfolioUser


class SignupView(APIView):
    def post(self, request):
        full_name = (request.data.get("full_name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        phone = (request.data.get("phone") or "").strip()

        if not full_name or not email or not password:
            return Response(
                {"detail": "full_name, email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=email).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name, _, last_name = full_name.partition(" ")
        user = User(
            username=email,
            email=email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
        )
        user.set_password(password)
        user.save()

        PortfolioUser.objects.get_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "phone": phone or None,
            },
        )

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "full_name": full_name,
                "message": "Account created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    def post(self, request):
        identifier = (request.data.get("email") or request.data.get("username") or "").strip().lower()
        password = request.data.get("password") or ""

        if not identifier or not password:
            return Response(
                {"detail": "Email/username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_obj = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(
                email__iexact=identifier
            ).first()
        except Exception:
            user_obj = None

        if not user_obj:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        user = authenticate(request, username=user_obj.username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        portfolio_user = PortfolioUser.objects.filter(email__iexact=user.email).first()
        full_name = None
        if portfolio_user:
            full_name = portfolio_user.full_name
        else:
            full_name = f"{user.first_name} {user.last_name}".strip() or user.username

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "full_name": full_name,
                "message": "Login successful",
            },
            status=status.HTTP_200_OK,
        )
