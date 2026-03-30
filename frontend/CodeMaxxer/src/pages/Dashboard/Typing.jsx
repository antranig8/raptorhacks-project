import { useState, useRef } from 'react'
import styles from './styles/Typing.module.css'

export default function Typing() {
    const keyboard = useRef(null)
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)

    const onChangeInput = (event) => {
        const value = event.target.value
        setInput(value)
    }
    return (
        <section className={styles.container}>
            <div className={styles.top}>
                <div className={`${styles.topMain} ${isTopActive ? styles.active : ''}`}>
                    <h1>Practice Typing</h1>
                    <textarea
                        className={styles.inputArea}
                        value={input}
                        onFocus={() => setIsTopActive(true)}
                        onBlur={() => setIsTopActive(false)}
                        onChange={onChangeInput}
                        placeholder="Start typing..."
                    />
                </div>
                <div className={styles.topSide}>
                    <p>Right panel (30%) for controls.</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <p>Analytics</p>
            </div>
        </section>
    )
}
