import { Outlet } from 'react-router-dom'
import DashboardNav from '@d_general/dashboard/DashboardNav'
import styles from '@dashboardStyles/layout/dashboard.module.css'

export default function Dashboard() {
    return (
        <div className={styles.page}>
            <DashboardNav />
            <main className={styles.content}>
                <Outlet />
            </main>
        </div>
    )
}
