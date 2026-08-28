import strawberry


#Mutation inputs to validate the data
@strawberry.input
class PostInput:
    # id :int
    title:str
    content: str
    # published : bool
    # user_id : int

@strawberry.input
class PostUpdate:
    post_id : int
    title : str
    content : str
    # published : bool

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