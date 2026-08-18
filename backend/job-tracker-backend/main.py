import strawberry

from fastapi import FastAPI , status, HTTPException
from strawberry.fastapi import GraphQLRouter
from schema import schema
from database import get_context
import datetime
import models

#Posts Schema
@strawberry.type
class Posts:
    id : int
    title : str
    content : str
    published : bool
    created_at : datetime.datetime
    user_id : int
    
#users Schema
@strawberry.type
class Users:
    id : int
    email : str
    password : str
    created_at : datetime.datetime

#Post Query to retrieve all data from database
@strawberry.type
class PostQuery:
    @strawberry.field
    def get_posts(self , info: strawberry.Info) -> list[Posts]:
        db = info.context["db"]
        posts = db.query(models.Post).all()
        
        return[
            Posts(
                id = p.id,
                title = p.title,
                content = p.content,
                published = p.published,
                created_at = p.created_at,
                user_id = p.user_id
            )
            for p in posts
        ]
        
@strawberry.type
class Query(
    PostQuery
):
    pass

@strawberry.input
class PostInput:
    id :int
    title:str
    content: str
    published : bool
    #user_id : int

@strawberry.input
class PostDelete:
    id : int

@strawberry.type
class PostMutation:
    @strawberry.mutation
    def create_posts(self,post: PostInput , info:strawberry.Info) -> Posts:
       db = info.context['db']
    #    user_id = info.context['user_id']
       
       new_post = models.Post(
            id = post.id,
            title=post.title,
            content=post.content,
            published=post.published,
            user_id=post.user_id
            )
       db.add(new_post)
       db.commit()
       db.refresh(new_post)
       
       return Posts(
           id = new_post.id,
           title = new_post.title,
           content = new_post.content,
           created_at= new_post.created_at,
           user_id = new_post.user_id)
       
    # @strawberry.mutation
    # def update_posts(self, info : strawberry.Info , post_input : PostInput) -> Posts:
    #     db = info.context['db']
    #     post_query = db.query(models.Post).filter(post_input.id == models.Post.id)
    #     post = post_query.first()
    #     if not post:
    #         raise HTTPException(
    #             status_code = status.HTTP_404_NOT_FOUND,
    #             detail = f"User with the given id not found"
    #         )
    #     post_query.update(post_input, synchronize_session = False)
    #     return Posts(
    #         id = post_input.id,
    #         title = post_input.title,
    #         content = post_input.content ,
    #         published = post_input.published,
    #         created_at = post_input.created_at,
    #         user_id = post_input.user_id
    #     )
    @strawberry.mutation
    def update_posts(self, info: strawberry.Info, post_input: PostInput) -> Posts:
        db = info.context['db']
        user_id = info.context['user_id']

        post_query = db.query(models.Post).filter(models.Post.id == post_input.id)
        post = post_query.first()

        if not post:
            raise Exception(f"Post with id {post_input.id} not found")

        post_query.update(
            {
                "title": post_input.title,
                "content": post_input.content,
                "published": post_input.published,
                "user_id": user_id,
            },
            synchronize_session=False
        )
        db.commit()
        db.refresh(post)

        return Posts(
            id=post.id,
            title=post.title,
            content=post.content,
            published=post.published,
            created_at=post.created_at,
            user_id=post.user_id
        )
    
    @strawberry.mutation
    def delete_posts(self , info: strawberry.Info , post_input : PostDelete) -> Posts:
        db = info.context["db"]
        post_query = db.query(models.Post).filter(models.Post.id == post_input.id)
        post = post_query.first()
        if not post:
            raise Exception(f"Post with id {post_input.id} not found")
        
        deleted_post = Posts(
        id=post.id,
        title=post.title,
        content=post.content,
        published=post.published,
        created_at=post.created_at,
        user_id=post.user_id
    )  
        post_query.delete(synchronize_session = False)
        db.commit()
        
        return deleted_post
        
        
        

@strawberry.type
class Mutation(
    PostMutation
):
    pass
                
schema = strawberry.Schema(query=Query, mutation = Mutation)
graphql_app = GraphQLRouter(schema , context_getter = get_context)


app = FastAPI()
app.include_router(graphql_app , prefix = '/graphql')