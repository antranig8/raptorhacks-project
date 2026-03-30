import styles from './styles/TheStack.module.css'
import reactLogo from '../../../assets/react.svg'
import flaskLogo from '../../../assets/flask.svg'
import pistonLogo from '../../../assets/piston.svg'
import vercelLogo from '../../../assets/vercel.svg'
import supabaseLogo from '../../../assets/supabase.svg'
import groqLogo from '../../../assets/groq.svg'

const stackItems = [
    { title: 'React', subtitle: '', imgPath: reactLogo },
    { title: 'Flask', subtitle: '', imgPath: flaskLogo },
    { title: 'Piston', subtitle: '', imgPath: pistonLogo },
    { title: 'Vercel', subtitle: '', imgPath: vercelLogo },
    { title: 'Supabase', subtitle: '', imgPath: supabaseLogo },
    { title: 'Groq', subtitle: '', imgPath: groqLogo },
]

function TheStack() {
    return (
        <section className={styles.stackSection} aria-label="Our stack">
            <h2 className={styles.stackTitle}>Our Stack</h2>
            <div className={styles.stackGrid}>
                {stackItems.map((item) => (
                    <article key={item.title} className={styles.stackCard}>
                        <div className={styles.iconWrapper}>
                            {item.imgPath ? (
                                <img src={item.imgPath} alt="stack item logo" className={styles.stackImage} />
                            ) : (
                                <span className={styles.stackIconPlaceholder}>{item.title.charAt(0)}</span>
                            )}
                        </div>
                        <h3 className={styles.stackName}>{item.title}</h3>
                        {item.subtitle && <p className={styles.stackSubtitle}>{item.subtitle}</p>}
                    </article>
                ))}
            </div>
        </section>
    )
}

export default TheStack
