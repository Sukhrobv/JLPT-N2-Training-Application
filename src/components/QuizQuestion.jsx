import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './QuizQuestion.css';

export default function QuizQuestion({ sessionId, totalQuestions, onComplete }) {
  const [questionData, setQuestionData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Русские названия для типов
  const typeNamesRu = {
    'vocabulary': 'Лексика',
    'grammar': 'Грамматика',
    'reading': 'Чтение',
    'listening': 'Аудирование'
  };

  useEffect(() => {
    loadQuestion();
  }, [sessionId]);

  const loadQuestion = async () => {
    try {
      setLoading(true);
      setSelectedAnswer(null);
      setAnswerResult(null);
      const data = await api.getSessionQuestion(sessionId);
      
      if (data.completed) {
        onComplete();
        return;
      }
      
      setQuestionData(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || answerResult) return;
    
    try {
      setSubmitting(true);
      const result = await api.submitAnswer(sessionId, selectedAnswer);
      setAnswerResult(result);
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (answerResult?.hasNext) {
      loadQuestion();
    } else {
      onComplete();
    }
  };

  if (loading) {
    return (
      <div className="quiz-question loading">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-question error">
        <p>Ошибка: {error}</p>
        <button onClick={loadQuestion}>Повторить</button>
      </div>
    );
  }

  const progress = ((questionData.currentIndex + 1) / totalQuestions) * 100;
  const typeName = typeNamesRu[questionData.question.type] || questionData.question.typeJa;

  return (
    <div className="quiz-question">
      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">
          <span className="current">{questionData.currentIndex + 1}</span>
          <span className="separator">/</span>
          <span className="total">{totalQuestions}</span>
        </div>
      </div>

      {/* Question Type Badge */}
      <div className="question-type-badge">
        {typeName}
      </div>

      {/* Reading Passage */}
      {questionData.passage && (
        <div className="reading-passage">
          <div className="passage-header">
            <span className="passage-title">{questionData.passage.title || 'Текст для чтения'}</span>
            <span className="passage-progress">
              Вопрос {questionData.passage.currentInPassage} / {questionData.passage.totalInPassage}
            </span>
          </div>
          <div className="passage-content">
            {questionData.passage.content}
          </div>
        </div>
      )}

      {/* Question */}
      <div className="question-content">
        <p>
          {questionData.question.content.split(/__(.*?)__/g).map((part, index) => 
            index % 2 === 1 ? <u key={index}>{part}</u> : part
          )}
        </p>
      </div>

      {/* Answer Options */}
      <div className="answer-options">
        {questionData.question.answers.map((answer) => {
          let answerClass = 'answer-option';
          
          if (answerResult) {
            if (answer.id === answerResult.correctAnswerId) {
              answerClass += ' correct';
            } else if (answer.id === selectedAnswer && !answerResult.isCorrect) {
              answerClass += ' incorrect';
            }
          } else if (answer.id === selectedAnswer) {
            answerClass += ' selected';
          }
          
          return (
            <button
              key={answer.id}
              className={answerClass}
              onClick={() => !answerResult && setSelectedAnswer(answer.id)}
              disabled={!!answerResult}
            >
              <span className="answer-label">{answer.label}</span>
              <span className="answer-content">{answer.content}</span>
            </button>
          );
        })}
      </div>

      {/* Result and Explanation */}
      {answerResult && (
        <div className={`answer-feedback ${answerResult.isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="feedback-header">
            <span className="feedback-icon">
              {answerResult.isCorrect ? '✓' : '✗'}
            </span>
            <span className="feedback-text">
              {answerResult.isCorrect ? 'Правильно!' : 'Неправильно'}
            </span>
          </div>
          {answerResult.explanation && (
            <p className="explanation">{answerResult.explanation}</p>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="action-buttons">
        {!answerResult ? (
          <button 
            className="submit-button"
            onClick={handleSubmit}
            disabled={!selectedAnswer || submitting}
          >
            {submitting ? 'Отправка...' : 'Ответить'}
          </button>
        ) : (
          <button 
            className="next-button"
            onClick={handleNext}
          >
            {answerResult.hasNext ? 'Следующий вопрос →' : 'Результаты →'}
          </button>
        )}
      </div>
    </div>
  );
}
