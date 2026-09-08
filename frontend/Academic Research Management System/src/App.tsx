import { Routes , Route} from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import './App.css'


function App(){
    return(
      <>
        <Routes>
            <Route element={<Login />} path="/" />
            <Route element={<Login />} path="/login" />
            <Route element = {<AdminDashboard/>} path = 'dashboard'></Route>
        </Routes>
      </>
    )
}

export default App