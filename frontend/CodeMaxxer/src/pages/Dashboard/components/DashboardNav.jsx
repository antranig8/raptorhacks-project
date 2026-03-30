import { Link } from 'react-router-dom'
import { FaHome, FaSeedling, FaGraduationCap, FaCog, FaQuestionCircle, FaKeyboard } from 'react-icons/fa'
import Logo from '@/components/Logo/Logo'
import styles from './DashboardNav.module.css'

const navSections = [
    {
        title: 'General',
        items: [
            { section: 'General', label: 'Dashboard', route: '/dashboard', icon: <FaHome /> },
            { section: 'General', label: 'Skill Tree', route: '/dashboard/skill-tree', icon: <FaSeedling /> },
            { section: 'General', label: 'Study', route: '/dashboard/study', icon: <FaGraduationCap /> },
            { section: 'General', label: 'Typing', route: '/dashboard/typing', icon: <FaKeyboard /> },
        ],
    },
    {
        title: 'Support',
        items: [
            { section: 'Support', label: 'Settings', route: '/dashboard/settings', icon: <FaCog /> },
            { section: 'Support', label: 'Help', route: '/dashboard/help', icon: <FaQuestionCircle /> },
        ],
    },
]

export default function DashboardNav() {
    return (
        <aside className={styles.sidebar}>
            <Logo fontSize={'1.2rem'} />
            <nav className={styles.nav}>
                {navSections.map((section, sectionIndex) => (
                    <div key={section.title} className={styles.sectionGroup}>
                        <div className={styles.sectionTitle}>{section.title}</div>
                        {section.items.map((item) => (
                            <Link key={item.label} to={item.route} className={styles.navItem}>
                                <span className={styles.icon}>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                        {sectionIndex < navSections.length - 1 && <div className={styles.separator} />}
                    </div>
                ))}
            </nav>
        </aside>
    )
}