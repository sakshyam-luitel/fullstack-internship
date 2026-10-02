import strawberry
from app.permissions import IsDepartmentAdmin
from app import mutation_input, models , schemas
from app.utils import active_batch_id
from sqlalchemy.exc import IntegrityError

@strawberry.type
class StudentProfilesMutation:
    # mutation to create student profile
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def create_student_profile(self , info : strawberry.Info , admin_input : mutation_input.StudentProfilesInput) -> schemas.StudentProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student_user = db.query(models.User).filter(models.User.id == admin_input.user_id).first()
        if not student_user or getattr(student_user.role, "value", student_user.role) != "student":
            raise Exception("Selected user is not a student")
        if student_user.department_id != current_user.department_id:
            raise Exception("Student must belong to your department")
        degree_program = db.query(models.DegreePrograms).filter(
            models.DegreePrograms.id == admin_input.degree_program_id,
            models.DegreePrograms.department_id == current_user.department_id,
        ).first()
        if not degree_program:
            raise Exception("Degree program must belong to your department")
        
        student = models.StudentProfiles(
            user_id = admin_input.user_id,
            degree_program_id = admin_input.degree_program_id,
            supervisor_id = admin_input.supervisor_id,
            status = admin_input.status,
            roll_number = admin_input.roll_number or None,
            # The cohort that is running now — the admin never picks it from a list.
            batch_id = active_batch_id(db),
        )
        if db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == admin_input.user_id).first():
            raise Exception("Student already has a profile. Use update profile instead.")

        db.add(student)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise Exception("Roll number is already in use")
        db.refresh(student)

        return schemas.StudentProfileSchema(
            user_id = student.user_id,
            degree_program_id = student.degree_program_id,
            supervisor_id = student.supervisor_id,
            status =  student.status,
            roll_number = student.roll_number,
        )

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_student_profile(self, info: strawberry.Info, admin_input: mutation_input.StudentProfileUpdateInput) -> schemas.StudentProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student = db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == admin_input.user_id).first()
        degree_program = db.query(models.DegreePrograms).filter(
            models.DegreePrograms.id == admin_input.degree_program_id,
            models.DegreePrograms.department_id == current_user.department_id,
        ).first()
        if not student or not degree_program:
            raise Exception("Student profile or degree program not found in your department")
        student.degree_program_id = admin_input.degree_program_id
        student.supervisor_id = admin_input.supervisor_id
        student.status = admin_input.status
        student.roll_number = admin_input.roll_number or None
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise Exception("Roll number is already in use")
        db.refresh(student)
        return schemas.StudentProfileSchema(
            user_id=student.user_id,
            degree_program_id=student.degree_program_id,
            supervisor_id=student.supervisor_id,
            status=student.status,
            roll_number=student.roll_number,
        )
        