import OrgInfoEditor from './OrgInfoEditor'
import AdminManager from './AdminManager'
import EventsManager from './EventsManager'
import { styles } from './styles'

export default function OrgSection({ membership }) {
    const isBossAdmin = membership.role === 'boss_admin'

    return (
        <div style={styles.section}>
            <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>{membership.org_name}</span>
                <span style={styles.roleBadge}>
                    {isBossAdmin ? 'Boss Admin' : 'Org Admin'}
                </span>
            </div>

            {isBossAdmin && <OrgInfoEditor membership={membership} />}
            {isBossAdmin && <AdminManager membership={membership} />}
            <EventsManager membership={membership} />
        </div>
    )
}