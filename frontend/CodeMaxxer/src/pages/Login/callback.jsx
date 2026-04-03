"use client";

import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom'
import supabase from "@utils/supabase"

export default function LoginCallback() {
  const [status, setStatus] = useState("Completing sign-in…");
  const [error, setError] = useState(null);
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error

        if (data?.session) {
          setStatus("Signed in! Redirecting…")
          navigate('/dashboard')
        } else {
          // no session yet, exchange the code
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(window.location.href)

          if (exchangeError) throw exchangeError
          if (exchangeData?.session) {
            setStatus("Signed in! Redirecting…")
            navigate('/dashboard')
          }
        }
      } catch (err) {
        setError(err.message ?? "Authentication failed.")
      }
    }
    handleCallback()
  }, [navigate])

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "'Georgia', serif",
        gap: "1rem",
        color: "#111",
      }}
    >
      {error ? (
        <>
          <p style={{ color: "#c0392b", fontWeight: 600 }}>
            ✕ {error}
          </p>
          <a
            href="/login"
            style={{ fontSize: "0.875rem", color: "#555", textDecoration: "underline" }}
          >
            Back to login
          </a>
        </>
      ) : (
        <>
          <Spinner />
          <p style={{ fontSize: "0.95rem", color: "#444" }}>{status}</p>
        </>
      )}
    </main>
  );
}

function Spinner() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="#ccc"
        strokeWidth="3"
      />
      <path
        d="M16 4 A12 12 0 0 1 28 16"
        fill="none"
        stroke="#111"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}