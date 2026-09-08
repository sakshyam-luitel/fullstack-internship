import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { ApolloProvider } from "@apollo/client/react";
import { ApolloClient , InMemoryCache} from '@apollo/client'
import { HttpLink } from "@apollo/client";

const client = new ApolloClient({
  link : new HttpLink({uri:"http://localhost:8000/graphql"}),
  cache : new InMemoryCache(),
})

// Mount the application with routing and React's development checks enabled.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client = {client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
