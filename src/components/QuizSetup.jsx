import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './QuizSetup.css';

const MIXED_TEMPLATE_COUNTS = {
  1: 5,
  2: 5,
  3: 5,
  4: 7,
  5: 5,
  6: 5,
  7: 12,
  8: 5,
  9: 5
};
const MIXED_TEMPLATE_TOTAL = Object.values(MIXED_TEMPLATE_COUNTS).reduce((sum, n) => sum + n, 0);

export default function QuizSetup({ onStart }) {
  const [chapters, setChapters] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [questionLimit, setQuestionLimit] = useState(0);
  const [useMixedTemplate, setUseMixedTemplate] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [chapterData, typeData] = await Promise.all([
          api.getChapters(),
          api.getTypes()
        ]);
        setChapters(chapterData);
        setTypes(typeData);
        setLoadingData(false);
      } catch (err) {
        setError(err.message);
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const resetCustomSelection = () => {
    setSelectedType(null);
    setSelectedChapters([]);
    setQuestionLimit(0);
  };

  const handleSelectMixed = () => {
    setUseMixedTemplate(true);
    resetCustomSelection();
  };

  const handleSelectCustom = () => {
    setUseMixedTemplate(false);
  };

  const handleChapterToggle = (chapterId) => {
    if (useMixedTemplate) return;
    setSelectedChapters(prev =>
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const handleSelectAllChapters = () => {
    if (useMixedTemplate) return;
    if (selectedChapters.length === chapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(chapters.map(c => c.id));
    }
  };

  const startSession = async (config) => {
    try {
      setSubmitting(true);
      const session = await api.createSession(config);
      onStart(session.sessionId, session.totalQuestions, config);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleStart = () => {
    if (useMixedTemplate) {
      startSession({ preset: 'mixed_chapter' });
      return;
    }

    startSession({
      typeId: selectedType,
      chapterIds: selectedChapters.length > 0 ? selectedChapters : null,
      limit: questionLimit > 0 ? questionLimit : null
    });
  };

  const handleStartMixedNow = () => {
    handleSelectMixed();
    startSession({ preset: 'mixed_chapter' });
  };

  const getTotalQuestions = () => {
    if (useMixedTemplate) {
      return MIXED_TEMPLATE_TOTAL;
    }
    let filtered = types;
    if (selectedType) {
      filtered = types.filter(t => t.id === selectedType);
    }
    return filtered.reduce((sum, t) => sum + t.question_count, 0);
  };

  const typeLabels = {
    vocabulary: 'Лексика',
    grammar: 'Грамматика',
    reading: 'Чтение',
    listening: 'Аудирование'
  };

  if (loadingData) {
    return (
      <div className="quiz-setup loading">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-setup error">
        <p>Ошибка: {error}</p>
        <button onClick={() => window.location.reload()}>Перезагрузить</button>
      </div>
    );
  }

  return (
    <div className="quiz-setup">
      <div className="setup-header">
        <h1>Тренажёр JLPT N2</h1>
        <p className="subtitle">Запустите готовый пресет или выберите главы и лимит вручную.</p>
      </div>

      <div className="setup-section">
        <h2>Быстрый пресет</h2>
        <div className={`template-card ${useMixedTemplate ? 'active' : ''}`} onClick={handleSelectMixed}>
          <div className="template-content">
            <div className="template-text">
              <p className="template-title">Сборная глава</p>
              <p className="template-description">
                54 вопроса: 5/5/5/7/5/5/12/5/5 по мондая 1-9. Для мондая 9 берётся один случайный текст со всеми его вопросами.
              </p>
            </div>
            <div className="template-meta">
              <span className="template-count">{MIXED_TEMPLATE_TOTAL} вопросов</span>
              <button
                type="button"
                className="template-toggle"
                onClick={(e) => { e.stopPropagation(); handleSelectMixed(); }}
              >
                {useMixedTemplate ? 'Выбрано' : 'Выбрать'}
              </button>
              <button
                type="button"
                className="template-toggle"
                onClick={(e) => { e.stopPropagation(); handleStartMixedNow(); }}
                disabled={submitting}
              >
                Запустить пресет
              </button>
            </div>
          </div>
          {useMixedTemplate && (
            <p className="template-hint">
              Фильтры по типам/главам и лимит отключены для этого режима.
            </p>
          )}
        </div>
      </div>

      <div className="setup-section">
        <h2>Типы заданий</h2>
        <div className="type-grid">
          <button
            className={`type-card ${!useMixedTemplate && selectedType === null ? 'selected' : ''} ${useMixedTemplate ? 'disabled' : ''}`}
            onClick={() => { handleSelectCustom(); setSelectedType(null); }}
            disabled={useMixedTemplate}
          >
            <span className="type-icon">*</span>
            <span className="type-name">Все типы</span>
            <span className="type-count">{types.reduce((sum, t) => sum + t.question_count, 0)} вопросов</span>
          </button>
          {types.map(type => (
            <button
              key={type.id}
              className={`type-card ${!useMixedTemplate && selectedType === type.id ? 'selected' : ''} ${useMixedTemplate ? 'disabled' : ''}`}
              onClick={() => { handleSelectCustom(); setSelectedType(type.id); }}
              disabled={useMixedTemplate}
            >
              <span className="type-icon">
                {type.name === 'vocabulary' && 'A'}
                {type.name === 'grammar' && 'G'}
                {type.name === 'reading' && 'R'}
                {type.name === 'listening' && 'L'}
              </span>
              <span className="type-name">{typeLabels[type.name] || type.name_ja}</span>
              <span className="type-count">{type.question_count} вопросов</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h2>Главы (по желанию)</h2>
        <div className="chapter-controls">
          <button
            className="select-all-btn"
            onClick={() => { handleSelectCustom(); handleSelectAllChapters(); }}
            disabled={useMixedTemplate}
          >
            {selectedChapters.length === chapters.length ? 'Снять выбор' : 'Выбрать все'}
          </button>
        </div>
        <div className="chapter-grid">
          {chapters.map(chapter => (
            <label key={chapter.id} className={`chapter-checkbox ${useMixedTemplate ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={selectedChapters.includes(chapter.id)}
                onChange={() => { handleSelectCustom(); handleChapterToggle(chapter.id); }}
                disabled={useMixedTemplate}
              />
              <span className="checkbox-custom"></span>
              <span className="chapter-name">{chapter.name}</span>
              <span className="chapter-count">{chapter.question_count} вопросов</span>
            </label>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h2>Ограничение вопросов</h2>
        <div className="limit-options">
          <label className={`limit-radio ${useMixedTemplate ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="limit"
              checked={questionLimit === 0}
            onChange={() => { handleSelectCustom(); setQuestionLimit(0); }}
            disabled={useMixedTemplate}
          />
          <span className="radio-custom"></span>
          <span>Без ограничения</span>
        </label>
          {[5, 10, 20].map(num => (
            <label key={num} className={`limit-radio ${useMixedTemplate ? 'disabled' : ''}`}>
              <input
                type="radio"
                name="limit"
                checked={questionLimit === num}
                onChange={() => { handleSelectCustom(); setQuestionLimit(num); }}
                disabled={useMixedTemplate}
              />
              <span className="radio-custom"></span>
              <span>{num} вопросов</span>
            </label>
          ))}
        </div>
      </div>

      <button
        className="start-button"
        onClick={handleStart}
        disabled={getTotalQuestions() === 0 || submitting}
      >
        Начать тренировку
        <span className="arrow">--&gt;</span>
      </button>
    </div>
  );
}
