import React, { useCallback, useEffect, useMemo, useState } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant2.module.css'
import supabase from '@/utils/supabase'

const RANGE_TO_DAYS = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    YTD: null,
    '1Y': 365,
    ALL: null,
}

const SKILL_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444']

function startOfDay(value) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
}

function toDayKey(value) {
    return startOfDay(value).toISOString().slice(0, 10)
}

function buildRangeStart(range, latestDate) {
    if (!latestDate) {
        return null
    }

    if (range === 'YTD') {
        return new Date(latestDate.getFullYear(), 0, 1)
    }

    const days = RANGE_TO_DAYS[range]
    if (!days) {
        return null
    }

    const start = new Date(latestDate)
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    return start
}

function aggregateXpHistory(entries, range) {
    if (!entries.length) {
        return { overall: [], skillSeries: [], skillLines: [] }
    }

    const sortedEntries = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const latestDate = startOfDay(sortedEntries[sortedEntries.length - 1].createdAt)
    const rangeStart = buildRangeStart(range, latestDate)

    const filteredEntries = rangeStart
        ? sortedEntries.filter((entry) => startOfDay(entry.createdAt) >= rangeStart)
        : sortedEntries

    const overallByDay = new Map()
    const skillByDay = new Map()

    for (const entry of filteredEntries) {
        const dayKey = toDayKey(entry.createdAt)
        overallByDay.set(dayKey, (overallByDay.get(dayKey) || 0) + entry.expGained)

        const skillName = entry.skillName || 'Unknown Skill'
        const skillTotals = skillByDay.get(skillName) || new Map()
        skillTotals.set(dayKey, (skillTotals.get(dayKey) || 0) + entry.expGained)
        skillByDay.set(skillName, skillTotals)
    }

    const dayKeys = Array.from(new Set(filteredEntries.map((entry) => toDayKey(entry.createdAt)))).sort()

    let overallRunningTotal = 0
    const overall = dayKeys.map((dayKey, index) => {
        overallRunningTotal += overallByDay.get(dayKey) || 0
        return { x: index, y: overallRunningTotal }
    })

    const rankedSkills = Array.from(skillByDay.entries())
        .map(([skillName, totals]) => ({
            skillName,
            totalXp: Array.from(totals.values()).reduce((sum, value) => sum + value, 0),
            totals,
        }))
        .sort((a, b) => b.totalXp - a.totalXp)
        .slice(0, SKILL_COLORS.length)

    const skillSeries = rankedSkills.map(({ totals }) => {
        let runningTotal = 0
        return dayKeys.map((dayKey, index) => {
            runningTotal += totals.get(dayKey) || 0
            return { x: index, y: runningTotal }
        })
    })

    const skillLines = rankedSkills.map((skill, index) => ({
        name: skill.skillName,
        color: SKILL_COLORS[index],
    }))

    return { overall, skillSeries, skillLines }
}

export default function Quadrant2() {
    const [xpEntries, setXpEntries] = useState([])
    const [loadError, setLoadError] = useState('')
    const [overallRange, setOverallRange] = useState('1M')
    const [skillRange, setSkillRange] = useState('1M')

    useEffect(() => {
        let isCancelled = false

        const loadXpEntries = async () => {
            setLoadError('')

            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser()
                if (userError) {
                    throw userError
                }
                if (!user) {
                    if (!isCancelled) {
                        setXpEntries([])
                    }
                    return
                }

                // quiz_done is the event log for earned XP. We fetch the current
                // user's events, then hydrate quiz + skill tree labels locally.
                const { data: xpRows, error: xpError } = await supabase
                    .from('quiz_done')
                    .select('quiz_id, exp_gained, created_at')
                    .eq('user', user.id)
                    .order('created_at', { ascending: true })

                if (xpError) {
                    throw xpError
                }

                const quizIds = Array.from(new Set((xpRows || []).map((row) => row.quiz_id).filter(Boolean)))
                if (quizIds.length === 0) {
                    if (!isCancelled) {
                        setXpEntries([])
                    }
                    return
                }

                const { data: quizzes, error: quizzesError } = await supabase
                    .from('quizzes')
                    .select('id, skill_tree_id, node_id, title')
                    .in('id', quizIds)

                if (quizzesError) {
                    throw quizzesError
                }

                const skillTreeIds = Array.from(new Set((quizzes || []).map((quiz) => quiz.skill_tree_id).filter(Boolean)))
                const { data: skillTrees, error: skillTreesError } = skillTreeIds.length === 0
                    ? { data: [], error: null }
                    : await supabase
                        .from('skill_trees')
                        .select('id, title, goal')
                        .in('id', skillTreeIds)

                if (skillTreesError) {
                    throw skillTreesError
                }

                const quizzesById = new Map((quizzes || []).map((quiz) => [quiz.id, quiz]))
                const skillTreesById = new Map((skillTrees || []).map((tree) => [tree.id, tree]))

                const entries = (xpRows || []).map((row) => {
                    const quiz = quizzesById.get(row.quiz_id)
                    const tree = quiz ? skillTreesById.get(quiz.skill_tree_id) : null
                    return {
                        createdAt: row.created_at,
                        expGained: Number(row.exp_gained) || 0,
                        nodeId: quiz?.node_id || null,
                        skillName: tree?.title || tree?.goal || quiz?.title || 'Unknown Skill',
                    }
                })

                if (!isCancelled) {
                    setXpEntries(entries)
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Failed to load XP analytics.', error)
                    setLoadError('Unable to load XP analytics.')
                    setXpEntries([])
                }
            }
        }

        loadXpEntries()

        return () => {
            isCancelled = true
        }
    }, [])

    const overallData = useMemo(() => aggregateXpHistory(xpEntries, overallRange).overall, [xpEntries, overallRange])
    const skillChartData = useMemo(() => aggregateXpHistory(xpEntries, skillRange).skillSeries, [xpEntries, skillRange])
    const skillLines = useMemo(() => aggregateXpHistory(xpEntries, skillRange).skillLines, [xpEntries, skillRange])

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title={loadError || 'Overall Exp'}
                        data={overallData}
                        onRangeChange={setOverallRange}
                        lines={[{ name: 'Global XP', color: '#22c55e' }]}
                    />
                </div>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Exp by Skill"
                        data={skillChartData}
                        onRangeChange={setSkillRange}
                        lines={skillLines.length > 0 ? skillLines : [{ name: 'No XP Yet', color: '#94a3b8' }]}
                    />
                </div>
            </div>
        </div>
    )
}
