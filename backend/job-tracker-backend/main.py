import strawberry

from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
from oauth2 import get_context
from queries import PostQuery , UserQuery
from mutations import PostMutation , UserMutation
from auth import LoginUserMutation

from fastapi.middleware.cors import CORSMiddleware
                
@strawberry.type
class Query(
    PostQuery,
    UserQuery
):
    pass  

@strawberry.type
class Mutation(
    PostMutation,
    UserMutation,
    LoginUserMutation
):
    pass
                
schema = strawberry.Schema(query=Query, mutation = Mutation)
graphql_app = GraphQLRouter(schema , context_getter = get_context)


app = FastAPI()
app.include_router(graphql_app , prefix = '/graphql')

app.add_middleware(
    CORSMiddleware,
    allow_origins = [
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=["*"]
)
