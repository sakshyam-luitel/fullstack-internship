import strawberry
from mutation_input import PostInput , PostDelete , UserRegister
import schemas
import models
from utils import get_password_hash

@strawberry.type
class PostMutation:
    @strawberry.mutation
    def create_posts(self,post:PostInput , info:strawberry.Info) -> schemas.Posts:
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
       
       return schemas.Posts(
           id = new_post.id,
           title = new_post.title,
           content = new_post.content,
           created_at= new_post.created_at,
           user_id = new_post.user_id)
       
    @strawberry.mutation
    def update_posts(self, info: strawberry.Info, post_input: PostInput) -> schemas.Posts:
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

        return schemas.Posts(
            id=post.id,
            title=post.title,
            content=post.content,
            published=post.published,
            created_at=post.created_at,
            user_id=post.user_id
        )
    
    @strawberry.mutation
    def delete_posts(self , info: strawberry.Info , post_input : PostDelete) -> schemas.Posts:
        db = info.context["db"]
        post_query = db.query(models.Post).filter(models.Post.id == post_input.id)
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
    

@strawberry.type
class UserMutation:
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