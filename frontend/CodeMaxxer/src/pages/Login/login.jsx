import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '@utils/supabase'
import Form from './components/Form.jsx'
import styles from '@login/styles/login.module.css'

export default function Login() {
    const navigate = useNavigate()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                navigate('/dashboard')
            }
        }

        checkSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                navigate('/dashboard')
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [navigate])

    return (
        <div className={styles.loginPage}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Welcome,</h1>
                    <p className={styles.subtitle}>Enter your email and password to access our<br />services.</p>
                </div>
                <Form />
            </div>
        </div>
    )
}
