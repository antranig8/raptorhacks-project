import styles from '@dashboard/styles/Coding.module.css'
import { useEffect, useState, useRef } from 'react'
import supabase from '@utils/supabase'

export default function Test() {
    const [resp, setResp] = useState(null)
    const ran = useRef(false)


    const createQuiz = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const res = await fetch("http://localhost:8000/api/v1/private/quiz/create", {
                method: 'POST',
                body: JSON.stringify({
                    prompt: "Create a 8 question Java quiz"
                }),
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            })
            const data = await res.json()
            setResp(data)
        } catch (err) {
            console.error("Fetch error:", err)
        }
    }

    const fetchData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const res = await fetch("http://localhost:8000/api/v1/private/test_code?language=python&code=print('test')", {
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

    useEffect(() => {
        if (ran.current) return
        ran.current = true

        fetchData()
    }, [])

    return (
        <section className={styles.container}>
            <h1>Test</h1>
            <button onClick={()=>createQuiz()}>Create quiz</button>
            <pre>{JSON.stringify(resp, null, 2)}</pre>
        </section>
    )
}