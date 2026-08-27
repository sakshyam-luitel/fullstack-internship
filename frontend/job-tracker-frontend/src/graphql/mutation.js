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

export const CREATEPOST = gql`
    mutation($userCreatePost : PostInput!){
        createPosts(userCreatePost : $userCreatePost)
        {
            title
            content
            createdAt
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

export const UPDATEPOST = gql`
    mutation UpdatePosts($userUpdatePost : PostUpdate!){
        updatePosts(userUpdatePost : $userUpdatePost){
            title
            content
            published
        }
    }
`;
