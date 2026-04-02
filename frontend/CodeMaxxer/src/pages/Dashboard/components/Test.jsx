import styles from '@dashboard/styles/Study.module.css'
import { useEffect, useState } from 'react'
import supabase from '@/utils/supabase.js'

export default function Test() {
    const [resp, setResp] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                const res = await fetch("http://localhost:8000/api/v1/private/test", {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                })
                const data = await res.json()
                setResp(data)
            } catch (err) {
                console.error("Fetch error:", err)
            }
        }
        fetchData()
    }, [])

    return (
        <section className={styles.container}>
            <h1>Test</h1>
            <pre>{JSON.stringify(resp, null, 2)}</pre>
        </section>
    )
}