import strawberry , psycopg2 , time
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from strawberry.fastapi import GraphQLRouter
import os
from . import models , database
from . auth import Login
from . queries import UserQuery
from . schemas import TokenSchema , TokenData , UserSchema
from . oauth2 import get_context
from . utils import UPLOAD_ROOT
from . file_storage import STORAGE_ROOT
from . files import router as files_router
from fastapi.middleware.cors import CORSMiddleware

from app.mutations.user_mutation import UserMutation
from app.mutations.department_mutation import DepartmentMutation
from app.mutations.degree_programs_mutation import DegreeProgramsMutation
from app.mutations.clusters_mutation import ClustersMutation
from app.mutations.student_profile_mutation import StudentProfilesMutation
from app.mutations.professor_profile_mutation import ProfessorProfileMutation
from app.mutations.proposals_mutation import ProposalsMutation
from app.mutations.proposal_candidate_mutation import ProposalCandidateMutation
from app.mutations.progress_report_mutation import ProgressReportMutation
from app.mutations.defense_mutation import DefenseMutation
from app.mutations.paper_mutation import PaperMutation
from app.mutations.research_phase_mutation import ResearchPhaseMutation
from app.mutations.batch_mutation import BatchMutation
from app.mutations.notifications_mutation import NotificationMutation
# Wait for Postgres before touching it. This has to run before create_all(): that
# call opens its own connection, so with the order reversed the process died on the
# first connection error and never reached the retry loop it is guarded by.
while True:
    try:
        conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
        cursor = conn.cursor()
        print('Database connection was successful') 
        break
    except Exception as error:
        print('Connecting to database failed')
        print('Error:', error)
        time.sleep(2)

# models.Base.metadata.create_all(bind = database.engine)


@strawberry.type
class Mutation(
    UserMutation,
    Login,
    DepartmentMutation,
    DegreeProgramsMutation,
    ClustersMutation,
    StudentProfilesMutation,
    ProfessorProfileMutation,
    ProposalsMutation,
    ProposalCandidateMutation,
    ProgressReportMutation,
    DefenseMutation,
    PaperMutation,
    ResearchPhaseMutation,
    BatchMutation,
    NotificationMutation
    ):
    pass

@strawberry.type
class Schema(TokenData , TokenSchema , UserSchema, UserQuery):
    pass

schema = strawberry.Schema(Schema , Mutation)

# Profile pictures are uploaded as GraphQL multipart requests (uploadProfileImage),
# which Strawberry rejects unless enabled. The usual CSRF concern with multipart
# uploads doesn't apply: requests are authenticated by a Bearer header, which a
# cross-site form can't send, not by cookies.
graphql_app = GraphQLRouter(schema , context_getter = get_context, multipart_uploads_enabled = True)

app = FastAPI()
origins = [
    "http://localhost:5174",
    "http://localhost:5173",
    "http://10.1.186.127:5173",
    "http://192.168.18.98:5173",
    "https://arms-frontend-5znt.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = [ "*"],
    allow_origins = origins
)
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")
app.include_router(files_router)
app.include_router(graphql_app , prefix = '/graphql')
