import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@home/home.jsx'
import Login from '@login/login.jsx'
import LoginCallback from '@login/callback.jsx'
import Dashboard from '@dashboard/dashboard.jsx'
import DashboardHome from '@d_general/dashboard/DashboardHome.jsx'
import Plan from '@d_general/plan/Plan.jsx'
import SkillTree from '@d_general/skilltree/SkillTree.jsx'
import Test from '@dashboard/components/Test.jsx'
import Settings from '@d_support/settings/Settings.jsx'
import Help from '@d_support/help/Help.jsx'
import Typing from '@d_general/typing/Typing.jsx'
import VisualPythonLab from '@d_general/visualpython/VisualPythonLab.jsx'
import Coding from '@d_study/coding/Coding.jsx'
import Quizzes from '@d_study/quizzes/Quizzes.jsx'
import ProtectedRoute from '@/components/ProtectedRoute.jsx'
import styles from '@/App.module.css'

function App() {
  return (
    <Router>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<LoginCallback />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardHome />} />
              <Route path="plan" element={<Plan />} />
              <Route path="skill-tree" element={<SkillTree />} />
              <Route path="test" element={<Test />} />
              <Route path="quizzes" element={<Quizzes />} />
              <Route path="coding" element={<Coding />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
              <Route path="typing" element={<Typing />} />
              <Route path="visual-python" element={<VisualPythonLab />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </Router>
  )
}

export default App
