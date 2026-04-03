import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaDiscord, FaEye, FaEyeSlash, FaGoogle } from 'react-icons/fa'
import supabase from '@utils/supabase'
import styles from '@login/styles/login.module.css'

export default function Form() {
    const [showPassword, setShowPassword] = useState(false)
    const navigate = useNavigate()

    async function loginThrough(provider) {
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: 'http://localhost:5173/login/callback',
            }
        })
    }

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

                <div className={styles.divider}>
                    <hr />
                    <span>Or Login With</span>
                    <hr />
                </div>

                <div className={styles.socialRow}>
                    <button type="button" className={styles.socialButton} onClick={() => loginThrough("google")}>
                        <FaGoogle /> Google
                    </button>
                    <button type="button" className={styles.socialButton} onClick={() => loginThrough("discord")}>
                        <FaDiscord /> Discord
                    </button>
                </div>
            </form>
        </div>
    )
}
