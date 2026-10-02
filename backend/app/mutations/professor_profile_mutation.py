import strawberry
from app.permissions import IsDepartmentAdmin
from app import mutation_input , models , schemas

@strawberry.type
class ProfessorProfileMutation:
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def create_professor_profile(self , info : strawberry.Info , admin_input : mutation_input.ProfessorProfileInput) -> schemas.ProfessorProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        professor_user = db.query(models.User).filter(models.User.id == admin_input.user_id).first()
        if not professor_user or getattr(professor_user.role, "value", professor_user.role) != "professor":
            raise Exception("Selected user is not a professor")
        if professor_user.department_id != current_user.department_id:
            raise Exception("Professor must belong to your department")
        professor = models.ProfessorProfiles(
            user_id = admin_input.user_id,
            academic_rank = admin_input.academic_rank,
            max_students = admin_input.max_students
        )
        if db.query(models.ProfessorProfiles).filter(models.ProfessorProfiles.user_id == admin_input.user_id).first():
            raise Exception("Professor already has a profile. Use update profile instead.")
        
        db.add(professor)
        db.commit()
        db.refresh(professor)

        return schemas.ProfessorProfileSchema(
            user_id = professor.user_id,
            academic_rank = professor.academic_rank,
            max_students = professor.max_students
        )

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_professor_profile(self, info: strawberry.Info, admin_input: mutation_input.ProfessorProfileUpdateInput) -> schemas.ProfessorProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        professor = db.query(models.ProfessorProfiles).join(
            models.User, models.ProfessorProfiles.user_id == models.User.id
        ).filter(
            models.ProfessorProfiles.user_id == admin_input.user_id,
            models.User.department_id == current_user.department_id,
        ).first()
        if not professor:
            raise Exception("Professor profile not found in your department")
        professor.academic_rank = admin_input.academic_rank
        professor.max_students = admin_input.max_students
        db.commit()
        db.refresh(professor)
        return schemas.ProfessorProfileSchema(
            user_id=professor.user_id,
            academic_rank=professor.academic_rank,
            max_students=professor.max_students,
        )