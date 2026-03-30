import Form from './components/Form.jsx'
import styles from '@login/styles/login.module.css'

export default function Login() {
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
