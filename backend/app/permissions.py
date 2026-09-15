import strawberry
from strawberry.permission import BasePermission


class IsAuthenticated(BasePermission):
    message = "User is not Authenticated"
    
    def has_permission(self, source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return user is not None


def _user_role(user) -> str:
    if not user or not user.role:
        return ""

    role = getattr(user.role, "value", user.role)
    return str(role).strip().lower()

class IsStudent(BasePermission):
    message = "User is not Student"
    
    def has_permission(self, source, info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "student"

class IsSuperAdmin(BasePermission):
    message = "User is not Super Admin"

    def has_permission(self , source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "super_admin"
    
class IsDepartmentAdmin(BasePermission):
    message = "User is not Admin"

    def has_permission(self, source, info : strawberry.Info, **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "admin"


class IsAdminOrSuperAdmin(BasePermission):
    message = "User is not an administrator"

    def has_permission(self, source, info: strawberry.Info, **kwargs) -> bool:
        return _user_role(info.context.get("current_user")) in {"admin", "super_admin"}
    

class IsProfessor(BasePermission):
    message = "User is not Professor"

    def has_permission(self , source , info : strawberry.Info , **kwargs) -> bool:
        user = info.context.get("current_user")
        return _user_role(user) == "professor"