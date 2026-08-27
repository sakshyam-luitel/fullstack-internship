// import { gql } from "@apollo/client";

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