import { Routes , Route} from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import './App.css'

function App(){
    return(
      <>
        <Routes>
            <Route element = {<AdminDashboard/>} path = 'dashboard'></Route>
            <Route></Route>
        </Routes>
      </>
    )
}

export default App