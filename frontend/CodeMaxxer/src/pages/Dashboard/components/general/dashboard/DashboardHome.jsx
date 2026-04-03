import styles from '@dashboard/styles/DashboardHome.module.css'
import Quadrant1 from './Quadrant1'
import Quadrant2 from './Quadrant2'
import Quadrant3 from './Quadrant3'
import Quadrant4 from './Quadrant4'

export default function DashboardHome() {
    return (
        <section className={styles.container}>
            <div className={styles.grid}>
                <Quadrant1 />
                <Quadrant2 />
                <Quadrant3 />
                <Quadrant4 />
            </div>
        </section>
    )
}
