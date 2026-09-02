import strawberry , psycopg2 , time
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
import os
from . import models , database


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
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "Hello world"

schema = strawberry.Schema(Query)

graphql_app = GraphQLRouter(schema)

app = FastAPI()
app.include_router(graphql_app , prefix = '/graphql')
