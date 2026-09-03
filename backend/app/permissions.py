import strawberry
from strawberry.permission import BasePermission


class IsAuthenticated(BasePermission):
    message = "User is not Authenticated"
    
    def has_permission(self, source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return user is not None


def _user_role(user) -> str:
    return (user.role or "").strip().lower() if user else ""

class IsStudent(BasePermission):
    message = "User is not Student"
    
    def has_permission(self, source, info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "student"

class IsAdmin(BasePermission):
    message = "User is not Admin"

    def has_permission(self , source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "admin"

class IsProfessor(BasePermission):
    message = "User is not Professor"

    def has_permission(self , source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "professor"