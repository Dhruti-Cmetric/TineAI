import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SupplierDashboard from './pages/SupplierDashboard'
import Datasets from './pages/Datasets'
import DatasetDetail from './pages/DatasetDetail'
import Upload from './pages/Upload'
import DataCardCreate from './pages/DataCardCreate'
import Users from './pages/Users'
import ClientPortal from './pages/ClientPortal'
import AuditLog from './pages/AuditLog'
import ApiAccess from './pages/ApiAccess'
import Assignments from './pages/Assignments'
import Approvals from './pages/Approvals'
import ProcessingView from './pages/ProcessingView'
import HumanReview from './pages/HumanReview'
import Versioning from './pages/Versioning'
import Projects from './pages/Projects'
import AccessControlDemo from './pages/AccessControlDemo'

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

// Redirect to role-appropriate dashboard
function SmartDashboard() {
  const role = localStorage.getItem('role')
  if (role === 'supplier') return <SupplierDashboard />
  return <Dashboard />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<SmartDashboard />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="datasets/:id" element={<DatasetDetail />} />
          <Route path="datasets/:id/processing" element={<ProcessingView />} />
          <Route path="datasets/:id/review" element={<HumanReview />} />
          <Route path="datasets/:id/versions" element={<Versioning />} />
          <Route path="upload" element={<Upload />} />
          <Route path="datacard/create" element={<DataCardCreate />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="users" element={<Users />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="projects" element={<Projects />} />
          <Route path="client-portal" element={<ClientPortal />} />
          <Route path="api-access" element={<ApiAccess />} />
          <Route path="access-control" element={<AccessControlDemo />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
