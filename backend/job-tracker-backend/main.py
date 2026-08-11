import graphene
from fastapi import FastAPI
from starlette.graphql import GraphQLApp

app = FastAPI()

class CreateNewPost(graphene.Mutation):
    class Arguements:
        title = graphene.String(required = True)
        content = graphene.String(required = True)
    ok = graphene.Boolean()
    

class PostMutations(graphene.ObjectType):
    create_new_post = CreateNewPost.Field()

app.add_route("/graphql" , GraphQLApp(schema= graphene.Schema()))