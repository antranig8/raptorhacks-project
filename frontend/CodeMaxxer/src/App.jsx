import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@home/home.jsx'
import Login from './pages/Login/login.jsx'
import Dashboard from '@dashboard/dashboard.jsx'
import DashboardHome from '@dashboard/DashboardHome.jsx'
import SkillTree from '@dashboard/SkillTree.jsx'
import Study from '@dashboard/Study.jsx'
import Settings from '@dashboard/Settings.jsx'
import Help from '@dashboard/Help.jsx'
import Typing from '@dashboard/Typing.jsx'
import styles from '@/App.module.css'

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="skill-tree" element={<SkillTree />} />
            <Route path="study" element={<Study />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="typing" element={<Typing />} />
          </Route>
        </Routes>
      </div>
    </Router>
  )
}

export default App
