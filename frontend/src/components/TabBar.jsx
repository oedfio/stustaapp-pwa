import { NavLink } from 'react-router-dom'
import { MapPin, Calendar, Settings, User } from 'lucide-react'
import { useAuth } from './AuthContext'

// One bold color per tab (yellow/red/green/blue), echoing the app icon's
// stripes. Active uses the full bold color; inactive is a lighter tint
// of the same hue, kept saturated enough to still read clearly.
const TAB_COLORS = {
  places: { active: '#f9a825', inactive: '#fbc266' },
  events: { active: '#d32f2f', inactive: '#e06d6d' },
  manage: { active: '#388e3c', inactive: '#74b077' },
  profile: { active: '#1976d2', inactive: '#5e9fe0' },
}

export default function TabBar() {
  const { user, isAdmin } = useAuth()

  return (
    <nav style={styles.nav}>
      <NavLink to="/places" style={navStyle('places')}>
        {({ isActive }) => (
          <>
            <MapPin size={20} color={isActive ? TAB_COLORS.places.active : TAB_COLORS.places.inactive} />
            <span style={styles.label}>Places</span>
          </>
        )}
      </NavLink>

      <NavLink to="/" style={navStyle('events')} end>
        {({ isActive }) => (
          <>
            <Calendar size={20} color={isActive ? TAB_COLORS.events.active : TAB_COLORS.events.inactive} />
            <span style={styles.label}>Events</span>
          </>
        )}
      </NavLink>

      {user && isAdmin && (
        <NavLink to="/manage" style={navStyle('manage')}>
          {({ isActive }) => (
            <>
              <Settings size={20} color={isActive ? TAB_COLORS.manage.active : TAB_COLORS.manage.inactive} />
              <span style={styles.label}>Manage</span>
            </>
          )}
        </NavLink>
      )}

      <NavLink to="/profile" style={navStyle('profile')}>
        {({ isActive }) => (
          <>
            <User size={20} color={isActive ? TAB_COLORS.profile.active : TAB_COLORS.profile.inactive} />
            <span style={styles.label}>Profile</span>
          </>
        )}
      </NavLink>
    </nav>
  )
}

const navStyle = (tab) => ({ isActive }) => ({
  ...styles.link,
  color: isActive ? TAB_COLORS[tab].active : TAB_COLORS[tab].inactive,
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