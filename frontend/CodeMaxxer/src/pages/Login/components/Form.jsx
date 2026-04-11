import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaDiscord, FaEye, FaEyeSlash, FaGoogle } from 'react-icons/fa'
import supabase from '@utils/supabase'
import styles from '@login/styles/login.module.css'

const BASE_URL = window.location.origin;

export default function Form() {
    const [showPassword, setShowPassword] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [isForgotPassword, setIsForgotPassword] = useState(false)
    const [resetSent, setResetSent] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${BASE_URL}/login/callback`,
                    }
                })
                if (error) throw error
                alert('Check your email for the confirmation link!')
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                navigate('/dashboard')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleResetPassword(e) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${BASE_URL}/login/callback`
            })
            if (error) throw error
            setResetSent(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function loginThrough(provider) {
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${BASE_URL}/login/callback`,
            }
        })
    }

    if (isForgotPassword) {
        return (
            <div className={styles.formContainer}>
                <form className={styles.form} onSubmit={handleResetPassword}>
                    {error && <div className={styles.errorMessage}>{error}</div>}
                    {resetSent ? (
                        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <p style={{ color: '#16a34a', fontWeight: '500', marginBottom: '1rem' }}>
                                Password reset link sent to your email!
                            </p>
                            <button
                                type="button"
                                className={styles.loginButton}
                                style={{ margin: '0 auto', display: 'block' }}
                                onClick={() => {
                                    setIsForgotPassword(false)
                                    setResetSent(false)
                                    setError(null)
                                }}
                            >
                                Back to Log In
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className={styles.inputGroup}>
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.loginButton} disabled={loading} style={{ margin: '1rem auto' }}>
                                {loading ? 'Processing...' : 'Send Reset Link'}
                            </button>

                            <div className={styles.toggleRow}>
                                <button
                                    type="button"
                                    className={styles.toggleButton}
                                    onClick={() => {
                                        setIsForgotPassword(false)
                                        setError(null)
                                    }}
                                >
                                    Back to Log In
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        )
    }

    return (
        <div className={styles.formContainer}>
            <form className={styles.form} onSubmit={handleSubmit}>
                {error && <div className={styles.errorMessage}>{error}</div>}
                <div className={styles.inputGroup}>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="password">Password</label>
                    <div className={styles.passwordWrapper}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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

                {!isSignUp && (
                    <div className={styles.optionsRow}>
                        <label className={styles.rememberMe}>
                            <input type="checkbox" />
                            <span>Remember me</span>
                        </label>
                        <a
                            href="#"
                            className={styles.forgotPassword}
                            onClick={(e) => {
                                e.preventDefault()
                                setIsForgotPassword(true)
                                setError(null)
                            }}
                        >
                            Forgot Your Password?
                        </a>
                    </div>
                )}

                <button type="submit" className={styles.loginButton} disabled={loading}>
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
                </button>

                <div className={styles.toggleRow}>
                    <span>{isSignUp ? 'Already have an account?' : 'Need an account?'}</span>
                    <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setError(null)
                        }}
                    >
                        {isSignUp ? 'Log In' : 'Sign Up'}
                    </button>
                </div>

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
