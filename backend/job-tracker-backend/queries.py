import strawberry
import models , schemas , oauth2
from fastapi import Depends
#Post Query to retrieve all data from database
@strawberry.type
class PostQuery:
    @strawberry.field
    def get_posts(self , info: strawberry.Info) -> list[schemas.Posts]:
        db = info.context["db"]
        user_id = info.context.get("user_id")
        if user_id is None:
            raise Exception('Not Authenticated')
        posts = db.query(models.Post).all()
        
        return[
            schemas.Posts(
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
class UserQuery:
    @strawberry.field
    def get_users(self, info : strawberry.Info) -> list[schemas.Users]:
        db = info.context['db']
        users = db.query(models.User).all()
        if not users:
            raise Exception("Users not found")

        return [
            schemas.Users(
            id = u.id,
            email = u.email, 
            created_at= u.created_at
        )
            for u in users
            ]