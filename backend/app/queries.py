import strawberry
from sqlalchemy.orm import aliased

from . import models, schemas
from .permissions import IsAdminOrSuperAdmin, IsProfessor, IsStudent


@strawberry.type
class UserQuery:
    @strawberry.field(permission_classes=[IsStudent])
    def my_proposals(self, info: strawberry.Info) -> list[schemas.ProposalSchemaUser]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        supervisor_user = aliased(models.User)
        rows = (
            db.query(models.Proposals, supervisor_user.name)
            .outerjoin(supervisor_user, models.Proposals.supervisor_id == supervisor_user.id)
            .filter(models.Proposals.submitted_by == current_user.id)
            .order_by(models.Proposals.created_at.desc())
            .all()
        )
        return [
            schemas.ProposalSchemaUser(
                id=proposal.id,
                submitted_by=proposal.submitted_by,
                title=proposal.title,
                status=proposal.status,
                supervisor_id=proposal.supervisor_id,
                supervisor_name=supervisor_name,
                group_members=[
                    schemas.ProposalMemberSchema(id=member.id, name=member.name)
                    for member in db.query(models.User)
                    .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
                    .filter(models.ProposalCandidates.proposal_id == proposal.id)
                    .order_by(models.User.name)
                    .all()
                ],
            )
            for proposal, supervisor_name in rows
        ]

    @strawberry.field(permission_classes=[IsProfessor])
    def assigned_proposals(self, info: strawberry.Info) -> list[schemas.ProposalSchemaAdmin]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student_user = aliased(models.User)
        cluster = aliased(models.Clusters)
        rows = (
            db.query(models.Proposals, student_user.name, cluster.name)
            .join(student_user, models.Proposals.submitted_by == student_user.id)
            .outerjoin(cluster, models.Proposals.cluster_id == cluster.id)
            .filter(models.Proposals.supervisor_id == current_user.id)
            .order_by(models.Proposals.created_at.desc())
            .all()
        )
        return [
            schemas.ProposalSchemaAdmin(
                id=proposal.id,
                submitted_by=proposal.submitted_by,
                submitted_by_name=student_name,
                title=proposal.title,
                status=proposal.status,
                reviewed_by=proposal.reviewed_by,
                cluster_id=proposal.cluster_id,
                supervisor_id=proposal.supervisor_id,
                supervisor_name=current_user.name,
                cluster_name=cluster_name,
            )
            for proposal, student_name, cluster_name in rows
        ]
    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def current_user(self, info: strawberry.Info) -> schemas.UserSchema:
        current_user = info.context.get("current_user")
        if not current_user:
            raise Exception("Authenticated user not found")

        return schemas.UserSchema(
            id=current_user.id,
            department_id=current_user.department_id,
            name=current_user.name,
            email=current_user.email,
            password="********",
            role=getattr(current_user.role, "value", current_user.role),
            created_at=current_user.created_at,
        )

    @strawberry.field(permission_classes=[IsStudent])
    def available_group_members(self, info: strawberry.Info) -> list[schemas.UserSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        return [
            schemas.UserSchema(
                id=user.id,
                department_id=user.department_id,
                name=user.name,
                email=user.email,
                password="********",
                role=getattr(user.role, "value", user.role),
                created_at=user.created_at,
            )
            for user in db.query(models.User)
            .filter(
                models.User.department_id == current_user.department_id,
                models.User.id != current_user.id,
                models.User.role == models.Role.student,
            )
            .order_by(models.User.name)
            .all()
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def departments(self, info: strawberry.Info) -> list[schemas.DepartmentSchema]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        departments_query = db.query(models.Department)
        if current_user and getattr(current_user.role, "value", current_user.role) == "admin":
            departments_query = departments_query.filter(
                models.Department.id == current_user.department_id
            )
        departments = departments_query.order_by(models.Department.name).all()

        return [
            schemas.DepartmentSchema(
                id=department.id,
                name=department.name,
                code=department.code,
                created_at=department.created_at,
            )
            for department in departments
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def users(self, info: strawberry.Info) -> list[schemas.UserSchema]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        users_query = db.query(models.User)
        if current_user and getattr(current_user.role, "value", current_user.role) == "admin":
            users_query = users_query.filter(models.User.department_id == current_user.department_id)
        users = users_query.order_by(models.User.created_at.desc()).all()

        return [
            schemas.UserSchema(
                id=user.id,
                department_id=user.department_id,
                name=user.name,
                email=user.email,
                password="********",
                role=getattr(user.role, "value", user.role),
                created_at=user.created_at,
            )
            for user in users
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def degree_programs(self, info: strawberry.Info) -> list[schemas.DegreeProgramSchema]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        department_id = current_user.department_id if current_user else None

        return [
            schemas.DegreeProgramSchema(
                id=item.id,
                name=item.name,
                level=item.level,
                department_id=item.department_id,
            )
            for item in db.query(models.DegreePrograms)
            .filter(models.DegreePrograms.department_id == department_id)
            .order_by(models.DegreePrograms.name)
            .all()
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def clusters(self, info: strawberry.Info) -> list[schemas.ClusterSchema]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        department_id = current_user.department_id if current_user else None

        return [
            schemas.ClusterSchema(id=item.id, name=item.name, department_id=item.department_id)
            for item in db.query(models.Clusters).filter(models.Clusters.department_id == department_id).order_by(models.Clusters.name).all()
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def proposals(self, info: strawberry.Info) -> list[schemas.ProposalSchemaAdmin]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        submitted_by_user = aliased(models.User)
        supervisor_user = aliased(models.User)
        cluster = aliased(models.Clusters)
        proposals_query = (
            db.query(models.Proposals, submitted_by_user.name, supervisor_user.name, cluster.name)
            .outerjoin(submitted_by_user, models.Proposals.submitted_by == submitted_by_user.id)
            .outerjoin(supervisor_user, models.Proposals.supervisor_id == supervisor_user.id)
            .outerjoin(cluster, models.Proposals.cluster_id == cluster.id)
            .filter(submitted_by_user.role == models.Role.student)
        )
        if current_user and getattr(current_user.role, "value", current_user.role) == "admin":
            proposals_query = proposals_query.filter(
                submitted_by_user.department_id == current_user.department_id
            )
        proposal_rows = proposals_query.order_by(models.Proposals.created_at.desc()).all()
        return [
            schemas.ProposalSchemaAdmin(
                id=proposal.id,
                submitted_by=proposal.submitted_by,
                submitted_by_name=submitted_by_name,
                title=proposal.title,
                status=proposal.status,
                reviewed_by=proposal.reviewed_by,
                cluster_id=proposal.cluster_id,
                cluster_name=cluster_name,
                supervisor_id=proposal.supervisor_id,
                supervisor_name=supervisor_name,
                group_members=[
                    schemas.ProposalMemberSchema(id=member.id, name=member.name)
                    for member in db.query(models.User)
                    .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
                    .filter(models.ProposalCandidates.proposal_id == proposal.id)
                    .order_by(models.User.name)
                    .all()
                ],
            )
            for proposal, submitted_by_name, supervisor_name, cluster_name in proposal_rows
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def profiles(self, info: strawberry.Info) -> list[schemas.AdminProfileSchema]:
        db = info.context["db"]
        current_user = info.context.get("current_user")
        student_rows = (
            db.query(
                models.StudentProfiles,
                models.User.name,
                models.User.role,
                models.Department.id,
                models.Department.name,
                models.DegreePrograms.name,
            )
            .join(models.User, models.StudentProfiles.user_id == models.User.id)
            .join(models.Department, models.User.department_id == models.Department.id)
            .join(models.DegreePrograms, models.StudentProfiles.degree_program_id == models.DegreePrograms.id)
        )
        professor_rows = (
            db.query(
                models.ProfessorProfiles,
                models.User.name,
                models.User.role,
                models.Department.id,
                models.Department.name,
            )
            .join(models.User, models.ProfessorProfiles.user_id == models.User.id)
            .join(models.Department, models.User.department_id == models.Department.id)
        )
        if current_user and getattr(current_user.role, "value", current_user.role) == "admin":
            student_rows = student_rows.filter(models.User.department_id == current_user.department_id)
            professor_rows = professor_rows.filter(models.User.department_id == current_user.department_id)
        student_rows = student_rows.all()
        professor_rows = professor_rows.all()
        profiles = [
            schemas.AdminProfileSchema(
                user_id=profile.user_id,
                user_name=user_name,
                role=getattr(role, "value", role),
                department_id=department_id,
                department_name=department_name,
                degree_program_name=degree_program_name,
                supervisor_name=(
                    db.query(models.User.name)
                    .filter(models.User.id == profile.supervisor_id)
                    .scalar()
                    if profile.supervisor_id
                    else None
                ),
                supervisor_id=profile.supervisor_id,
                academic_rank=None,
                max_students=None,
                status=profile.status,
            )
            for profile, user_name, role, department_id, department_name, degree_program_name in student_rows
        ]
        profiles.extend(
            schemas.AdminProfileSchema(
                user_id=profile.user_id,
                user_name=user_name,
                role=getattr(role, "value", role),
                department_id=department_id,
                department_name=department_name,
                degree_program_name=None,
                supervisor_name=None,
                supervisor_id=None,
                academic_rank=profile.academic_rank,
                max_students=profile.max_students,
                status=None,
            )
            for profile, user_name, role, department_id, department_name in professor_rows
        )
        return profiles