from fastapi import status , HTTPException , Depends, APIRouter , Response
from ..import models, schemas
from ..database import engine , get_db
from . import oauth2
from sqlalchemy.orm import Session

router = APIRouter(
    prefix = "/posts",
    tags = ['Posts']
)

@router.get("/")
def get_posts(db : Session = Depends(get_db) , response_model = schemas.Post):
    # cursor.execute("""SELECT * FROM posts""")
    # posts = cursor.fetchall()
    posts = db.query(models.Post).all()
    
    print(posts)
    return posts



@router.post("/" , status_code = status.HTTP_201_CREATED , response_model = schemas.Post)
def create_posts(post : schemas.PostBase , db: Session = Depends(get_db) , user_id : int = Depends(oauth2.verify_access_token)):
    # cursor.execute(""" INSERT INTO posts (title , content , published) VALUES (%s , %s , %s) RETURNING *""" , (post.title , post.content , post.published))
    # new_post = cursor.fetchone()
    # conn.commit()
    # new_post =  models.Post(title = post.title , content = post.content , published = post.published)
    
    new_post = models.Post(**post.dict())
    
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post

# def find_post(id):
#     for post in my_posts:
#         if post['id'] == id:
#             return post

# @app.get('/posts/latest')
# def get_post():
#     post = my_posts[-1]
#     return {"details" : post}


@router.get('/{id}', response_model = schemas.Post)
def get_post(id : int , db: Session = Depends(get_db)):
    # post = find_post(id)  
    # cursor.execute("""SELECT * FROM posts WHERE id=%s""" , (str(id)))
    # post = cursor.fetchone()
    post = db.query(models.Post).filter(models.Post.id == id).first()

    # print(post)
    #post = find_post(id)
    if not post : 
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND , detail = f"post with id : {id} was not found")
        # response.status_code = status.HTTP_404_NOT_FOUND
        # return {"message" : f"post with id: {id} was not found"}
    return post

@router.delete('/{id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_posts(id: int , db: Session = Depends(get_db)):
    # cursor.execute("""DELETE FROM posts WHERE id = %s RETURNING *""", (str(id),))
    # deleted_post = cursor.fetchone()
    # conn.commit()
    
    
    post = db.query(models.Post).filter(models.Post.id == id)

    if not post.first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"post with id: {id} was not found"
        )
    
    post.delete(synchronize_session = False)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

# def find_index_post(id):
#     for index , post in enumerate(my_posts):
#         if post['id'] == id:
#             return index
        
@router.put('/{id}' ,status_code = status.HTTP_200_OK )
def update_post(id : int , updated_post : schemas.PostBase ,response_model = schemas.Post, db : Session = Depends(get_db)):
    #index = find_index_post(id)
    # cursor.execute("""UPDATE posts SET title=%s,content=%s, published=%s  WHERE id=%s RETURNING *""",(post.title , post.content,post.published,str(id )))

    # post = cursor.fetchone()

    # conn.commit()
    
    post_query = db.query(models.Post).filter(models.Post.id == id)
    post = post_query.first()
    if not post:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail= f"post with id : {id} was not found"
            )
    # post_dict = post.dict()
    # post_dict['id'] = id
    # my_posts[index] = post_dict
    post_query.update(updated_post.dict() , synchronize_session = False)
    db.commit()
    
    return post_query.first()


