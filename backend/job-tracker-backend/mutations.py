import strawberry
from mutation_input import PostInput , PostDelete ,PostUpdate, UserRegister 
import schemas
import models
from utils import get_password_hash


# POSTS mutation
@strawberry.type
class PostMutation:
    # Mutation to create posts on the database
    @strawberry.mutation
    def create_posts(self,post:PostInput , info:strawberry.Info) -> schemas.Posts:
       db = info.context['db']
       user_id = info.context.get('user_id')
       if user_id is None:
           raise Exception("User not logged in")
       
       new_post = models.Post(
            # id = post.id,
            title=post.title,
            content=post.content,
            published=post.published,
            user_id= user_id
            )
       db.add(new_post)
       db.commit()
       db.refresh(new_post)
       
       return schemas.Posts(
           id = new_post.id,
           title = new_post.title,
           content = new_post.content,
           created_at= new_post.created_at,
           user_id = new_post.user_id)
       
    # Mutation to update posts on the database
    @strawberry.mutation
    def update_posts(self, info: strawberry.Info, post_input: PostUpdate) -> schemas.Posts:
        db = info.context['db']
        user_id = info.context.get('user_id')
        if user_id is None:
            raise Exception("Not Authenticated")

        post = (
            db.query(models.Post)
            .filter(models.Post.id == post_input.post_id, models.Post.user_id == user_id)
            .first()
        )

        if not post:
            raise Exception(f"Post with id {post_input.post_id} not found")

        post.title = post_input.title
        post.content = post_input.content
        post.published = post_input.published

        db.commit()
        db.refresh(post)

        return schemas.Posts(
            id=post.id,
            title=post.title,
            content=post.content,
            published=post.published,
            created_at=post.created_at,
            user_id=post.user_id
        )
    
    # Mutation to delete posts from the database
    @strawberry.mutation
    def delete_posts(self , info: strawberry.Info , post_input : PostDelete) -> schemas.Posts:
        db = info.context["db"]
        user_id = info.context["user_id"]
        if not user_id:
            raise Exception('Not Authenticated')

        post_query = db.query(models.Post).filter(models.Post.id == post_input.id , models.Post.user_id == user_id)
        post = post_query.first()
        if not post:
            raise Exception(f"Post with id {post_input.id} not found")
        
        deleted_post = schemas.Posts(
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
    

# User Mutation for CRUD
@strawberry.type
class UserMutation:
    # Mutation to create user on the database
    @strawberry.mutation
    def create_user(self , info: strawberry.Info ,user_input : UserRegister ) -> schemas.Users:
        db = info.context['db']
        hashed_password = get_password_hash(user_input.password)
        new_user = models.User(
            email = user_input.email,
            password = hashed_password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return schemas.Users(
            id = new_user.id,
            email = new_user.email,
            created_at = new_user.created_at
        )