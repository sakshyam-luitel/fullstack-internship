// import { gql } from "@apollo/client";


//query to get posts
export const POSTS = `
    {
        getPosts{
            id
            title
            content
            published
            createdAt
        }
    }
`