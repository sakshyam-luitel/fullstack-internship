import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($userInput: UserLoginInput!) {
    login(userInput: $userInput) {
      accessToken
      tokenType
      role
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($adminInput: UserInput!) {
    createUser(adminInput: $adminInput) {
      id
      departmentId
      name
      email
      password
      role
      createdAt
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($adminInput: UserUpdateInput!) {
    updateUser(adminInput: $adminInput) {
      id
      departmentId
      name
      email
      password
      role
      createdAt
    }
  }
`;
