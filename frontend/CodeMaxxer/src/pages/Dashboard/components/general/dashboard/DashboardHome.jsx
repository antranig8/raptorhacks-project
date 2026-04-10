import styles from '@dashboard/styles/DashboardHome.module.css'
import Quadrant1 from './Quadrant1'
import Quadrant2 from './Quadrant2'
import Quadrant3 from './Quadrant3'
import Quadrant4 from './Quadrant4'
import { useEffect, useState, useRef } from 'react'
import supabase from '@utils/supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function DashboardHome() {

    const [userData, setUserData] = useState(null)

    useEffect(() => {

        const loadData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                const res = await fetch(`${API_BASE_URL}/api/v1/private/user_stats/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                })
                const data = await res.json()
                console.log(data)
                setUserData(data)
            } catch (err) {
                console.error("Fetch error:", err)
            }
        }

        void loadData()

    }, [])

    return (
        <section className={styles.container}>
            <div className={styles.grid}>
                <Quadrant1 userData={userData}/>
                <Quadrant2 userData={userData}/>
                <Quadrant3 userData={userData}/>
                <Quadrant4 userData={userData}/>
            </div>
        </section>
    )
}
