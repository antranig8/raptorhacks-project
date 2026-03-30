import { Link } from 'react-router-dom'
import styles from './Logo.module.css'

export default function Logo({ className = '' }) {
    return (
        <Link to="/" className={`${styles.logo} ${className}`.trim()}>
            CodeMaxxer
        </Link>
    )
}
