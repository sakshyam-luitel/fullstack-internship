import strawberry
from sqlalchemy import Uuid
from . import mutation_input
from . import schemas
from . import models
from . utils import get_password_hash
from . permissions import IsAdmin

@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_user(self , info : strawberry.Info , admin_input : mutation_input.UserMutationInput ) -> schemas.UserSchema:
        db = info.context.get("db")
        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = admin_input.department_id,
            name = admin_input.name,
            email = admin_input.email,
            password = hashed_password,
            role = admin_input.role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return schemas.UserSchema(
            name = user.name,
            email = user.email,
            department_id = user.department_id,
            role = user.role
        )
    

@strawberry.type
class DepartmentMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_departments(self, info : strawberry.Info , admin_input : mutation_input.DepartmentMutationInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = models.Department(
            name = admin_input.name,
            code = admin_input.code
        )
        
        db.add(department)
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            name = department.name,
            code = department.code
        )
    
@strawberry.type
class DegreeProgramsMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_degree_programs(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramsInput) -> schemas.DegreeProgramsSchema:
        db = info.context["db"]
        degree_program = models.DegreePrograms(
            name = admin_input.name,
            level = admin_input.level,
            department_id = admin_input.department_id
        )
        
        db.add(degree_program)
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramsSchema(
            name = degree_program.name,
            level = degree_program.level
        )
        
@strawberry.type
class ClustersMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_clusters(self , info : strawberry.Info , admin_input : mutation_input.ClustersInput) -> schemas.ClustersSchema:
        db = info.context["db"]
        cluster = models.Clusters(
            department_id = admin_input.department_id,
            name = admin_input.name
        )
        
        db.add(cluster)
        db.commit()
        db.refresh(cluster)

        return schemas.ClustersSchema(
            name = cluster.name
        )
        

    