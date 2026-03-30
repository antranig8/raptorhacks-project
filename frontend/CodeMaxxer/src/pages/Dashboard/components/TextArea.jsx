import { useEffect, useRef, useState } from 'react'
import { FaMousePointer } from 'react-icons/fa'
import styles from './TextArea.module.css'

export default function TextArea({ target = 'hello world', onChange, onActiveChange }) {
  const [active, setActive] = useState(false)
  const [typed, setTyped] = useState('')
  const containerRef = useRef(null)

  const remaining = target.slice(typed.length)

  const handleFocus = () => {
    setActive(true)
    if (onActiveChange) onActiveChange(true)
  }

  const handleBlur = () => {
    setActive(false)
    if (onActiveChange) onActiveChange(false)
  }

  const onKeyDown = (event) => {
    if (!active) return

    if (event.key === 'Backspace') {
      event.preventDefault()
      setTyped((prev) => {
        const next = prev.slice(0, -1)
        if (onChange) onChange(next)
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      setTyped((prev) => {
        const next = prev + '\n'
        if (onChange) onChange(next)
        return next
      })
      return
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      setTyped((prev) => {
        const next = prev + event.key
        if (onChange) onChange(next)
        return next
      })
    }
  }

  useEffect(() => {
    if (active && containerRef.current) {
      containerRef.current.focus()
    }
  }, [active])

  const targetChars = target.split('')
  const typedChars = typed.split('')

  return (
    <div
      className={`${styles.wrapper} ${active ? styles.active : ''}`}
      ref={containerRef}
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      role="textbox"
      aria-label="Typing practice input"
    >
      <div className={styles.content}>
        <span className={styles.typed}>
          {typedChars.map((chr, idx) => {
            const expected = targetChars[idx] ?? ''
            const className = chr === expected ? styles.charCorrect : styles.charIncorrect
            return (
              <span key={`${idx}-${chr}`} className={className}>
                {chr}
              </span>
            )
          })}

          {active && <span className={styles.caret} />}
        </span>

        <span className={styles.remaining}>{remaining}</span>
      </div>

      {!active && (
        <div className={styles.placeholder}>
          <FaMousePointer className={styles.icon} />
          <span>Click to select</span>
        </div>
      )}
    </div>
  )
}

