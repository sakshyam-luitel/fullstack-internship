import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($userInput: UserLoginInput!) {
    login(userInput: $userInput) {
      accessToken
      tokenType
    }
  }
`;
