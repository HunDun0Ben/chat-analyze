import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/features/Sidebar';
import { Dashboard } from './components/features/Dashboard';
import { SessionView } from './views/SessionView';
import { QuestionsView } from './views/QuestionsView';
import { useTheme } from './features/theme/useTheme';

function App() {
  useTheme(); // Initialize theme logic

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)] font-sans selection:bg-blue-500/30 selection:text-white transition-colors duration-200">
        <Sidebar />
        <main className="flex-1 min-w-0 relative flex flex-col">
          <Routes>
            <Route path="/session/:id" element={<SessionView />} />
            <Route path="/questions" element={<QuestionsView />} />
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
