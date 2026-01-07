import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './Results.css';

export default function Results({ sessionId, onRestart }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Русские названия для типов
  const typeNamesRu = {
    'vocabulary': 'Лексика',
    'grammar': 'Грамматика',
    'reading': 'Чтение',
    'listening': 'Аудирование'
  };

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  const loadResults = async () => {
    try {
      const data = await api.getSessionResults(sessionId);
      setResults(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="results loading">
        <div className="spinner"></div>
        <p>Загрузка результатов...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results error">
        <p>Ошибка: {error}</p>
        <button onClick={loadResults}>Повторить</button>
      </div>
    );
  }

  const getScoreClass = () => {
    if (results.percentage >= 80) return 'excellent';
    if (results.percentage >= 60) return 'good';
    if (results.percentage >= 40) return 'fair';
    return 'needs-work';
  };

  const getScoreMessage = () => {
    if (results.percentage >= 80) return 'Отлично!';
    if (results.percentage >= 60) return 'Хорошо!';
    if (results.percentage >= 40) return 'Неплохо!';
    return 'Нужно практиковаться!';
  };

  return (
    <div className="results">
      <div className="results-header">
        <h1>Тренировка завершена</h1>
      </div>

      {/* Score Circle */}
      <div className={`score-circle ${getScoreClass()}`}>
        <div className="score-value">{results.percentage}%</div>
        <div className="score-label">{getScoreMessage()}</div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-value">{results.correctAnswers}</div>
          <div className="stat-label">Правильно</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✗</div>
          <div className="stat-value">{results.totalQuestions - results.correctAnswers}</div>
          <div className="stat-label">Неправильно</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{results.totalQuestions}</div>
          <div className="stat-label">Всего</div>
        </div>
      </div>

      {/* Toggle Details */}
      <button 
        className="toggle-details"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? 'Скрыть детали ▲' : 'Показать детали ▼'}
      </button>

      {/* Details */}
      {showDetails && (
        <div className="details-section">
          <h2>Детальный разбор</h2>
          <div className="details-list">
            {results.details.map((item, index) => (
              <div 
                key={index} 
                className={`detail-item ${item.isCorrect ? 'correct' : 'incorrect'}`}
              >
                <div className="detail-header">
                  <span className="detail-number">Вопрос {index + 1}</span>
                  <span className="detail-type">{typeNamesRu[item.type] || item.typeJa}</span>
                  <span className={`detail-status ${item.isCorrect ? 'correct' : 'incorrect'}`}>
                    {item.isCorrect ? '○' : '×'}
                  </span>
                </div>
                <div className="detail-question">{item.questionContent}</div>
                <div className="detail-answers">
                  <div className="detail-answer">
                    <span className="answer-type">Ваш ответ:</span>
                    <span className={item.isCorrect ? 'correct-text' : 'incorrect-text'}>
                      {item.userAnswer || '(нет ответа)'}
                    </span>
                  </div>
                  {!item.isCorrect && (
                    <div className="detail-answer">
                      <span className="answer-type">Правильный ответ:</span>
                      <span className="correct-text">{item.correctAnswer}</span>
                    </div>
                  )}
                </div>
                {item.explanation && (
                  <div className="detail-explanation">
                    <span className="explanation-label">Объяснение:</span>
                    {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="results-actions">
        <button className="primary-button" onClick={onRestart}>
          Попробовать ещё раз
        </button>
        <button className="secondary-button" onClick={() => window.location.reload()}>
          На главную
        </button>
      </div>
    </div>
  );
}
