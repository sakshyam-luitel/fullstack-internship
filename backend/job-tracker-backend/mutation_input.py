import strawberry


#Mutation inputs to validate the data
@strawberry.input
class PostInput:
    title:str
    content: str

@strawberry.input
class PostUpdate:
    post_id : int
    title : str
    content : str

@strawberry.input
class PostDelete:
    id : int
    
@strawberry.input
class UserRegister:
    email: str
    password : str
    
@strawberry.input
class UserLogin:
    email : str
    password : str