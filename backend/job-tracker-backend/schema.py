import typing
import strawberry

def get_books():
    return[
        Book(
            title = "Harry Potter",
            author = "JK rowling",
        ),
    ]

@strawberry.type
class Book:
    title : str
    author : str
    
@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "Hello world"

    books : typing.List[Book] = strawberry.field(resolver = get_books)
    
    
schema = strawberry.Schema(query = Query)