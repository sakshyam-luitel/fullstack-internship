import strawberry , psycopg2 , time
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
import os
from . import models , database
from . mutations import UserMutation
from . auth import Login
from . schemas import TokenSchema , TokenData , UserSchema
from . oauth2 import get_context

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
class Mutation(UserMutation, Login):
    pass

@strawberry.type
class Schema(TokenData , TokenSchema , UserSchema):
    pass

schema = strawberry.Schema(Schema , Mutation)

graphql_app = GraphQLRouter(schema , context_getter = get_context )

app = FastAPI()
app.include_router(graphql_app , prefix = '/graphql')
