import { useMemo, useState } from 'react'
import styles from '@dashboardStyles/study/QuizEditor.module.css'

const LANGUAGES = [
    'haskell',
    'sqlite3',
    'forth',
    'nasm64',
    'bash',
    'fsharp.net',
    'swift',
    'ponylang',
    'crystal',
    'elixir',
    'yeethon',
    'vlang',
    'c++',
    'nasm',
    'pascal',
    'raku',
    'japt',
    'powershell',
    'jelly',
    'vyxal',
    'llvm_ir',
    'iverilog',
    'emacs',
    'lolcode',
    'python',
    'fortran',
    'typescript',
    'rockstar',
    'befunge93',
    'csharp',
    'ruby',
    'php',
    'coffeescript',
    'd',
    'lisp',
    'groovy',
    'cow',
    'julia',
    'freebasic',
    'javascript',
    'racket',
    'dart',
    'nim',
    'samarium',
    'octave',
    'fsi',
    'lua',
    'basic',
    'retina',
    'perl',
    'golfscript',
    'csharp.net',
    'emojicode',
    'kotlin',
    'husk',
    'scala',
    'paradoc',
    'zig',
    'dash',
    'awk',
    'ocaml',
    'cjam',
    'java',
    'cobol',
    'prolog',
    'rscript',
    'file',
    'forte',
    'python2',
    'erlang',
    'basic.net',
    'pure',
    'clojure',
    'smalltalk',
    'go',
    'dragon',
    'brachylog',
    'osabie',
    'bqn',
    'rust',
    'matl',
    'pyth',
    'c',
    'brainfuck',
]

const CONFIG_OPTIONS = [
    { id: 'hints', label: 'Allow Hints' },
    { id: 'explanations', label: 'Show Explanations' },
    { id: 'timing', label: 'Timed Quiz' },
    { id: 'hard', label: 'Hard Mode' }
]

export default function QuizEditor({ onGenerate, isGenerating = false, error = "" }) {
    const [language, setLanguage] = useState('python')
    const [amount] = useState(10)
    const [configs, setConfigs] = useState([])
    const [prompt, setPrompt] = useState('')
    const [localError, setLocalError] = useState('')
    const [isLanguageOpen, setIsLanguageOpen] = useState(false)

    const filteredLanguages = useMemo(() => {
        const query = language.trim().toLowerCase()
        return query
            ? LANGUAGES.filter((lang) => lang.includes(query))
            : LANGUAGES
    }, [language])

    const toggleConfig = (id) => {
        setConfigs(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        )
    }

    const handleGenerate = () => {
        const normalizedLanguage = language.trim().toLowerCase()
        if (!normalizedLanguage || !prompt.trim()) {
            setLocalError('Enter both a language and a topic before generating a quiz.')
            return
        }
        setLocalError('')
        if (onGenerate) {
            onGenerate({ language: normalizedLanguage, amount, configs, prompt })
        }
    }

    const handleSelectLanguage = (nextLanguage) => {
        setLanguage(nextLanguage)
        setIsLanguageOpen(false)
    }

    return (
        <div className={styles.editorContainer}>
            <h2 className={styles.title}>Create Quiz</h2>

            <div className={styles.section}>
                <label className={styles.label}>Programming Language</label>
                <div
                    className={styles.dropdownShell}
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                            setIsLanguageOpen(false);
                        }
                    }}
                >
                    <input
                        className={styles.searchInput}
                        type="text"
                        value={language}
                        onChange={(e) => {
                            setLanguage(e.target.value);
                            setIsLanguageOpen(true);
                        }}
                        onFocus={() => setIsLanguageOpen(true)}
                        placeholder="Search or enter a language, e.g. python or rust"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {isLanguageOpen && (
                        <div className={styles.dropdownMenu}>
                            {filteredLanguages.length > 0 ? (
                                filteredLanguages.map((lang) => (
                                    <button
                                        key={lang}
                                        className={styles.dropdownOption}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelectLanguage(lang)}
                                    >
                                        {lang}
                                    </button>
                                ))
                            ) : (
                                <p className={styles.dropdownEmpty}>No matching languages</p>
                            )}
                        </div>
                    )}
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
                disabled={isGenerating}
            >
                {isGenerating ? 'Generating...' : "I'm Ready!"}
            </button>
            {(localError || error) && <p className={styles.errorText}>{localError || error}</p>}
        </div>
    )
}
