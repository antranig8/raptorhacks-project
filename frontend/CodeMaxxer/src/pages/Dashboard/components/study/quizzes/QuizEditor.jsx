import { useState } from 'react';
import styles from '@dashboard/styles/QuizEditor.module.css';

const LANGUAGES = [
    { id: 'python', label: 'Python' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'cpp', label: 'C++' },
    { id: 'java', label: 'Java' },
    { id: 'asm', label: 'x86 Assembly' }
];

const QUESTION_AMOUNTS = [5, 10, 15, 20];

const CONFIG_OPTIONS = [
    { id: 'hints', label: 'Allow Hints' },
    { id: 'explanations', label: 'Show Explanations' },
    { id: 'timing', label: 'Timed Quiz' },
    { id: 'hard', label: 'Hard Mode' }
];

export default function QuizEditor({ onGenerate }) {
    const [language, setLanguage] = useState(LANGUAGES[0].id);
    const [amount, setAmount] = useState(10);
    const [configs, setConfigs] = useState(['explanations']);
    const [prompt, setPrompt] = useState('');

    const toggleConfig = (id) => {
        setConfigs(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleGenerate = () => {
        if (onGenerate) {
            onGenerate({ language, amount, configs, prompt });
        }
    };

    return (
        <div className={styles.editorContainer}>
            <h2 className={styles.title}>Create Quiz</h2>

            <div className={styles.section}>
                <label className={styles.label}>Programming Language</label>
                <select
                    className={styles.select}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    {LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>{lang.label}</option>
                    ))}
                </select>
            </div>

            <div className={styles.section}>
                <label className={styles.label}>Number of Questions</label>
                <div className={styles.amountGrid}>
                    {QUESTION_AMOUNTS.map(num => (
                        <div
                            key={num}
                            className={`${styles.amountOption} ${amount === num ? styles.active : ''}`}
                            onClick={() => setAmount(num)}
                        >
                            {num}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <label className={styles.label}>Configurations</label>
                <div className={styles.configGrid}>
                    {CONFIG_OPTIONS.map(opt => (
                        <div
                            key={opt.id}
                            className={`${styles.configOption} ${configs.includes(opt.id) ? styles.active : ''}`}
                            onClick={() => toggleConfig(opt.id)}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            </div>

            <hr className={styles.spacer} />

            <div className={`${styles.section} ${styles.textareaSection}`}>
                <label className={styles.label}>Topic / Prompt</label>
                <textarea
                    className={styles.textarea}
                    placeholder="e.g. Memory Management or React Hooks..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </div>

            <button
                className={styles.generateBtn}
                onClick={handleGenerate}
            >
                I'm Ready!
            </button>
        </div>
    );
}
