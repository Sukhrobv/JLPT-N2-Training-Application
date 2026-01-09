import { useState } from 'react';
import * as api from './services/api';
import QuizSetup from './components/QuizSetup';
import QuizQuestion from './components/QuizQuestion';
import Results from './components/Results';
import Admin from './components/Admin';
import './App.css';

function App() {
  const [screen, setScreen] = useState('setup'); // 'setup', 'quiz', 'results', 'admin'
  const [sessionId, setSessionId] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [lastSessionConfig, setLastSessionConfig] = useState(null);

  const handleStart = (id, total, config) => {
    setSessionId(id);
    setTotalQuestions(total);
    setLastSessionConfig(config || null);
    setScreen('quiz');
  };

  const handleQuizComplete = () => {
    setScreen('results');
  };

  const handleRestart = async () => {
    if (!lastSessionConfig) {
      setScreen('setup');
      setSessionId(null);
      setTotalQuestions(0);
      return;
    }

    try {
      const session = await api.createSession(lastSessionConfig);
      setSessionId(session.sessionId);
      setTotalQuestions(session.totalQuestions);
      setScreen('quiz');
    } catch (err) {
      console.error('Failed to restart session:', err);
      setScreen('setup');
      setSessionId(null);
      setTotalQuestions(0);
    }
  };

  const handleGoToAdmin = () => {
    setScreen('admin');
  };

  const handleBackFromAdmin = () => {
    setScreen('setup');
  };

  return (
    <div className="app">
      <div className="app-container">
        {screen === 'setup' && (
          <>
            <QuizSetup onStart={handleStart} />
            <div className="admin-link">
              <button onClick={handleGoToAdmin}>
                ⚙️ Редактор вопросов
              </button>
            </div>
          </>
        )}
        
        {screen === 'quiz' && sessionId && (
          <QuizQuestion
            sessionId={sessionId}
            totalQuestions={totalQuestions}
            onComplete={handleQuizComplete}
          />
        )}
        
        {screen === 'results' && sessionId && (
          <Results 
            sessionId={sessionId}
            onRestart={handleRestart}
          />
        )}

        {screen === 'admin' && (
          <Admin onBack={handleBackFromAdmin} />
        )}
      </div>
    </div>
  );
}

export default App;
