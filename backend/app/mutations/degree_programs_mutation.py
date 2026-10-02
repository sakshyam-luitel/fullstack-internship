import strawberry
from app.permissions import IsDepartmentAdmin
from app import mutation_input , schemas , models

@strawberry.type
class DegreeProgramsMutation:
    # Mutation to create degree programs
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def create_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramsInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program = models.DegreePrograms(
            name = admin_input.name,
            level = admin_input.level,
            department_id = admin_input.department_id
        )
        
        db.add(degree_program)
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value
            ,department_id = degree_program.department_id
        )
    
    # Mutation to update Degree Programs
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramUpdateInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program = db.query(models.DegreePrograms).filter(models.DegreePrograms.id == admin_input.id).first()
        if not degree_program:
            raise Exception(f"The degree with {admin_input.id} was not found")
        
        degree_program.name = admin_input.name
        degree_program.level = admin_input.level
        degree_program.department_id = admin_input.department_id
    
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value,
            department_id = degree_program.department_id
        )
        
    # Mutation to delete a degree program
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def delete_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramDeleteInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program_query = db.query(models.DegreePrograms).filter(models.DegreePrograms.id == admin_input.id)
        degree_program = degree_program_query.first()
        if not degree_program:
            raise Exception(f"Degree program with {id} was not found")
        
        deleted_degree_program = schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value,
            department_id = degree_program.department_id
        )
        
        degree_program_query.delete(synchronize_session = False)
        db.commit()
         
        return deleted_degree_program
        