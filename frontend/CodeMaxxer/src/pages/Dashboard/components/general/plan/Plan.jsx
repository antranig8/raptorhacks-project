import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSkillTree, deleteSkillTree, listSkillTrees, setActiveSkillTree } from '@d_general/skilltree/skillTreeData'
import styles from '@dashboard/styles/Plan.module.css'

const EXPERIENCE_OPTIONS = [
    { value: 'beginner', label: 'Beginner', detail: 'Assume little or no prior background.' },
    { value: 'intermediate', label: 'Intermediate', detail: 'Build on some existing familiarity.' },
    { value: 'advanced', label: 'Advanced', detail: 'Focus on depth, rigor, and harder projects.' },
]

const OUTCOME_OPTIONS = [
    { value: 'job-ready', label: 'Get job-ready', detail: 'Prioritize practical, portfolio-oriented skills.' },
    { value: 'project', label: 'Build a project', detail: 'Aim toward shipping something tangible.' },
    { value: 'foundation', label: 'Learn the fundamentals', detail: 'Focus on core understanding first.' },
    { value: 'specific', label: 'Improve a specific area', detail: 'Target one domain that needs work.' },
]

const PACE_OPTIONS = [
    { value: 'light', label: 'Light pace', detail: 'A sustainable plan for casual progress.' },
    { value: 'steady', label: 'Steady pace', detail: 'Balanced progress without overload.' },
    { value: 'intensive', label: 'Intensive pace', detail: 'Condense the path and move quickly.' },
]

function formatOutcome(value) {
    return value === 'job-ready'
        ? 'become job-ready'
        : value === 'project'
            ? 'build a project'
            : value === 'foundation'
                ? 'learn the fundamentals'
                : 'improve a specific area'
}

function formatPace(value) {
    return value === 'light'
        ? 'a light pace'
        : value === 'steady'
            ? 'a steady pace'
            : 'an intensive pace'
}

function buildNormalizedGoal({ topic, background, outcome, pace }) {
    return `Learn ${topic} at a ${background} level to ${formatOutcome(outcome)} with ${formatPace(pace)}.`
}

function renderNormalizedGoalPreview({ topic, background, outcome, pace }) {
    return (
        <>
            {'Learn '}
            <strong>{topic}</strong>
            {` at a ${background} level to ${formatOutcome(outcome)} with ${formatPace(pace)}.`}
        </>
    )
}

function buildGuidedPrompt({ topic, background, outcome, pace }) {
    const parts = [
        `I want to learn ${topic}.`,
        `My current experience level is ${background}.`,
        `My main goal is to ${formatOutcome(outcome)}.`,
        `Please shape the roadmap for ${formatPace(pace)}.`,
    ]

    return parts.join(' ')
}

export default function Plan() {
    const navigate = useNavigate()
    const [treeName, setTreeName] = useState('')
    const [topic, setTopic] = useState('')
    const [background, setBackground] = useState('beginner')
    const [outcome, setOutcome] = useState('foundation')
    const [pace, setPace] = useState('steady')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [savedPlans, setSavedPlans] = useState([])
    const [plansVisible, setPlansVisible] = useState(false)
    const [plansLoading, setPlansLoading] = useState(false)
    const [planActionId, setPlanActionId] = useState(null)

    const promptPreview = useMemo(() => {
        if (!topic.trim()) return ''

        return buildGuidedPrompt({
            topic: topic.trim(),
            background,
            outcome,
            pace,
        })
    }, [topic, background, outcome, pace])

    const normalizedGoal = useMemo(() => {
        if (!topic.trim()) return ''

        return buildNormalizedGoal({
            topic: topic.trim(),
            background,
            outcome,
            pace,
        })
    }, [topic, background, outcome, pace])

    const normalizedGoalPreview = useMemo(() => {
        if (!topic.trim()) return null

        return renderNormalizedGoalPreview({
            topic: topic.trim(),
            background,
            outcome,
            pace,
        })
    }, [topic, background, outcome, pace])

    const suggestedName = useMemo(() => {
        if (treeName.trim()) return treeName.trim()
        if (!topic.trim()) return ''
        return `${topic.trim()} Plan`
    }, [treeName, topic])

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!topic.trim()) {
            setError('Add what you want to learn before creating a plan.')
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            await createSkillTree({
                name: suggestedName || 'New Plan',
                goal: normalizedGoal,
            })
            navigate('/dashboard/skill-tree')
        } catch (requestError) {
            setError(requestError.message || 'Failed to create plan.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleTogglePlans = async () => {
        const nextVisible = !plansVisible
        setPlansVisible(nextVisible)

        if (!nextVisible) {
            return
        }

        setPlansLoading(true)
        setError('')

        try {
            const plans = await listSkillTrees()
            setSavedPlans(plans)
        } catch (requestError) {
            setError(requestError.message || 'Failed to load saved plans.')
        } finally {
            setPlansLoading(false)
        }
    }

    const handleLoadPlan = async (planId) => {
        setPlanActionId(planId)
        setError('')

        try {
            await setActiveSkillTree(planId)
            setSavedPlans((prev) => prev.map((plan) => ({
                ...plan,
                is_active: plan.id === planId,
            })))
            navigate('/dashboard/skill-tree')
        } catch (requestError) {
            setError(requestError.message || 'Failed to load selected plan.')
        } finally {
            setPlanActionId(null)
        }
    }

    const handleDeletePlan = async (planId) => {
        setPlanActionId(planId)
        setError('')

        try {
            await deleteSkillTree(planId)
            setSavedPlans((prev) => prev.filter((plan) => plan.id !== planId))
        } catch (requestError) {
            setError(requestError.message || 'Failed to delete selected plan.')
        } finally {
            setPlanActionId(null)
        }
    }

    return (
        <section className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroCopy}>
                    <p className={styles.eyebrow}>Plan</p>
                    <h1 className={styles.title}>Build Your Plan</h1>
                    <p className={styles.subtitle}>
                        Give the app enough content to turn your goal into a clean and useful skilltree.
                    </p>
                </div>
                <div className={styles.heroCard}>
                    <span className={styles.heroLabel}>What happens next</span>
                    <p className={styles.heroBody}>
                        Your answers are combined into one prompt, sent to the existing skill-tree creation
                        flow, and saved as a new roadmap.
                    </p>
                </div>
            </div>

            <div className={styles.layout}>
                <form className={styles.formCard} onSubmit={handleSubmit}>
                    <div className={styles.formSection}>
                        <label className={styles.label} htmlFor="plan-name">Plan Name</label>
                        <input
                            id="plan-name"
                            className={styles.input}
                            type="text"
                            value={treeName}
                            onChange={(event) => setTreeName(event.target.value)}
                            placeholder="Example: Backend Foundations"
                            maxLength={120}
                        />
                        <p className={styles.hint}>Optional. If left blank, the app will derive a name from your topic.</p>
                    </div>

                    <div className={styles.formSection}>
                        <label className={styles.label} htmlFor="topic">What do you want to learn?</label>
                        <textarea
                            id="topic"
                            className={styles.textarea}
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            placeholder="Example: React for frontend apps, Python for automation, or DSA for interviews"
                            maxLength={300}
                        />
                    </div>

                    <div className={styles.optionsGrid}>
                        <div className={styles.optionGroup}>
                            <span className={styles.label}>Current Level</span>
                            <div className={styles.choiceList}>
                                {EXPERIENCE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        className={`${styles.choice} ${background === option.value ? styles.choiceActive : ''}`}
                                        type="button"
                                        onClick={() => setBackground(option.value)}
                                    >
                                        <span className={styles.choiceTitle}>{option.label}</span>
                                        <span className={styles.choiceDetail}>{option.detail}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.optionGroup}>
                            <span className={styles.label}>Primary Goal</span>
                            <div className={styles.choiceList}>
                                {OUTCOME_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        className={`${styles.choice} ${outcome === option.value ? styles.choiceActive : ''}`}
                                        type="button"
                                        onClick={() => setOutcome(option.value)}
                                    >
                                        <span className={styles.choiceTitle}>{option.label}</span>
                                        <span className={styles.choiceDetail}>{option.detail}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.optionGroup}>
                            <span className={styles.label}>Pace</span>
                            <div className={styles.choiceList}>
                                {PACE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        className={`${styles.choice} ${pace === option.value ? styles.choiceActive : ''}`}
                                        type="button"
                                        onClick={() => setPace(option.value)}
                                    >
                                        <span className={styles.choiceTitle}>{option.label}</span>
                                        <span className={styles.choiceDetail}>{option.detail}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <p className={styles.error}>{error}</p>
                    )}

                    <div className={styles.actions}>
                        <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !topic.trim()}>
                            {isSubmitting ? 'Creating Plan...' : 'Create Skill Tree'}
                        </button>
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={() => navigate('/dashboard/skill-tree')}
                        >
                            View Skill Tree
                        </button>
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={handleTogglePlans}
                        >
                            {plansVisible ? 'Hide Plans' : 'View Plans'}
                        </button>
                    </div>

                    {plansVisible && (
                        <section className={styles.plansPanel}>
                            <div className={styles.plansHeader}>
                                <div>
                                    <h3 className={styles.plansTitle}>Saved Plans</h3>
                                    <p className={styles.plansSubtitle}>
                                        Load a plan for current use or delete one you no longer need.
                                    </p>
                                </div>
                            </div>

                            {plansLoading ? (
                                <p className={styles.emptyState}>Loading saved plans...</p>
                            ) : savedPlans.length === 0 ? (
                                <p className={styles.emptyState}>No saved plans yet.</p>
                            ) : (
                                <div className={styles.planList}>
                                    {savedPlans.map((plan) => {
                                        const isBusy = planActionId === plan.id
                                        return (
                                            <article key={plan.id} className={styles.planItem}>
                                                <div className={styles.planMeta}>
                                                    <div className={styles.planTitleRow}>
                                                        <h4 className={styles.planItemTitle}>{plan.name}</h4>
                                                        {plan.is_active && <span className={styles.activeBadge}>Active</span>}
                                                    </div>
                                                    <p className={styles.planGoal}>{plan.goal}</p>
                                                </div>
                                                <div className={styles.planActions}>
                                                    <button
                                                        className={styles.inlineButton}
                                                        type="button"
                                                        onClick={() => handleLoadPlan(plan.id)}
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? 'Working...' : 'Load'}
                                                    </button>
                                                    <button
                                                        className={styles.inlineDanger}
                                                        type="button"
                                                        onClick={() => handleDeletePlan(plan.id)}
                                                        disabled={isBusy}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </article>
                                        )
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </form>

                <aside className={styles.previewCard}>
                    <div className={styles.previewHeader}>
                        <p className={styles.previewEyebrow}>Preview</p>
                        <h2 className={styles.previewTitle}>{suggestedName || 'Your plan name will appear here'}</h2>
                    </div>

                    <div className={styles.previewBlock}>
                        <span className={styles.previewLabel}>Normalized goal that will be sent</span>
                        <p className={styles.previewPrompt}>
                            {normalizedGoalPreview || 'Add a topic and select a few options to see the normalized goal.'}
                        </p>
                    </div>

                    <div className={styles.previewBlock}>
                        <span className={styles.previewLabel}>Prompt that will be sent</span>
                        <p className={styles.previewPrompt}>
                            {promptPreview || 'Add a topic and select a few options to see the generated prompt preview.'}
                        </p>
                    </div>
                </aside>
            </div>
        </section>
    )
}
