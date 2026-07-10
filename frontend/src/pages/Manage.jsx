import { useAuth } from '../components/AuthContext'
import DevAdminSection from '../components/manage/DevAdminSection'
import OrgSection from '../components/manage/OrgSection'
import { styles } from '../components/manage/styles'

export default function Manage() {
  const { isDevAdmin, memberships } = useAuth()

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Manage</h1>

      {isDevAdmin && <DevAdminSection />}

      {memberships.map((membership) => (
        <OrgSection
          key={membership.org_id}
          membership={membership}
        />
      ))}

      {memberships.length === 0 && !isDevAdmin && (
        <p style={styles.empty}>You have no admin roles yet.</p>
      )}
    </div>
  )
}