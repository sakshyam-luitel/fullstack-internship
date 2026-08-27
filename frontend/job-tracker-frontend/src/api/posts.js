import { POSTS } from "../graphql/queries";
import { DELETEPOST } from "../graphql/mutation";

export async function getPosts() {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      console.warn("No auth token found. Please log in first.");
      return [];
    }

    const response = await fetch("http://localhost:8000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `${POSTS}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Posts GraphQL result:", result);

    if (result?.errors) {
      console.error("GraphQL errors while fetching posts:", result.errors);
      return [];
    }

    return result?.data?.getPosts ?? [];
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return [];
  }
}

export async function deletePost(id){
    try{
        const token = localStorage.getItem('token')
        const response = await fetch('http://localhost:8000/graphql',{
            method : "POST",
            headers : {
                "Content-Type":"application/json",
                Authorization : `Bearer ${token}`
            },
            body : JSON.stringify({
                query : DELETEPOST,
                variables: { postInput: { id } }
            })
        })
        if(!response.ok){
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json()
        if(result?.errors){
            console.log('Error occured while fetching data' , result.errors)
        }
        return result?.data?.deletePosts?? [];
    }catch(error){
        console.log(error)
    }
}