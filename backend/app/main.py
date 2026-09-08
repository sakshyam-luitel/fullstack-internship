import strawberry , psycopg2 , time
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
import os
from . import models , database
from . mutations import UserMutation , DepartmentMutation , DegreeProgramsMutation , ClustersMutation , StudentProfilesMutation , ProfessorProfileMutation , ProposalsMutation
from . auth import Login
from . queries import UserQuery
from . schemas import TokenSchema , TokenData , UserSchema
from . oauth2 import get_context
from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind = database.engine)

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


@strawberry.type
class Mutation(UserMutation, Login , DepartmentMutation , DegreeProgramsMutation , ClustersMutation , StudentProfilesMutation , ProfessorProfileMutation , ProposalsMutation):
    pass

@strawberry.type
class Schema(TokenData , TokenSchema , UserSchema, UserQuery):
    pass

schema = strawberry.Schema(Schema , Mutation)

graphql_app = GraphQLRouter(schema , context_getter = get_context )

app = FastAPI()

origins = [
    'http://localhost:5173'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins = origins,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = [ "*"]
)
app.include_router(graphql_app , prefix = '/graphql')
