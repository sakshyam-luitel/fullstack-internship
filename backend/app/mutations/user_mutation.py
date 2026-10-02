import strawberry
from app.permissions import IsAdminOrSuperAdmin, IsDepartmentAdmin, IsAuthenticated
from app import mutation_input , schemas , models , constraints
from app.utils import get_password_hash , _commit_user , save_avatar_image
from strawberry.file_uploads import Upload

def _ensure_email_available(db, email: str, exclude_user_id=None) -> None:
    """Emails are unique regardless of letter case, so "Ram@x.com" can't shadow "ram@x.com"."""
    if not email:
        raise Exception("An email address is required")
    query = db.query(models.User).filter(func.lower(models.User.email) == email.lower())
    if exclude_user_id is not None:
        query = query.filter(models.User.id != exclude_user_id)
    if query.first():
        raise Exception(f"A user with the email {email} already exists")


@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAdminOrSuperAdmin])
    def create_user(self , info : strawberry.Info , admin_input : mutation_input.UserInput ) -> schemas.UserSchema:
        db = info.context.get("db")
        current_user = info.context.get("current_user")
        current_role = getattr(current_user.role, "value", current_user.role) if current_user else ""
        requested_role = str(admin_input.role).strip().lower()
        if current_role == "super_admin" and requested_role != "admin":
            raise Exception("Super admins can only create department admins")
        if current_role == "admin" and requested_role == "admin":
            raise Exception("Department admins cannot create another department admin")
        if current_role == "admin":
            department_id = current_user.department_id
        else:
            department_id = admin_input.department_id
        if not department_id:
            raise Exception("A department is required")

        email = admin_input.email.strip()
        _ensure_email_available(db, email)

        degree_program_id = None
        if requested_role == "student":
            # Chosen once, at account creation — this is what auto-creates the
            # student's profile later, so a student account can't exist without it.
            degree_program_id = constraints.resolve_student_degree_program(
                db, department_id, admin_input.degree_program_id, admin_input.degree_level
            ).id

        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = department_id,
            name = admin_input.name,
            email = email,
            password = hashed_password,
            role = models.Role(requested_role),
            degree_program_id = degree_program_id,
        )
        db.add(user)
        _commit_user(db)
        db.refresh(user)

        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = getattr(user.role, "value", user.role),
            created_at=user.created_at,
            avatar_url=user.avatar_url,
            degree_program_id=user.degree_program_id,
        )
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_user(self , info : strawberry.Info , admin_input : mutation_input.UserUpdateInput) -> schemas.UserSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        user = db.query(models.User).filter(models.User.id == admin_input.id).first()
        if not user:
            raise Exception("User not found")

        email = admin_input.email.strip()
        _ensure_email_available(db, email, exclude_user_id=user.id)
        hashed_password = get_password_hash(admin_input.password)

        user.name = admin_input.name
        user.email = email
        user.password = hashed_password

        # Backfills a degree program for accounts created before it became required
        # at signup, or lets an admin correct one — same field auto-creation reads from.
        if admin_input.degree_program_id is not None or admin_input.degree_level:
            if getattr(user.role, "value", user.role) != "student":
                raise Exception("Only student accounts have a degree program")
            user.degree_program_id = constraints.resolve_student_degree_program(
                db, current_user.department_id, admin_input.degree_program_id, admin_input.degree_level
            ).id

        _commit_user(db)
        db.refresh(user)

        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = getattr(user.role, "value", user.role),
            created_at=user.created_at,
            avatar_url=user.avatar_url,
            degree_program_id=user.degree_program_id,
        )

    # Any signed-in user (student, professor, admin, super_admin) can set their own
    # profile picture — this is the account holder's own avatar, not an admin action.
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def upload_profile_image(self, info: strawberry.Info, file: Upload) -> schemas.UserSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]

        avatar_url = await save_avatar_image(current_user.id, file)
        current_user.avatar_url = avatar_url
        db.commit()
        db.refresh(current_user)

        return schemas.UserSchema(
            id=current_user.id,
            department_id=current_user.department_id,
            name=current_user.name,
            email=current_user.email,
            password="********",
            role=getattr(current_user.role, "value", current_user.role),
            created_at=current_user.created_at,
            avatar_url=current_user.avatar_url,
        )