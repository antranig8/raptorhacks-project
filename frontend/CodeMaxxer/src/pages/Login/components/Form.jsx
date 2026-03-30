import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaEye, FaEyeSlash, FaGoogle } from 'react-icons/fa'
import styles from '../styles/login.module.css'

export default function Form() {
    const [showPassword, setShowPassword] = useState(false)
    const navigate = useNavigate()

    return (
        <div className={styles.formContainer}>
            <form className={styles.form}>
                <div className={styles.inputGroup}>
                    <label htmlFor="email">Email</label>
                    <input type="email" id="email" placeholder="Enter your email" required />
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="password">Password</label>
                    <div className={styles.passwordWrapper}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            className={styles.passwordToggle}
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                <div className={styles.optionsRow}>
                    <label className={styles.rememberMe}>
                        <input type="checkbox" />
                        <span>Remember<br />me</span>
                    </label>
                    <a href="#" className={styles.forgotPassword}>Forgot Your<br />Password?</a>
                </div>

                <button type="submit" className={styles.loginButton}>Log In</button>
                <button type="button" className={styles.bypassButton} onClick={() => navigate('/dashboard')}>Bypass</button>

                <div className={styles.divider}>
                    <hr />
                    <span>Or Login With</span>
                    <hr />
                </div>

                <button type="button" className={styles.googleButton}>
                    <FaGoogle /> Google
                </button>
            </form>
        </div>
    )
}
