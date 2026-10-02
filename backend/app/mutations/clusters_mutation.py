import strawberry
from app.permissions import IsDepartmentAdmin
from app import mutation_input , models , schemas

@strawberry.type
class ClustersMutation:
    # Mutation to create cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def create_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterInput) -> schemas.ClusterSchema:
        db = info.context["db"]
        cluster = models.Clusters(
            department_id = admin_input.department_id,
            name = admin_input.name
        )
        
        db.add(cluster)
        db.commit()
        db.refresh(cluster)

        return schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name
        )
    
    # Mutation to update cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterUpdateInput)-> schemas.ClusterSchema:
        db = info.context["db"]
        cluster = db.query(models.Clusters).filter(models.Clusters.id == admin_input.id).first()
        if not cluster:
            raise Exception(f"Cluster with {admin_input.id} does not exist")
        
        cluster.name = admin_input.name
        cluster.department_id = admin_input.department_id
        
        db.commit()    
        return schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name,
        )
    
    # mutation to delete cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def delete_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterDeleteInput) -> schemas.ClusterSchema:
        db = info.context["db"]
        cluster_query = db.query(models.Clusters).filter(models.Clusters.id == admin_input.id)
        cluster = cluster_query.first()
        
        if not cluster:
            raise Exception(f"Cluster with given {admin_input.id} does not exist")
        
        deleted_cluster = schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name
        )

        
        cluster_query.delete(synchronize_session = False)
        db.commit()
        
        return deleted_cluster