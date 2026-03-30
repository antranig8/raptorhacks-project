import styles from '@dashboard/styles/DashboardHome.module.css'

export default function DashboardHome() {
    return (
        <section className={styles.container}>
            <h1>Dashboard Home</h1>
            <p>Welcome to your dashboard. Select an item from the sidebar to view content here.</p>
        </section>
    )
}
