import strawberry
from app.permissions import IsSuperAdmin
from app import mutation_input , schemas , models


@strawberry.type
class DepartmentMutation:
    
    # Mutation to create a new department
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def create_department(self, info : strawberry.Info , admin_input : mutation_input.DepartmentCreateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = models.Department(
            name = admin_input.name,
            code = admin_input.code
        )
        
        db.add(department)
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(    
            id=department.id,
            name = department.name,
            code = department.code,
            created_at=department.created_at,
        )

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def update_department(self, info: strawberry.Info, admin_input: mutation_input.DepartmentUpdateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(models.Department.id == admin_input.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")

        department.name = admin_input.name
        department.code = admin_input.code
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            id=department.id,
            name=department.name,
            code=department.code,
            created_at=department.created_at,
        )

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def delete_department(self, info: strawberry.Info, admin_input: mutation_input.DepartmentDeleteInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(models.Department.id == admin_input.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")

        deleted_department = schemas.DepartmentSchema(
            id=department.id,
            name=department.name,
            code=department.code,
            created_at=department.created_at,
        )

        department.is_active = False
        db.commit()
        db.refresh(department)
        return deleted_department
        
    
    # Mutation to Update the department
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def update_deparment(self , info : strawberry.Info , admin_input : mutation_input.DepartmentUpdateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(admin_input.id == models.Department.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")
        
        department.name = admin_input.name
        department.code = admin_input.code
        
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            id=department.id,
            name = department.name,
            code = department.code,
            created_at=department.created_at,
        )
    