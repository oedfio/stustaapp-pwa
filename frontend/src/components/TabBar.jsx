import { NavLink } from 'react-router-dom'
import { MapPin, Calendar, Settings, User } from 'lucide-react'
import { useAuth } from './AuthContext'

export default function TabBar() {
  const { user, isAdmin } = useAuth()

  return (
    <nav style={styles.nav}>
      <NavLink to="/places" style={navStyle}>
        {({ isActive }) => (
          <>
            <MapPin size={20} color={isActive ? '#0064BC' : '#555555'} />
            <span style={styles.label}>Places</span>
          </>
        )}
      </NavLink>

      <NavLink to="/" style={navStyle} end>
        {({ isActive }) => (
          <>
            <Calendar size={20} color={isActive ? '#0064BC' : '#555555'} />
            <span style={styles.label}>Events</span>
          </>
        )}
      </NavLink>

      {user && isAdmin && (
        <NavLink to="/manage" style={navStyle}>
          {({ isActive }) => (
            <>
              <Settings size={20} color={isActive ? '#0064BC' : '#555555'} />
              <span style={styles.label}>Manage</span>
            </>
          )}
        </NavLink>
      )}

      <NavLink to="/profile" style={navStyle}>
        {({ isActive }) => (
          <>
            <User size={20} color={isActive ? '#0064BC' : '#555555'} />
            <span style={styles.label}>Profile</span>
          </>
        )}
      </NavLink>
    </nav>
  )
}

const navStyle = ({ isActive }) => ({
  ...styles.link,
  color: isActive ? '#0064BC' : '#555555',
})

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #E3E3E4',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 100,
  },
  link: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textDecoration: 'none',
    fontSize: '12px',
    gap: '2px',
  },
  label: {
    fontSize: '11px',
  },
}