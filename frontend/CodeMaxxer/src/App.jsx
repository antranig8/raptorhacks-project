import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@home/home.jsx'
import Login from '@login/login.jsx'
import LoginCallback from '@login/callback.jsx'
import Dashboard from '@dashboard/dashboard.jsx'
import DashboardHome from '@dashboard/components/DashboardHome.jsx'
import SkillTree from '@dashboard/components/SkillTree.jsx'
import Test from '@dashboard/components/Test.jsx'
import Study from '@dashboard/components/Study.jsx'
import Settings from '@dashboard/components/Settings.jsx'
import Help from '@dashboard/components/Help.jsx'
import Typing from '@dashboard/components/Typing.jsx'
import styles from '@/App.module.css'

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />}/>
          <Route path="/login/callback" element={<LoginCallback />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="skill-tree" element={<SkillTree />} />
            <Route path="test" element={<Test />} />
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
