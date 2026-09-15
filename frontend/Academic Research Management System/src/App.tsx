import { Routes , Route} from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import ProfessorDashboard from './pages/ProfessorDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Login from './pages/Login'
import './App.css'

function DashboardByRole() {
  const role = localStorage.getItem('userRole')
  if (role === 'student') return <StudentDashboard />
  if (role === 'professor') return <ProfessorDashboard />
  return <AdminDashboard />
}


function App(){
    return(
      <>
        <Routes>
            <Route element={<Login />} path="/" />
            <Route element={<Login />} path="/login" />
            <Route element = {<DashboardByRole/>} path = 'dashboard'></Route>
        </Routes>
      </>
    )
}

export default App