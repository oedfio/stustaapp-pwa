import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import TabBar from './components/TabBar'
import EventsList from './pages/EventsList'
import EventDetail from './pages/EventDetail'
import PlacesList from './pages/PlacesList'
import OrganizationDetail from './pages/OrganizationDetail'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Manage from './pages/Manage'
import WhoCreatedThis from './pages/WhoCreatedThis'
import SpecialThanks from './pages/SpecialThanks'
import Footer from './components/Footer'

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppContent() {
  return (
    <div style={styles.appWrapper}>
      <div style={styles.pageContent}>
        <Routes>
          {/* Public routes — accessible without login */}
          <Route path="/" element={<EventsList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/places" element={<PlacesList />} />
          <Route path="/places/:id" element={<OrganizationDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/who-created-this" element={<WhoCreatedThis />} />
          <Route path="/special-thanks" element={<SpecialThanks />} />

          {/* Admin only */}
          <Route path="/manage" element={
            <AdminRoute><Manage /></AdminRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <Footer />
      <TabBar />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

const styles = {
  appWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  pageContent: {
    flex: 1,
  },
}