import { NavLink } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function TabBar() {
  const { user, isAdmin } = useAuth()

  return (
    <nav style={styles.nav}>
      <NavLink to="/places" style={navStyle}>
        <span style={styles.icon}>📍</span>
        <span style={styles.label}>Places</span>
      </NavLink>

      <NavLink to="/" style={navStyle} end>
        <span style={styles.icon}>📅</span>
        <span style={styles.label}>Events</span>
      </NavLink>

      {user && isAdmin && (
        <NavLink to="/manage" style={navStyle}>
          <span style={styles.icon}>⚙️</span>
          <span style={styles.label}>Manage</span>
        </NavLink>
      )}

      <NavLink to="/profile" style={navStyle}>
        <span style={styles.icon}>👤</span>
        <span style={styles.label}>Profile</span>
      </NavLink>
    </nav>
  )
}

const navStyle = ({ isActive }) => ({
  ...styles.link,
  color: isActive ? '#2563EB' : '#6B7280',
})

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #E5E7EB',
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
  icon: {
    fontSize: '20px',
  },
  label: {
    fontSize: '11px',
  },
}