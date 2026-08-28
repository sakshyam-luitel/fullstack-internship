import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation LoginUser($userInput: UserLogin!) {
    loginUser(userInput: $userInput) {
      accessToken
      tokenType
    }
  }
`;

export const REGISTER = gql`
    mutation CreateUser($userInput : UserRegister!){
        createUser(userInput : $userInput){
            id
            email
            createdAt
        }
    }
`;

export const CREATEPOST = `
    mutation($post : PostInput!){
        createPosts(post: $post)
        {
            title
            content
        }
    }
`

export const DELETEPOST = `
    mutation DeletePost($postInput : PostDelete! ){
        deletePosts(postInput : $postInput){
            title
            content
            published
        }
    }
`;

export const UPDATEPOST = `
    mutation UpdatePosts($postInput : PostUpdate!){
        updatePosts(postInput: $postInput){
            title
            content
            published
        }
    }
`;
