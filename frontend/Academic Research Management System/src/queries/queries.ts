import { gql } from "@apollo/client";

export const CURRENT_USER_QUERY = gql`
    query CurrentUser {
        currentUser {
            id
            departmentId
            name
            email
            role
            createdAt
        }
    }
`;

export const DEPARTMENTSQUERY = gql`
    query Departments {
        departments {
            id
            name
            code
        }
    }
`;

export const USERSQUERY = gql`
    query Users{
        users{
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
