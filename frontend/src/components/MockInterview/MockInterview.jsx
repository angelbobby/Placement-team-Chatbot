import React, { useState, useEffect, useRef } from 'react';
import './MockInterview.css';

export default function MockInterview() {
  const API_BASE = 'http://localhost:5000/api/interview';
  
  // Views: 'setup', 'interview', 'report'
  const [view, setView] = useState('setup');
  
  // Configuration State
  const [config, setConfig] = useState({
    role: 'Software Developer',
    customRole: '',
    type: 'Technical Interview',
    difficulty: 'Medium',
    num_questions: 5,
    mode: 'Text' // 'Text' or 'Voice'
  });
  
  // Interview State
  const [questions, setQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [interviewHistory, setInterviewHistory] = useState([]); // Array of { question, answer, feedback, score }
  
  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef(null);
  
  // Timer State
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Report State
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Setup timer
  useEffect(() => {
    let timerId;
    if (view === 'interview' && startTime) {
      timerId = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [view, startTime]);

  // Init Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setAnswer(prev => prev + finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setSpeechError("Microphone access was denied. You can continue using text input.");
          setIsRecording(false);
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleConfigChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const startInterview = async () => {
    setErrorMsg('');
    setIsProcessing(true);
    setLoadingMessage('🤖 Preparing your interview...');
    
    const finalRole = config.role === 'Custom Role' ? config.customRole : config.role;
    if (!finalRole.trim()) {
      setErrorMsg('Please specify a role.');
      setIsProcessing(false);
      return;
    }

    const payload = {
      config: {
        role: finalRole,
        type: config.type,
        difficulty: config.difficulty,
        num_questions: parseInt(config.num_questions)
      },
      hf_token: localStorage.getItem('hf_token') || '',
      model_name: localStorage.getItem('model_name') || ''
    };

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to start interview");
      
      const data = await res.json();
      setQuestions([data.question]);
      setCurrentQIdx(0);
      setInterviewHistory([]);
      setStartTime(Date.now());
      setElapsedTime(0);
      setAnswer('');
      setView('interview');
    } catch (err) {
      setErrorMsg("Error: Could not connect to AI. Check your connection or API key.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitAnswer = async (skip = false) => {
    const currentAns = skip ? "[Skipped]" : answer.trim();
    if (!skip && !currentAns) {
      setErrorMsg("Please provide an answer or skip the question.");
      return;
    }
    
    setErrorMsg('');
    setIsProcessing(true);
    setLoadingMessage(skip ? '⏭ Skipping question...' : '🔍 Analyzing your answer...');
    
    const currentQ = questions[currentQIdx];
    
    const payload = {
      config: {
        role: config.role === 'Custom Role' ? config.customRole : config.role,
        type: config.type,
        difficulty: config.difficulty,
        num_questions: parseInt(config.num_questions)
      },
      history: interviewHistory.map(h => ({ question: h.question, answer: h.answer })),
      current_question: currentQ,
      current_answer: currentAns,
      hf_token: localStorage.getItem('hf_token') || '',
      model_name: localStorage.getItem('model_name') || ''
    };

    try {
      const res = await fetch(`${API_BASE}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to evaluate answer");
      
      const data = await res.json();
      
      const newHistory = [...interviewHistory, {
        question: currentQ,
        answer: currentAns,
        score: data.score,
        feedback: data.feedback
      }];
      setInterviewHistory(newHistory);
      
      if (currentQIdx + 1 < parseInt(config.num_questions)) {
        setQuestions([...questions, data.next_question]);
        setCurrentQIdx(currentQIdx + 1);
        setAnswer('');
      } else {
        await generateFinalReport(newHistory);
      }
    } catch (err) {
      setErrorMsg("Error: Failed to process your answer. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateFinalReport = async (historyData) => {
    setIsProcessing(true);
    setLoadingMessage('📝 Generating final report...');
    
    const payload = {
      config: {
        role: config.role === 'Custom Role' ? config.customRole : config.role,
        type: config.type,
        difficulty: config.difficulty,
        num_questions: parseInt(config.num_questions)
      },
      history: historyData.map(h => ({ question: h.question, answer: h.answer })),
      hf_token: localStorage.getItem('hf_token') || '',
      model_name: localStorage.getItem('model_name') || ''
    };

    try {
      const res = await fetch(`${API_BASE}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to generate report");
      
      const data = await res.json();
      // append historyData to report data for rendering
      data.detailed_history = historyData;
      setReport(data);
      setView('report');
    } catch (err) {
      setErrorMsg("Error: Failed to generate report.");
    } finally {
      setIsProcessing(false);
    }
  };

  const endInterviewEarly = async () => {
    if (window.confirm("Are you sure you want to end the interview early?")) {
      await generateFinalReport(interviewHistory);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setSpeechError('');
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        setSpeechError("Speech recognition error or not supported.");
      }
    }
  };

  const readQuestionAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(questions[currentQIdx]);
      msg.rate = 0.95;
      window.speechSynthesis.speak(msg);
    }
  };

  const stopReadingAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const restart = () => {
    setView('setup');
    setReport(null);
    setQuestions([]);
    setInterviewHistory([]);
    setAnswer('');
    setErrorMsg('');
  };

  const renderSetup = () => (
    <div className="mi-setup-container">
      <div className="mi-setup-card glass-panel">
        <h2 className="mi-title">🎤 Configure AI Mock Interview</h2>
        <p className="mi-subtitle">Customize your realistic placement simulation.</p>
        
        {errorMsg && <div className="mi-error-alert">{errorMsg}</div>}
        
        <div className="mi-form-grid">
          <div className="mi-form-group">
            <label>Interview Type</label>
            <select name="type" value={config.type} onChange={handleConfigChange} className="mi-input">
              <option>Technical Interview</option>
              <option>HR Interview</option>
              <option>Behavioral Interview</option>
              <option>Mixed Interview</option>
            </select>
          </div>
          
          <div className="mi-form-group">
            <label>Target Role</label>
            <select name="role" value={config.role} onChange={handleConfigChange} className="mi-input">
              <option>Software Developer</option>
              <option>AI/ML Engineer</option>
              <option>Data Scientist</option>
              <option>Data Analyst</option>
              <option>Full Stack Developer</option>
              <option>Backend Developer</option>
              <option>Frontend Developer</option>
              <option>Custom Role</option>
            </select>
          </div>

          {config.role === 'Custom Role' && (
            <div className="mi-form-group full-width">
              <label>Custom Role Title</label>
              <input type="text" name="customRole" value={config.customRole} onChange={handleConfigChange} className="mi-input" placeholder="e.g. Cloud Architect" />
            </div>
          )}

          <div className="mi-form-group">
            <label>Difficulty</label>
            <select name="difficulty" value={config.difficulty} onChange={handleConfigChange} className="mi-input">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>

          <div className="mi-form-group">
            <label>Number of Questions</label>
            <select name="num_questions" value={config.num_questions} onChange={handleConfigChange} className="mi-input">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </select>
          </div>
          
          <div className="mi-form-group">
            <label>Interaction Mode</label>
            <select name="mode" value={config.mode} onChange={handleConfigChange} className="mi-input">
              <option>Text</option>
              <option>Voice</option>
            </select>
          </div>
        </div>
        
        <button className="mi-btn mi-btn-primary mi-start-btn" onClick={startInterview} disabled={isProcessing}>
          {isProcessing ? loadingMessage : "START MOCK INTERVIEW"}
        </button>
      </div>
    </div>
  );

  const renderInterview = () => {
    const currentQ = questions[currentQIdx] || '';
    const isVoiceMode = config.mode === 'Voice';

    return (
      <div className="mi-interview-container">
        <div className="mi-top-bar glass-panel">
          <div className="mi-meta">
            <span className="mi-badge">{config.role === 'Custom Role' ? config.customRole : config.role}</span>
            <span className="mi-badge">{config.type}</span>
            <span className="mi-badge difficulty">{config.difficulty}</span>
          </div>
          <div className="mi-timer">⏱ {formatTime(elapsedTime)}</div>
        </div>

        <div className="mi-progress-bar">
          <div className="mi-progress-fill" style={{ width: `${((currentQIdx) / parseInt(config.num_questions)) * 100}%` }}></div>
          <div className="mi-progress-text">Question {currentQIdx + 1} / {config.num_questions}</div>
        </div>

        <div className="mi-question-panel glass-panel">
          <h3 className="mi-section-title">🤖 AI INTERVIEWER</h3>
          <p className="mi-question-text">"{currentQ}"</p>
          <div className="mi-voice-controls">
            <button className="mi-icon-btn" onClick={readQuestionAloud} title="Listen to Question">🔊 Play</button>
            <button className="mi-icon-btn" onClick={stopReadingAloud} title="Stop Playing">⏹ Stop</button>
          </div>
        </div>

        <div className="mi-answer-panel glass-panel">
          <h3 className="mi-section-title">YOUR ANSWER</h3>
          {errorMsg && <div className="mi-error-alert">{errorMsg}</div>}
          {speechError && <div className="mi-error-alert warning">{speechError}</div>}
          
          <textarea 
            className="mi-answer-textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            disabled={isProcessing}
          ></textarea>
          
          <div className="mi-action-row">
            <div className="mi-voice-actions">
              {(isVoiceMode || window.SpeechRecognition || window.webkitSpeechRecognition) && (
                <button 
                  className={`mi-btn ${isRecording ? 'mi-btn-danger pulse' : 'mi-btn-secondary'}`} 
                  onClick={toggleRecording}
                  disabled={isProcessing}
                >
                  {isRecording ? "⏹ Stop Recording" : "🎤 Start Recording"}
                </button>
              )}
              <button className="mi-btn mi-btn-text" onClick={() => setAnswer('')} disabled={isProcessing || !answer}>Clear</button>
            </div>
            
            <button className="mi-btn mi-btn-primary" onClick={() => submitAnswer(false)} disabled={isProcessing || !answer.trim()}>
              {isProcessing && !loadingMessage.includes('Skipping') ? "Processing..." : "Submit Answer"}
            </button>
          </div>
        </div>

        <div className="mi-footer-actions">
          <button className="mi-btn mi-btn-outline" onClick={() => submitAnswer(true)} disabled={isProcessing}>Skip Question</button>
          <button className="mi-btn mi-btn-outline mi-btn-danger-outline" onClick={endInterviewEarly} disabled={isProcessing}>End Interview</button>
        </div>

        {isProcessing && (
          <div className="mi-overlay">
            <div className="mi-loader"></div>
            <p>{loadingMessage}</p>
          </div>
        )}
      </div>
    );
  };

  const renderReport = () => {
    if (!report) return null;
    
    const attempted = report.detailed_history.filter(h => h.answer !== "[Skipped]").length;
    
    return (
      <div className="mi-report-container">
        <div className="mi-report-header glass-panel">
          <h2>🎯 INTERVIEW PERFORMANCE</h2>
          <div className="mi-overall-score">
            <span className="mi-score-value">{report.overall_score}</span>
            <span className="mi-score-max">/ 100</span>
          </div>
          <p className="mi-summary-text">"{report.summary}"</p>
        </div>

        <div className="mi-metrics-grid">
          <div className="mi-metric-card glass-panel">
            <h4>Technical Knowledge</h4>
            <div className="mi-metric-bar"><div className="fill" style={{width: `${report.technical}%`}}></div></div>
            <span>{report.technical} / 100</span>
          </div>
          <div className="mi-metric-card glass-panel">
            <h4>Communication</h4>
            <div className="mi-metric-bar"><div className="fill" style={{width: `${report.communication}%`}}></div></div>
            <span>{report.communication} / 100</span>
          </div>
          <div className="mi-metric-card glass-panel">
            <h4>Confidence</h4>
            <div className="mi-metric-bar"><div className="fill" style={{width: `${report.confidence}%`}}></div></div>
            <span>{report.confidence} / 100</span>
          </div>
        </div>

        <div className="mi-stats-bar glass-panel">
          <div className="stat-item"><strong>Questions Attempted:</strong> {attempted} / {config.num_questions}</div>
          <div className="stat-item"><strong>Interview Duration:</strong> {formatTime(elapsedTime)}</div>
        </div>

        <div className="mi-feedback-grid">
          <div className="mi-feedback-card strengths glass-panel">
            <h3>💪 Strengths</h3>
            <ul>
              {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="mi-feedback-card weaknesses glass-panel">
            <h3>📈 Areas to Improve</h3>
            <ul>
              {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="mi-feedback-card topics glass-panel">
            <h3>📚 Recommended Topics</h3>
            <ol>
              {report.recommended_topics.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </div>
        </div>

        <div className="mi-qa-review glass-panel">
          <h3>Question-by-Question Review</h3>
          {report.detailed_history.map((item, idx) => (
            <div key={idx} className="mi-qa-item">
              <h4 className="qa-q">Question {idx + 1}</h4>
              <p className="qa-text"><strong>Q:</strong> {item.question}</p>
              <p className="qa-text"><strong>Your Answer:</strong> {item.answer}</p>
              <div className="qa-eval">
                <p><strong>Evaluation:</strong> {item.feedback}</p>
                <p className="qa-score"><strong>Score:</strong> {item.score} / 10</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mi-report-footer">
          <button className="mi-btn mi-btn-primary" onClick={restart}>🔄 Retake Interview</button>
        </div>
      </div>
    );
  };

  return (
    <div className="mock-interview-wrapper">
      {view === 'setup' && renderSetup()}
      {view === 'interview' && renderInterview()}
      {view === 'report' && renderReport()}
    </div>
  );
}
