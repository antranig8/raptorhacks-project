import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import supabase from '@utils/supabase'

const ProtectedRoute = () => {
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState(null)

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)
            setLoading(false)
        }

        checkSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    if (loading) {
        return <div>Loading...</div> // Or a proper loading spinner
    }

    if (!session) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}

export default ProtectedRoute
