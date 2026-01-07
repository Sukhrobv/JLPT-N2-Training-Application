import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './QuizSetup.css';

export default function QuizSetup({ onStart }) {
  const [chapters, setChapters] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [questionLimit, setQuestionLimit] = useState(0);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleChapterToggle = (chapterId) => {
    setSelectedChapters(prev =>
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const handleSelectAllChapters = () => {
    if (selectedChapters.length === chapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(chapters.map(c => c.id));
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      const session = await api.createSession({
        typeId: selectedType,
        chapterIds: selectedChapters.length > 0 ? selectedChapters : null,
        limit: questionLimit > 0 ? questionLimit : null
      });
      onStart(session.sessionId, session.totalQuestions);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getTotalQuestions = () => {
    let filtered = types;
    if (selectedType) {
      filtered = types.filter(t => t.id === selectedType);
    }
    return filtered.reduce((sum, t) => sum + t.question_count, 0);
  };

  // Русские названия для типов вопросов
  const typeNamesRu = {
    'vocabulary': 'Лексика',
    'grammar': 'Грамматика',
    'reading': 'Чтение',
    'listening': 'Аудирование'
  };

  if (loading) {
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
        <h1>JLPT N2 Тренажёр</h1>
        <p className="subtitle">Подготовка к экзамену по японскому языку</p>
      </div>

      <div className="setup-section">
        <h2>Тип заданий</h2>
        <div className="type-grid">
          <button
            className={`type-card ${selectedType === null ? 'selected' : ''}`}
            onClick={() => setSelectedType(null)}
          >
            <span className="type-icon">📚</span>
            <span className="type-name">Все</span>
            <span className="type-count">{types.reduce((sum, t) => sum + t.question_count, 0)} вопр.</span>
          </button>
          {types.map(type => (
            <button
              key={type.id}
              className={`type-card ${selectedType === type.id ? 'selected' : ''}`}
              onClick={() => setSelectedType(type.id)}
            >
              <span className="type-icon">
                {type.name === 'vocabulary' && '📖'}
                {type.name === 'grammar' && '✍️'}
                {type.name === 'reading' && '📄'}
                {type.name === 'listening' && '🎧'}
              </span>
              <span className="type-name">{typeNamesRu[type.name] || type.name_ja}</span>
              <span className="type-count">{type.question_count} вопр.</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h2>Главы (опционально)</h2>
        <div className="chapter-controls">
          <button 
            className="select-all-btn"
            onClick={handleSelectAllChapters}
          >
            {selectedChapters.length === chapters.length ? 'Снять все' : 'Выбрать все'}
          </button>
        </div>
        <div className="chapter-grid">
          {chapters.map(chapter => (
            <label key={chapter.id} className="chapter-checkbox">
              <input
                type="checkbox"
                checked={selectedChapters.includes(chapter.id)}
                onChange={() => handleChapterToggle(chapter.id)}
              />
              <span className="checkbox-custom"></span>
              <span className="chapter-name">{chapter.name}</span>
              <span className="chapter-count">{chapter.question_count} вопр.</span>
            </label>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <h2>Количество вопросов</h2>
        <div className="limit-options">
          <label className="limit-radio">
            <input
              type="radio"
              name="limit"
              checked={questionLimit === 0}
              onChange={() => setQuestionLimit(0)}
            />
            <span className="radio-custom"></span>
            <span>Все вопросы</span>
          </label>
          {[5, 10, 20].map(num => (
            <label key={num} className="limit-radio">
              <input
                type="radio"
                name="limit"
                checked={questionLimit === num}
                onChange={() => setQuestionLimit(num)}
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
        disabled={getTotalQuestions() === 0}
      >
        Начать тренировку
        <span className="arrow">→</span>
      </button>
    </div>
  );
}
