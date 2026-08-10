from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

@app.get('/')
async def root():
    return {'hello':'world'}

@app.get('/items/{item_id}')
async def read_item(item_id : int):
    return {"item_id" : item_id}

from enum import Enum

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


@app.get('/items')
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