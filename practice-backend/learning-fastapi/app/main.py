from fastapi import FastAPI
import psycopg2
from dotenv import load_dotenv
import os
from . import models
from .database import engine
from .routers import posts, users , auth

import time



models.Base.metadata.create_all(bind = engine)

load_dotenv()


app = FastAPI()

# my_posts = [
#     {"title" : "title of post 1", "content" : "content of post 1" , "id" : 1},
#     {"title" : "favourite foods" , "content" : "I like pizza" , "id" : 2},
# ]

@app.get('/')
async def root():
    return {'hello':'my friend'}

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


app.include_router(posts.router)
app.include_router(users.router)
app.include_router(auth.router)

    
