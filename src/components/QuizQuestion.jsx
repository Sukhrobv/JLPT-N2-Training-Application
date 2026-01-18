import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './QuizQuestion.css';

export default function QuizQuestion({ sessionId, totalQuestions, onComplete, onExit, onRestart }) {
  const [questionData, setQuestionData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [summary, setSummary] = useState(null);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const STAR_SYMBOL = '\u2605';
  const ORDERING_SLOT_TOKEN = '[[SLOT]]';
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Русские названия для типов вопросов
  const typeNamesRu = {
    'vocabulary': 'Лексика',
    'grammar': 'Грамматика',
    'reading': 'Чтение',
    'listening': 'Аудирование'
  };
  const answerState = questionData?.answer || null;
  const isAnswered = !!answerState?.userAnswerId;

  useEffect(() => {
    initializeSession();
  }, [sessionId]);

  useEffect(() => {
    setElapsedSeconds(0);
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const deltaSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(deltaSeconds);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key;
      const lowerKey = typeof key === 'string' ? key.toLowerCase() : '';
      const isSpace = event.code === 'Space' || key === ' ';
      const isArrowDown = key === 'ArrowDown';
      const isArrowUp = key === 'ArrowUp';
      const answerKeyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
      const isAnswerKey = Object.prototype.hasOwnProperty.call(answerKeyMap, lowerKey);
      if (!isSpace && !isArrowDown && !isArrowUp && !isAnswerKey) return;
      if ((isSpace || isAnswerKey) && event.repeat) return;
      const target = event.target;
      if (target?.isContentEditable) return;
      const tagName = target?.tagName?.toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;
      if (target?.closest('.question-map')) return;
      if (target?.closest('.question-map-toggle')) return;
      if (target?.closest('.nav-button')) return;
      if (error && isSpace) {
        event.preventDefault();
        initializeSession();
        return;
      }
      if (loading || submitting || !questionData) return;

      if (isAnswerKey) {
        if (isAnswered) return;
        const answers = questionData.question?.answers || [];
        if (!answers.length) return;
        const labeledAnswer = answers.find(
          (answer) => answer.label?.toLowerCase() === lowerKey
        );
        const targetAnswer = labeledAnswer ?? answers[answerKeyMap[lowerKey]];
        if (!targetAnswer) return;
        event.preventDefault();
        setSelectedAnswer(targetAnswer.id);
        return;
      }

      if (isSpace) {
        const answerButton = target?.closest('[data-answer-id]');
        if (answerButton && !isAnswered) {
          const answerId = answerButton.getAttribute('data-answer-id');
          if (!selectedAnswer || String(selectedAnswer) !== String(answerId)) {
            return;
          }
        }
      }

      if (isArrowDown || isArrowUp) {
        if (isAnswered) return;
        const answers = questionData.question?.answers || [];
        if (!answers.length) return;
        const currentIndex = answers.findIndex((answer) => answer.id === selectedAnswer);
        let nextIndex = currentIndex;
        if (currentIndex === -1) {
          nextIndex = isArrowDown ? 0 : answers.length - 1;
        } else {
          nextIndex = isArrowDown
            ? Math.min(currentIndex + 1, answers.length - 1)
            : Math.max(currentIndex - 1, 0);
        }
        if (nextIndex !== currentIndex) {
          event.preventDefault();
          setSelectedAnswer(answers[nextIndex].id);
        }
        return;
      }

      if (!isAnswered && !selectedAnswer) return;

      event.preventDefault();

      if (!isAnswered) {
        handleSubmit();
        return;
      }

      const answeredAll = !!summary && summary.answeredQuestions >= summary.totalQuestions;
      if (answeredAll) {
        onComplete();
        return;
      }
      handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, submitting, questionData, isAnswered, selectedAnswer, summary, error, onComplete, questionIndex, totalQuestions]);

  const loadSummary = async () => {
    const data = await api.getSessionSummary(sessionId);
    setSummary(data);
    return data;
  };

  const loadQuestion = async (index) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedAnswer(null);
      const data = await api.getSessionQuestion(sessionId, index);
      setQuestionData(data);
      setQuestionIndex(index);
      setSelectedAnswer(data.answer?.userAnswerId ?? null);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const initializeSession = async () => {
    try {
      setError(null);
      const summaryData = await loadSummary();
      const safeTotal = summaryData.totalQuestions || totalQuestions;
      const fallbackIndex = Math.min(summaryData.currentIndex || 0, Math.max(safeTotal - 1, 0));
      const initialIndex = summaryData.firstUnansweredIndex ?? fallbackIndex;
      await loadQuestion(initialIndex);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || questionData?.answer) return;
    
    try {
      setSubmitting(true);
      const result = await api.submitAnswer(sessionId, selectedAnswer, questionIndex);
      setQuestionData((prev) => ({
        ...prev,
        answer: {
          userAnswerId: selectedAnswer,
          isCorrect: result.isCorrect,
          correctAnswerId: result.correctAnswerId,
          explanation: result.explanation
        }
      }));
      setSubmitting(false);
      await loadSummary();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleNavigate = (index) => {
    if (loading || submitting) return;
    if (index < 0 || index >= (summary?.totalQuestions ?? totalQuestions)) return;
    if (index === questionIndex) return;
    loadQuestion(index);
  };

  const handlePrev = () => handleNavigate(questionIndex - 1);
  const handleNext = () => handleNavigate(questionIndex + 1);

  const renderQuestionContent = (content) => {
    const protectedContent = content.replace(/____/g, ORDERING_SLOT_TOKEN);
    const orderingTokenPattern = new RegExp(
      `(${escapeRegExp(ORDERING_SLOT_TOKEN)}|${escapeRegExp(STAR_SYMBOL)})`,
      'g'
    );

    return protectedContent.split(/__(.+?)__/g).map((part, index) => {
      if (index % 2 === 1) {
        return <u key={`u-${index}`}>{part}</u>;
      }

      return part
        .split(orderingTokenPattern)
        .map((subPart, subIndex) => {
          if (subPart === ORDERING_SLOT_TOKEN) {
            return <span key={`slot-${index}-${subIndex}`} className="ordering-slot"></span>;
          }
          if (subPart === STAR_SYMBOL) {
            return (
              <span key={`star-${index}-${subIndex}`} className="ordering-star">
                {STAR_SYMBOL}
              </span>
            );
          }
          return subPart;
        });
    });
  };

  if (loading && !summary && !questionData) {
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
        <button onClick={initializeSession}>Повторить</button>
      </div>
    );
  }

  if (!questionData) {
    return (
      <div className="quiz-question loading">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  const totalCount = summary?.totalQuestions ?? totalQuestions;
  const progress = totalCount > 0 ? ((questionIndex + 1) / totalCount) * 100 : 0;
  const typeName = questionData
    ? (typeNamesRu[questionData.question.type] || questionData.question.typeJa)
    : '';
  const allAnswered = !!summary && summary.answeredQuestions >= summary.totalQuestions;
  const formatElapsed = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );

  const handleCopy = (text, event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault(); // Prevent default button behavior
    }
    navigator.clipboard.writeText(text).then(() => {
      // Optional: Show a toast or tooltip
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const handleCopyAll = () => {
    if (!questionData) return;
    
    const parts = [];
    
    // Add passage if exists
    if (questionData.passage) {
      parts.push(questionData.passage.content);
      parts.push('');
    }
    
    // Add question
    parts.push(questionData.question.content.replace(/____/g, '____'));
    parts.push('');
    
    // Add answers
    questionData.question.answers.forEach((a, i) => {
      const label = a.label || String(i + 1);
      parts.push(`${label}. ${a.content}`);
    });
    
    handleCopy(parts.join('\n'));
  };

  return (
    <div className="quiz-question">
      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">
          <span className="current">{questionIndex + 1}</span>
          <span className="separator">/</span>
          <span className="total">{totalCount}</span>
        </div>
      </div>

      {summary && (
        <div className="question-map">
          <div className="question-map-header">
            <div className="question-map-title">
              <span>Вопросы</span>
              <span>{summary.answeredQuestions}/{summary.totalQuestions} ответов</span>
            </div>
            <button
              type="button"
              className="question-map-toggle"
              onClick={() => setShowQuestionMap((prev) => !prev)}
            >
              {showQuestionMap ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          {showQuestionMap && (
            <div className="question-map-grid">
              {summary.questions.map((item) => {
                const statusClass = item.answered
                  ? (item.isCorrect ? 'correct' : 'incorrect')
                  : 'unanswered';
                return (
                  <button
                    key={item.index}
                    className={`question-map-button ${statusClass} ${item.index === questionIndex ? 'current' : ''}`}
                    onClick={() => handleNavigate(item.index)}
                    disabled={loading}
                    aria-label={`Вопрос ${item.index + 1}`}
                  >
                    {item.index + 1}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Question Type Badge + Timer */}
      <div className="question-topbar">
        <div className="topbar-left">
          <div className="question-type-badge">
            {typeName}
          </div>
          <div className="quiz-timer" aria-live="polite">
            {formatElapsed(elapsedSeconds)}
          </div>
        </div>
        <div className="topbar-actions">
          <button 
            className="exit-quiz-button copy-button" 
            onClick={handleCopyAll} 
            title="Копировать всё"
          >
            <CopyIcon />
          </button>
          <button className="exit-quiz-button refresh-button" onClick={onRestart} title="Заново">
            ↻
          </button>
          <button className="exit-quiz-button" onClick={onExit} title="Выйти в меню">
            ✕
          </button>
        </div>
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
        <div className="question-text-wrapper">
          <p>
            {renderQuestionContent(questionData.question.content)}
          </p>
          <button 
            className="copy-icon-button" 
            onClick={(e) => handleCopy(questionData.question.content, e)}
            title="Копировать вопрос"
          >
            <CopyIcon />
          </button>
        </div>
      </div>

      {/* Answer Options */}
      <div className="answer-options">
        {questionData.question.answers.map((answer) => {
          let answerClass = 'answer-option';
          
          if (isAnswered) {
            if (answer.id === answerState.correctAnswerId) {
              answerClass += ' correct';
            } else if (answer.id === answerState.userAnswerId && !answerState.isCorrect) {
              answerClass += ' incorrect';
            }
          } else if (answer.id === selectedAnswer) {
            answerClass += ' selected';
          }
          
          return (
            <div key={answer.id} className="answer-wrapper">
              <button
                className={answerClass}
                data-answer-id={answer.id}
                onClick={() => !isAnswered && !loading && setSelectedAnswer(answer.id)}
                disabled={isAnswered || loading}
              >
                <span className="answer-label">{answer.label}</span>
                <span className="answer-content">{answer.content}</span>
              </button>
              <button 
                className="copy-answer-button"
                onClick={(e) => handleCopy(answer.content, e)}
                title="Копировать ответ"
              >
                <CopyIcon />
              </button>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="action-buttons">
        <button
          className="nav-button"
          onClick={handlePrev}
          disabled={loading || submitting || questionIndex <= 0}
          aria-label="Назад"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        {!isAnswered ? (
          <button 
            className="submit-button"
            onClick={handleSubmit}
            disabled={!selectedAnswer || submitting}
          >
            {submitting ? 'Отправка...' : 'Ответить'}
          </button>
        ) : (
          <span className="answer-locked">Ответ сохранен</span>
        )}
        <button
          className="nav-button"
          onClick={handleNext}
          disabled={loading || submitting || questionIndex >= totalCount - 1}
          aria-label="Вперед"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>

      {/* Explanation (Only if exists) */}
      {answerState && answerState.explanation && (
        <div className="answer-feedback">
          <p className="explanation">{answerState.explanation}</p>
        </div>
      )}

      {allAnswered && (
        <div className="results-actions">
          <button className="show-results-button" onClick={onComplete}>
            Показать ответы
          </button>
        </div>
      )}
    </div>
  );
}
