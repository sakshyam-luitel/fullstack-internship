import { gql } from "@apollo/client";


// mutation to login users
export const LOGIN = gql`
  mutation LoginUser($userInput: UserLogin!) {
    loginUser(userInput: $userInput) {
      accessToken
      tokenType
    }
  }
`;


// mutation to register users
export const REGISTER = gql`
    mutation CreateUser($userInput : UserRegister!){
        createUser(userInput : $userInput){
            id
            email
            createdAt
        }
    }
`;

//mutation to create post
export const CREATEPOST = `
    mutation($post : PostInput!){
        createPosts(post: $post)
        {
            title
            content
        }
    }
`

// mutation to delete post
export const DELETEPOST = `
    mutation DeletePost($postInput : PostDelete! ){
        deletePosts(postInput : $postInput){
            title
            content
            published
        }
    }
`;

//mutation to update post
export const UPDATEPOST = `
    mutation UpdatePosts($postInput : PostUpdate!){
        updatePosts(postInput: $postInput){
            title
            content
            published
        }
    }
`;
