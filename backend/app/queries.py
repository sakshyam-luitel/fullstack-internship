import strawberry
import uuid
from typing import Optional
from sqlalchemy.orm import aliased

from sqlalchemy import or_

from . import constraints, defenses, models, schemas
from .permissions import IsAdminOrSuperAdmin, IsAuthenticated, IsDepartmentAdmin, IsProfessor, IsStudent
from .utils import committed_student_ids, find_my_paper, is_accepted_group_member, proposal_group_member_users
from .research_workflow import active_phases, is_phase_open, phase_has_ended


@strawberry.type
class UserQuery:
    @strawberry.field(permission_classes=[IsStudent])
    def my_proposals(self, info: strawberry.Info) -> list[schemas.ProposalSchemaUser]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        submitted_by_user = aliased(models.User)
        supervisor_user = aliased(models.User)
        reviewer_user = aliased(models.User)
        responder_user = aliased(models.User)
        deleter_user = aliased(models.User)
        # A proposal shows up for its owner and for every student added to its group,
        # so the whole team sees the same submitted proposal and its status/review.
        member_proposal_ids = db.query(models.ProposalCandidates.proposal_id).filter(
            models.ProposalCandidates.student_id == current_user.id
        )
        rows = (
            db.query(models.Proposals, submitted_by_user.name, supervisor_user.name, reviewer_user.name, responder_user.name, deleter_user.name)
            .outerjoin(submitted_by_user, models.Proposals.submitted_by == submitted_by_user.id)
            .outerjoin(supervisor_user, models.Proposals.supervisor_id == supervisor_user.id)
            .outerjoin(reviewer_user, models.Proposals.reviewed_by == reviewer_user.id)
            .outerjoin(responder_user, models.Proposals.responded_by == responder_user.id)
            .outerjoin(deleter_user, models.Proposals.deleted_by == deleter_user.id)
            .filter(
                or_(
                    models.Proposals.submitted_by == current_user.id,
                    models.Proposals.id.in_(member_proposal_ids),
                )
            )
            .order_by(models.Proposals.created_at.desc())
            .all()
        )
        return [
            schemas.ProposalSchemaUser(
                id=proposal.id,
                submitted_by=proposal.submitted_by,
                submitted_by_name=submitted_by_name,
                title=proposal.title,
                status=proposal.status,
                supervisor_id=proposal.supervisor_id,
                supervisor_name=supervisor_name,
                group_members=[
                    schemas.ProposalMemberSchema(id=member.id, name=member.name, status=member_status)
                    for member, member_status in db.query(models.User, models.ProposalCandidates.status)
                    .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
                    .filter(models.ProposalCandidates.proposal_id == proposal.id)
                    .order_by(models.User.name)
                    .all()
                ],
                review_comment=proposal.review_comment,
                reviewed_by_name=reviewer_name,
                student_response=proposal.student_response,
                responded_by_name=responder_name,
                deleted_at=proposal.deleted_at,
                deleted_by_name=deleter_name,
                original_filename=proposal.original_filename,
                file_size_bytes=proposal.file_size_bytes,
                uploaded_at=proposal.uploaded_at,
                phase_id=proposal.phase_id,
            )
            for proposal, submitted_by_name, supervisor_name, reviewer_name, responder_name, deleter_name in rows
        ]

    @strawberry.field(permission_classes=[IsStudent])
    def my_proposal_invites(self, info: strawberry.Info) -> list[schemas.ProposalInviteSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        owner = aliased(models.User)
        rows = (
            db.query(models.ProposalCandidates, models.Proposals, owner.name)
            .join(models.Proposals, models.ProposalCandidates.proposal_id == models.Proposals.id)
            .join(owner, models.Proposals.submitted_by == owner.id)
            .filter(
                models.ProposalCandidates.student_id == current_user.id,
                models.ProposalCandidates.status == "pending",
            )
            .order_by(models.Proposals.created_at.desc())
            .all()
        )
        return [
            schemas.ProposalInviteSchema(
                proposal_id=proposal.id,
                title=proposal.title,
                owner_id=proposal.submitted_by,
                owner_name=owner_name,
                status=candidate.status,
            )
            for candidate, proposal, owner_name in rows
        ]

    @strawberry.field(permission_classes=[IsProfessor])
    def assigned_proposals(self, info: strawberry.Info) -> list[schemas.ProposalSchemaAdmin]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student_user = aliased(models.User)
        cluster = aliased(models.Clusters)
        responder_user = aliased(models.User)
        deleter_user = aliased(models.User)
        rows = (
            db.query(models.Proposals, student_user.name, cluster.name, responder_user.name, deleter_user.name)
            .join(student_user, models.Proposals.submitted_by == student_user.id)
            .outerjoin(cluster, models.Proposals.cluster_id == cluster.id)
            .outerjoin(responder_user, models.Proposals.responded_by == responder_user.id)
            .outerjoin(deleter_user, models.Proposals.deleted_by == deleter_user.id)
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
                group_members=[
                    schemas.ProposalMemberSchema(id=member.id, name=member.name, status=member_status)
                    for member, member_status in db.query(models.User, models.ProposalCandidates.status)
                    .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
                    .filter(models.ProposalCandidates.proposal_id == proposal.id)
                    .order_by(models.User.name)
                    .all()
                ],
                review_comment=proposal.review_comment,
                reviewed_by_name=current_user.name if proposal.reviewed_by == current_user.id else None,
                student_response=proposal.student_response,
                responded_by_name=responder_name,
                deleted_at=proposal.deleted_at,
                deleted_by_name=deleter_name,
                original_filename=proposal.original_filename,
                file_size_bytes=proposal.file_size_bytes,
                uploaded_at=proposal.uploaded_at,
                phase_id=proposal.phase_id,
                degree_level=_level_value(constraints.get_degree_level(db, db.get(models.User, proposal.submitted_by))),
            )
            for proposal, student_name, cluster_name, responder_name, deleter_name in rows
        ]
    @strawberry.field(permission_classes=[IsStudent])
    def my_student_profile(self, info: strawberry.Info) -> schemas.MyProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        department_name = (
            db.query(models.Department.name).filter(models.Department.id == current_user.department_id).scalar()
            if current_user.department_id
            else None
        )
        profile = db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == current_user.id).first()
        degree_program_name = None
        supervisor_name = None
        status = None
        roll_number = None
        if profile:
            degree_program_name = db.query(models.DegreePrograms.name).filter(
                models.DegreePrograms.id == profile.degree_program_id
            ).scalar()
            supervisor_name = (
                db.query(models.User.name).filter(models.User.id == profile.supervisor_id).scalar()
                if profile.supervisor_id
                else None
            )
            status = profile.status
            roll_number = profile.roll_number

        return schemas.MyProfileSchema(
            name=current_user.name,
            email=current_user.email,
            avatar_url=current_user.avatar_url,
            department_name=department_name,
            degree_program_name=degree_program_name,
            supervisor_name=supervisor_name,
            status=status,
            roll_number=roll_number,
            degree_level=_level_value(constraints.get_degree_level(db, current_user)),
        )

    @strawberry.field(permission_classes=[IsProfessor])
    def my_professor_profile(self, info: strawberry.Info) -> schemas.MyProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        department_name = (
            db.query(models.Department.name).filter(models.Department.id == current_user.department_id).scalar()
            if current_user.department_id
            else None
        )
        profile = db.query(models.ProfessorProfiles).filter(models.ProfessorProfiles.user_id == current_user.id).first()

        return schemas.MyProfileSchema(
            name=current_user.name,
            email=current_user.email,
            avatar_url=current_user.avatar_url,
            department_name=department_name,
            degree_program_name=None,
            supervisor_name=None,
            status=None,
            academic_rank=profile.academic_rank if profile else None,
            max_students=profile.max_students if profile else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
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
            avatar_url=current_user.avatar_url,
            degree_program_id=current_user.degree_program_id,
        )

    @strawberry.field(permission_classes=[IsStudent])
    def available_group_members(self, info: strawberry.Info) -> list[schemas.UserSchema]:
        """Students the signed-in student could invite to a proposal group. Only Bachelor's
        proposals are group work, with members from the same Bachelor's program, so a
        Master's or PhD student gets nobody (see constraints.check_group_composition)."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        if constraints.get_degree_level(db, current_user) != models.DegreeLevel.bachelors:
            return []
        committed_ids = committed_student_ids(db)
        query = db.query(models.User).filter(
            models.User.department_id == current_user.department_id,
            models.User.id != current_user.id,
            models.User.role == models.Role.student,
        )
        if committed_ids:
            query = query.filter(~models.User.id.in_(committed_ids))
        return [
            schemas.UserSchema(
                id=user.id,
                department_id=user.department_id,
                name=user.name,
                email=user.email,
                password="********",
                role=getattr(user.role, "value", user.role),
                created_at=user.created_at,
                avatar_url=user.avatar_url,
                degree_program_id=user.degree_program_id,
            )
            for user in query.order_by(models.User.name).all()
            if user.degree_program_id == current_user.degree_program_id
            and constraints.get_degree_level(db, user) == models.DegreeLevel.bachelors
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
                avatar_url=user.avatar_url,
                degree_program_id=user.degree_program_id,
                degree_level=(
                    _level_value(constraints.get_degree_level(db, user))
                    if getattr(user.role, "value", user.role) == "student"
                    else None
                ),
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
                level=item.level.value,
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
        reviewer_user = aliased(models.User)
        responder_user = aliased(models.User)
        deleter_user = aliased(models.User)
        cluster = aliased(models.Clusters)
        proposals_query = (
            db.query(models.Proposals, submitted_by_user.name, supervisor_user.name, cluster.name, reviewer_user.name, responder_user.name, deleter_user.name)
            .outerjoin(submitted_by_user, models.Proposals.submitted_by == submitted_by_user.id)
            .outerjoin(supervisor_user, models.Proposals.supervisor_id == supervisor_user.id)
            .outerjoin(cluster, models.Proposals.cluster_id == cluster.id)
            .outerjoin(reviewer_user, models.Proposals.reviewed_by == reviewer_user.id)
            .outerjoin(responder_user, models.Proposals.responded_by == responder_user.id)
            .outerjoin(deleter_user, models.Proposals.deleted_by == deleter_user.id)
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
                    schemas.ProposalMemberSchema(id=member.id, name=member.name, status=member_status)
                    for member, member_status in db.query(models.User, models.ProposalCandidates.status)
                    .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
                    .filter(models.ProposalCandidates.proposal_id == proposal.id)
                    .order_by(models.User.name)
                    .all()
                ],
                review_comment=proposal.review_comment,
                reviewed_by_name=reviewer_name,
                student_response=proposal.student_response,
                responded_by_name=responder_name,
                deleted_at=proposal.deleted_at,
                deleted_by_name=deleter_name,
                original_filename=proposal.original_filename,
                file_size_bytes=proposal.file_size_bytes,
                uploaded_at=proposal.uploaded_at,
                phase_id=proposal.phase_id,
                degree_level=_level_value(constraints.get_degree_level(db, db.get(models.User, proposal.submitted_by))),
            )
            for proposal, submitted_by_name, supervisor_name, cluster_name, reviewer_name, responder_name, deleter_name in proposal_rows
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
                models.DegreePrograms.level,
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
                roll_number=profile.roll_number,
                degree_level=_level_value(degree_level),
            )
            for profile, user_name, role, department_id, department_name, degree_program_name, degree_level in student_rows
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
                roll_number=None,
            )
            for profile, user_name, role, department_id, department_name in professor_rows
        )
        return profiles

    @strawberry.field(permission_classes=[IsStudent])
    def my_paper(self, info: strawberry.Info) -> Optional[schemas.PaperSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        paper = find_my_paper(db, current_user)
        if not paper:
            return None
        supervisor_name = db.query(models.User.name).filter(models.User.id == paper.supervisor_id).scalar()
        cluster_name = db.query(models.Clusters.name).filter(models.Clusters.id == paper.cluster_id).scalar() if paper.cluster_id else None
        final_report_reviewed_by_name = (
            db.query(models.User.name).filter(models.User.id == paper.final_report_reviewed_by).scalar()
            if paper.final_report_reviewed_by
            else None
        )
        return schemas.PaperSchema(
            id=paper.id,
            proposal_id=paper.proposal_id,
            title=paper.title,
            status=paper.status,
            supervisor_id=paper.supervisor_id,
            supervisor_name=supervisor_name,
            cluster_id=paper.cluster_id,
            cluster_name=cluster_name,
            final_report_status=paper.final_report_status,
            final_report_review_comment=paper.final_report_review_comment,
            final_report_reviewed_by_name=final_report_reviewed_by_name,
            final_report_original_filename=paper.final_report_original_filename,
            final_report_file_size_bytes=paper.final_report_file_size_bytes,
            final_report_uploaded_at=paper.final_report_uploaded_at,
        )

    @strawberry.field(permission_classes=[IsStudent])
    def my_progress_reports(self, info: strawberry.Info) -> list[schemas.ProgressReportSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        paper = find_my_paper(db, current_user)
        if not paper:
            return []
        rows = (
            db.query(models.ProgressReports, models.ResearchPhase)
            .outerjoin(models.ResearchPhase, models.ProgressReports.phase_id == models.ResearchPhase.id)
            .filter(models.ProgressReports.paper_id == paper.id)
            .order_by(models.ProgressReports.submitted_at.desc())
            .all()
        )
        return [
            schemas.ProgressReportSchema(
                id=report.id,
                paper_id=report.paper_id,
                submitted_by=report.submitted_by,
                submitted_by_name=db.query(models.User.name).filter(models.User.id == report.submitted_by).scalar(),
                content=report.content,
                status=report.status,
                submitted_at=report.submitted_at,
                original_filename=report.original_filename,
                file_size_bytes=report.file_size_bytes,
                uploaded_at=report.uploaded_at,
                review_comment=report.review_comment,
                reviewed_by_name=(
                    db.query(models.User.name).filter(models.User.id == report.reviewed_by).scalar()
                    if report.reviewed_by
                    else None
                ),
                phase_id=report.phase_id,
                phase_label=phase.label if phase else None,
                deadline_at=phase.deadline_at if phase else None,
            )
            for report, phase in rows
        ]

    @strawberry.field(permission_classes=[IsStudent])
    def my_defenses(self, info: strawberry.Info) -> list[schemas.DefenseSchema]:
        """Defenses of the student's proposals, progress reports and paper."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        return [defenses.defense_schema(db, defense) for defense in defenses.defenses_for_student(db, current_user.id)]

    @strawberry.field(permission_classes=[IsProfessor])
    def supervised_papers(self, info: strawberry.Info) -> list[schemas.PaperSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        papers = db.query(models.Papers).filter(models.Papers.supervisor_id == current_user.id).all()
        cluster_names = {cluster.id: cluster.name for cluster in db.query(models.Clusters).all()}
        return [
            schemas.PaperSchema(
                id=paper.id,
                proposal_id=paper.proposal_id,
                title=paper.title,
                status=paper.status,
                supervisor_id=paper.supervisor_id,
                supervisor_name=current_user.name,
                cluster_id=paper.cluster_id,
                cluster_name=cluster_names.get(paper.cluster_id) if paper.cluster_id else None,
                final_report_status=paper.final_report_status,
                final_report_review_comment=paper.final_report_review_comment,
                final_report_reviewed_by_name=current_user.name if paper.final_report_reviewed_by == current_user.id else None,
                final_report_original_filename=paper.final_report_original_filename,
                final_report_file_size_bytes=paper.final_report_file_size_bytes,
                final_report_uploaded_at=paper.final_report_uploaded_at,
            )
            for paper in papers
        ]

    @strawberry.field(permission_classes=[IsProfessor])
    def supervised_progress_reports(self, info: strawberry.Info) -> list[schemas.ProgressReportSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        rows = (
            db.query(models.ProgressReports, models.User.name, models.ResearchPhase)
            .join(models.Papers, models.ProgressReports.paper_id == models.Papers.id)
            .join(models.User, models.ProgressReports.submitted_by == models.User.id)
            .outerjoin(models.ResearchPhase, models.ProgressReports.phase_id == models.ResearchPhase.id)
            .filter(
                models.Papers.supervisor_id == current_user.id,
                models.ProgressReports.status != "draft",
            )
            .order_by(models.ProgressReports.submitted_at.desc())
            .all()
        )
        return [
            schemas.ProgressReportSchema(
                id=report.id,
                paper_id=report.paper_id,
                submitted_by=report.submitted_by,
                submitted_by_name=submitted_by_name,
                content=report.content,
                status=report.status,
                submitted_at=report.submitted_at,
                original_filename=report.original_filename,
                file_size_bytes=report.file_size_bytes,
                review_comment=report.review_comment,
                reviewed_by_name=current_user.name if report.reviewed_by == current_user.id else None,
                uploaded_at=report.uploaded_at,
                phase_id=report.phase_id,
                phase_label=phase.label if phase else None,
                deadline_at=phase.deadline_at if phase else None,
            )
            for report, submitted_by_name, phase in rows
        ]

    @strawberry.field(permission_classes=[IsProfessor])
    def supervised_defenses(self, info: strawberry.Info) -> list[schemas.DefenseSchema]:
        """Defenses of work the professor supervises, and defenses they sit on the panel of."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        return [defenses.defense_schema(db, defense) for defense in defenses.defenses_for_professor(db, current_user.id)]

    @strawberry.field(permission_classes=[IsAuthenticated])
    def research_phases(self, info: strawberry.Info) -> list[schemas.ResearchPhaseSchema]:
        """Timeline phases applicable to the signed-in user's department — and, for a
        student, only the phases for their own degree level."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        role = getattr(current_user.role, "value", current_user.role)
        query = active_phases(db.query(models.ResearchPhase))
        if role != "super_admin":
            query = query.filter(
                or_(models.ResearchPhase.department_id == current_user.department_id, models.ResearchPhase.department_id.is_(None))
            )
        if role == "student":
            level = constraints.get_degree_level(db, current_user)
            if level is None:
                return []
            query = query.filter(models.ResearchPhase.degree_level == level)
        phases = query.order_by(models.ResearchPhase.degree_level, models.ResearchPhase.sequence_number).all()
        return [
            schemas.ResearchPhaseSchema(
                id=phase.id, phase_type=phase.phase_type.value, degree_level=phase.degree_level.value,
                department_id=phase.department_id, label=phase.label, sequence_number=phase.sequence_number,
                opens_at=phase.opens_at, deadline_at=phase.deadline_at, defense_date=phase.defense_date,
                grace_period_enabled=phase.grace_period_enabled, created_by=phase.created_by,
                created_at=phase.created_at, is_open=is_phase_open(phase), has_ended=phase_has_ended(phase),
            )
            for phase in phases
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    def my_notifications(self, info: strawberry.Info, limit: int = 50) -> list[schemas.NotificationSchema]:
        """The signed-in user's notifications, newest first, with the phase's dates
        so the client can show them in the viewer's own timezone."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        rows = (
            db.query(models.Notifications, models.ResearchPhase, models.Defenses)
            .outerjoin(models.ResearchPhase, models.Notifications.phase_id == models.ResearchPhase.id)
            .outerjoin(models.Defenses, models.Notifications.defense_id == models.Defenses.id)
            .filter(models.Notifications.user_id == current_user.id)
            .order_by(models.Notifications.created_at.desc())
            .limit(max(1, min(limit, 200)))
            .all()
        )
        return [
            schemas.NotificationSchema(
                id=item.id, type=item.type, title=item.title, message=item.message,
                is_read=item.is_read, created_at=item.created_at, paper_id=item.paper_id,
                phase_id=item.phase_id,
                phase_label=phase.label if phase else None,
                phase_type=phase.phase_type.value if phase else None,
                opens_at=phase.opens_at if phase and not defense else None,
                deadline_at=phase.deadline_at if phase and not defense else None,
                defense_date=defense.defense_date if defense else (phase.defense_date if phase else None),
            )
            for item, phase, defense in rows
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    def proposal_submission_history(self, info: strawberry.Info, proposal_id: uuid.UUID) -> list[schemas.SubmissionHistorySchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).filter(models.Proposals.id == proposal_id).first()
        if not proposal:
            raise Exception("Proposal not found")
        role = getattr(current_user.role, "value", current_user.role)
        permitted = proposal.submitted_by == current_user.id or is_accepted_group_member(db, proposal.id, current_user.id)
        if role == "professor":
            permitted = permitted or proposal.supervisor_id == current_user.id
        if role in {"admin", "super_admin"}:
            owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
            permitted = role == "super_admin" or (owner is not None and owner.department_id == current_user.department_id)
        if not permitted:
            raise Exception("You can't view this proposal's submission history")
        entity_ids = [proposal.id]
        paper = db.query(models.Papers).filter(models.Papers.proposal_id == proposal.id).first()
        if paper:
            entity_ids.extend(row[0] for row in db.query(models.ProgressReports.id).filter(models.ProgressReports.paper_id == paper.id).all())
        entity_ids.extend(defense.id for defense in defenses._defenses_for_proposals(db, [proposal.id]))
        # A separate reviewer alias avoids ambiguous joins to users.
        reviewer = aliased(models.User)
        rows = (
            db.query(models.SubmissionHistory, models.ResearchPhase.label, models.User.name, reviewer.name)
            .outerjoin(models.ResearchPhase, models.SubmissionHistory.phase_id == models.ResearchPhase.id)
            .outerjoin(models.User, models.SubmissionHistory.submitted_by == models.User.id)
            .outerjoin(reviewer, models.SubmissionHistory.reviewed_by == reviewer.id)
            .filter(models.SubmissionHistory.entity_id.in_(entity_ids))
            .order_by(models.SubmissionHistory.created_at.asc())
            .all()
        )
        return [
            schemas.SubmissionHistorySchema(
                id=item.id, entity_type=item.entity_type.value, entity_id=item.entity_id,
                phase_id=item.phase_id, phase_label=phase_label, submitted_by=item.submitted_by,
                submitted_by_name=submitted_by_name, status=item.status.value,
                reviewed_by=item.reviewed_by, reviewed_by_name=reviewed_by_name,
                comments=item.comments, original_filename=item.original_filename, created_at=item.created_at,
            )
            for item, phase_label, submitted_by_name, reviewed_by_name in rows
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    def defense_panel(self, info: strawberry.Info, defense_id: uuid.UUID) -> list[schemas.DefensePanelSchema]:
        db = info.context["db"]
        current_user = info.context["current_user"]
        defense = db.query(models.Defenses).filter(models.Defenses.id == defense_id).first()
        if not defense:
            raise Exception("Defense not found")
        subject = defenses.defense_subject(db, defense)
        role = getattr(current_user.role, "value", current_user.role)
        permitted = role == "super_admin" or current_user.id in defenses.defense_stakeholders(db, defense, subject)
        if role == "admin":
            permitted = defenses.subject_department_id(db, subject) == current_user.department_id
        if not permitted:
            raise Exception("You can't view this defense panel")
        professor = aliased(models.User)
        rows = db.query(models.DefensePanel, professor.name).join(professor, models.DefensePanel.professor_id == professor.id).filter(models.DefensePanel.defense_id == defense_id).all()
        return [schemas.DefensePanelSchema(id=panel.id, defense_id=panel.defense_id, professor_id=panel.professor_id, professor_name=name, created_at=panel.created_at) for panel, name in rows]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def department_papers(self, info: strawberry.Info) -> list[schemas.PaperSchema]:
        """Every paper supervised by a professor in the admin's own department —
        this is how the admin finds which paper to schedule a defense for."""
        db = info.context["db"]
        current_user = info.context.get("current_user")
        supervisor = aliased(models.User)
        query = db.query(models.Papers, supervisor.name).join(supervisor, models.Papers.supervisor_id == supervisor.id)
        if current_user and getattr(current_user.role, "value", current_user.role) == "admin":
            query = query.filter(supervisor.department_id == current_user.department_id)
        rows = query.order_by(models.Papers.created_at.desc()).all()
        return [
            schemas.PaperSchema(
                id=paper.id,
                proposal_id=paper.proposal_id,
                title=paper.title,
                status=paper.status,
                supervisor_id=paper.supervisor_id,
                supervisor_name=supervisor_name,
                cluster_id=paper.cluster_id,
                final_report_status=paper.final_report_status,
                final_report_review_comment=paper.final_report_review_comment,
                final_report_original_filename=paper.final_report_original_filename,
                final_report_file_size_bytes=paper.final_report_file_size_bytes,
                final_report_uploaded_at=paper.final_report_uploaded_at,
                degree_level=_paper_level(db, paper),
            )
            for paper, supervisor_name in rows
        ]

    @strawberry.field(permission_classes=[IsAdminOrSuperAdmin])
    def department_defenses(self, info: strawberry.Info) -> list[schemas.DefenseSchema]:
        """Every planned defense in the admin's department, of any phase type."""
        db = info.context["db"]
        current_user = info.context.get("current_user")
        is_admin = getattr(current_user.role, "value", current_user.role) == "admin"
        results = []
        for defense in db.query(models.Defenses).order_by(models.Defenses.defense_date.desc()).all():
            if is_admin and defenses.subject_department_id(db, defenses.defense_subject(db, defense)) != current_user.department_id:
                continue
            results.append(defenses.defense_schema(db, defense))
        return results

    @strawberry.field(permission_classes=[IsDepartmentAdmin])
    def defense_candidates(self, info: strawberry.Info, degree_level: str, kind: str) -> list[schemas.DefenseCandidateSchema]:
        """Everything at one degree level in the admin's department that can be defended:
        kind "proposal" = submitted proposals, "progress_report" = submitted progress
        reports, "defense" = papers whose final report was approved. Each carries its
        current (not failed) defense, if one is planned."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        try:
            level = models.DegreeLevel(degree_level.strip().lower())
        except ValueError:
            raise Exception("Degree level must be bachelors, masters or phd")
        if kind not in {"proposal", "progress_report", "defense"}:
            raise Exception("Kind must be proposal, progress_report or defense")

        def in_scope(proposal):
            owner = db.get(models.User, proposal.submitted_by) if proposal and proposal.submitted_by else None
            return bool(owner and owner.department_id == current_user.department_id and constraints.get_degree_level(db, owner) == level)

        def people(proposal):
            students = [user.name for user in proposal_group_member_users(db, proposal)]
            supervisor = db.query(models.User.name).filter(models.User.id == proposal.supervisor_id).scalar() if proposal.supervisor_id else None
            return students, supervisor

        def planned(column, target_id):
            defense = db.query(models.Defenses).filter(column == target_id, models.Defenses.current_status != "rejected").order_by(models.Defenses.created_at.desc()).first()
            return defenses.defense_schema(db, defense) if defense else None

        def phase_label(phase_id):
            return db.query(models.ResearchPhase.label).filter(models.ResearchPhase.id == phase_id).scalar() if phase_id else None

        candidates = []
        if kind == "proposal":
            proposals = db.query(models.Proposals).filter(
                models.Proposals.deleted_at.is_(None),
                models.Proposals.status.notin_(["draft", "withdrawn", "rejected"]),
            ).order_by(models.Proposals.created_at).all()
            for proposal in proposals:
                if not in_scope(proposal):
                    continue
                students, supervisor = people(proposal)
                candidates.append(schemas.DefenseCandidateSchema(
                    kind=kind, target_id=proposal.id, title=proposal.title, status=proposal.status,
                    student_names=students, supervisor_name=supervisor,
                    phase_id=proposal.phase_id, phase_label=phase_label(proposal.phase_id),
                    report_filename=proposal.original_filename,
                    defense=planned(models.Defenses.proposal_id, proposal.id),
                ))
        elif kind == "progress_report":
            rows = (
                db.query(models.ProgressReports, models.Papers, models.Proposals)
                .join(models.Papers, models.ProgressReports.paper_id == models.Papers.id)
                .join(models.Proposals, models.Papers.proposal_id == models.Proposals.id)
                .filter(models.ProgressReports.status != "draft", models.Proposals.deleted_at.is_(None))
                .order_by(models.ProgressReports.submitted_at)
                .all()
            )
            for report, paper, proposal in rows:
                if not in_scope(proposal):
                    continue
                students, supervisor = people(proposal)
                candidates.append(schemas.DefenseCandidateSchema(
                    kind=kind, target_id=report.id, title=paper.title, status=report.status,
                    student_names=students, supervisor_name=supervisor,
                    phase_id=report.phase_id, phase_label=phase_label(report.phase_id),
                    report_filename=report.original_filename,
                    defense=planned(models.Defenses.progress_report_id, report.id),
                ))
        else:
            rows = (
                db.query(models.Papers, models.Proposals)
                .join(models.Proposals, models.Papers.proposal_id == models.Proposals.id)
                .filter(models.Papers.final_report_status == "approved", models.Proposals.deleted_at.is_(None))
                .order_by(models.Papers.created_at)
                .all()
            )
            for paper, proposal in rows:
                if not in_scope(proposal):
                    continue
                students, supervisor = people(proposal)
                subject = defenses.DefenseSubject(kind="defense", title=paper.title, proposal=proposal, paper=paper, report=None)
                phase = defenses.final_defense_phase(db, subject, current_user.department_id)
                candidates.append(schemas.DefenseCandidateSchema(
                    kind=kind, target_id=paper.id, title=paper.title, status="final report approved",
                    student_names=students, supervisor_name=supervisor,
                    phase_id=phase.id if phase else None, phase_label=phase.label if phase else None,
                    suggested_date=phase.defense_date if phase else None,
                    report_filename=paper.final_report_original_filename,
                    defense=planned(models.Defenses.paper_id, paper.id),
                ))
        return candidates

    @strawberry.field(permission_classes=[IsProfessor])
    def my_panel_defenses(self, info: strawberry.Info) -> list[schemas.DefenseSchema]:
        """Defenses the professor sits on the panel of, soonest first."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        rows = (
            db.query(models.Defenses)
            .join(models.DefensePanel, models.DefensePanel.defense_id == models.Defenses.id)
            .filter(models.DefensePanel.professor_id == current_user.id)
            .order_by(models.Defenses.defense_date.asc(), models.Defenses.scheduled_time.asc())
            .all()
        )
        return [defenses.defense_schema(db, defense) for defense in rows]

def _level_value(level):
    return level.value if level else None


def _paper_level(db, paper):
    proposal = db.get(models.Proposals, paper.proposal_id) if paper.proposal_id else None
    owner = db.get(models.User, proposal.submitted_by) if proposal and proposal.submitted_by else None
    return _level_value(constraints.get_degree_level(db, owner))
