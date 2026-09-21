import { Navigate, Route, Routes } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import ProfessorDashboard from './pages/ProfessorDashboard'
import StudentDashboard from './pages/StudentDashboard'
import Login from './pages/Login'
import { getRole, isSignedIn } from './utils/session'
import './App.css'

function DashboardByRole() {
  // Without a token every request would fail, so go straight to sign-in.
  if (!isSignedIn()) return <Navigate to="/login" replace />
  const role = getRole()
  if (role === 'student') return <StudentDashboard />
  if (role === 'professor') return <ProfessorDashboard />
  return <AdminDashboard />
}

// Someone already signed in who opens the sign-in page is sent to their dashboard.
function LoginRoute() {
  return isSignedIn() ? <Navigate to="/dashboard" replace /> : <Login />
}

function App(){
    return(
      <>
        <Routes>
            <Route element={<LoginRoute />} path="/" />
            <Route element={<LoginRoute />} path="/login" />
            <Route element={<DashboardByRole />} path="/dashboard/:section?" />
            <Route element={<Navigate to="/dashboard" replace />} path="*" />
        </Routes>
      </>
    )
}

export default App
