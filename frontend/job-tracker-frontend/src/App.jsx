import { Route, Routes } from "react-router-dom"
import Posts from './pages/Posts'
import Login from './pages/Login'
import Register from './pages/Register'

function App(){
  return(
    <>
        <Routes>
          <Route path="/" element={<Login/>} />
          <Route path="/posts" element={<Posts/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
        </Routes>
    </>
  )
}

export default App