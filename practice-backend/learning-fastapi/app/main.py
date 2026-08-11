from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.params import Body
from typing import Optional
from random import randrange
from fastapi import Response , status , HTTPException
import psycopg2
from enum import Enum
import time
from dotenv import load_dotenv
import os


load_dotenv()


app = FastAPI()

my_posts = [
    {"title" : "title of post 1", "content" : "content of post 1" , "id" : 1},
    {"title" : "favourite foods" , "content" : "I like pizza" , "id" : 2},
]

@app.get('/')
async def root():
    return {'hello':'my friend'}

@app.get('/items/{item_id}')
async def read_item(item_id : int):
    return {"item_id" : item_id}

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
   
class Modelname(str , Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get('/models/{model_name}')
async def get_model(model_name : Modelname):
    if model_name is Modelname.alexnet:
        return {"model_name": model_name , "message" : "Deep Learning FTW!"}
    elif model_name is Modelname.resnet:   
        return  {"model_name" : model_name , "mesage":"LeCNN all images"}
    elif model_name is Modelname.lenet:
        return {"model_name" : model_name , "message":"Have some residuals"}

fake_items_db = [
    { "item_name" : "Foo" },
    { "item_name" : "Bar"},
    { "item_name" : "Baz"}
]


@app.get('/item')
async def read_item(skip : int = 0 , limit : int = 10):
    return fake_items_db[skip : skip + limit]

class Item(BaseModel):
    name : str
    description : str | None = None
    price : float
    tax : float | None = None

@app.post("/items")
async def create_item(item : Item):
    return item

@app.get("/posts")
def get_posts():
    cursor.execute("""SELECT * FROM posts""")
    posts = cursor.fetchall()
    print(posts)
    return {'data' : posts}

class Post(BaseModel):
    title : str
    content : str
    published : bool = True
    rating : Optional[int] = None

@app.post("/posts" , status_code = status.HTTP_201_CREATED)
def create_posts(post : Post):
    cursor.execute(""" INSERT INTO posts (title , content , published) VALUES (%s , %s , %s) RETURNING *""" , (post.title , post.content , post.published))
    new_post = cursor.fetchone()
    conn.commit()
    return { 'data' : new_post}

def find_post(id):
    for post in my_posts:
        if post['id'] == id:
            return post

@app.get('/posts/latest')
def get_post():
    post = my_posts[-1]
    return {"details" : post}


@app.get('/posts/{id}')
def get_post(id : int , response : Response):
    # post = find_post(id)  
    cursor.execute("""SELECT * FROM posts WHERE id=%s""" , (str(id)))
    post = cursor.fetchone()

    print(post)
    #post = find_post(id)
    if not post : 
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND , detail = f"post with id : {id} was not found")
        # response.status_code = status.HTTP_404_NOT_FOUND
        # return {"message" : f"post with id: {id} was not found"}
    return {"post_detail" : post}

@app.delete('/posts/{id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_posts(id: int):
    cursor.execute("""DELETE FROM posts WHERE id = %s RETURNING *""", (str(id),))
    deleted_post = cursor.fetchone()
    conn.commit()

    if not deleted_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"post with id: {id} was not found"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)

def find_index_post(id):
    for index , post in enumerate(my_posts):
        if post['id'] == id:
            return index
        
@app.put('/posts/{id}' ,status_code = status.HTTP_200_OK )
def update_post(id : int , post : Post):
    #index = find_index_post(id)
    cursor.execute("""UPDATE posts SET title=%s,content=%s, published=%s  WHERE id=%s RETURNING *""",(post.title , post.content,post.published,str(id )))

    post = cursor.fetchone()

    conn.commit()
    if not post:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail= f"post with id : {id} was not found"
            )
    # post_dict = post.dict()
    # post_dict['id'] = id
    # my_posts[index] = post_dict
    return {'data' : post}

    

