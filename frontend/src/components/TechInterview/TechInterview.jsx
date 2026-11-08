import React, { useState, useEffect } from 'react';
import './TechInterview.css';
import CodeEditor from './CodeEditor';

const API_BASE = 'http://localhost:5000';

export default function TechInterview({ hfToken, modelName, onBackToDashboard }) {
  // Phase state: 'config' -> 'active' -> 'report'
  const [phase, setPhase] = useState('config');
  
  // Config state
  const [difficulty, setDifficulty] = useState('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [topic, setTopic] = useState('All Topics');
  
  // Active Interview state
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [testOutput, setTestOutput] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // Report state
  const [report, setReport] = useState(null);

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (phase === 'active') {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/tech-interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { difficulty, num_questions: numQuestions, topic },
          hf_token: hfToken,
          model_name: modelName
        })
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentQuestion(data.question);
        setCurrentCode(data.question.default_code || '');
        setHistory([]);
        setPhase('active');
        setTimerSeconds(0);
      } else {
        alert("Failed to start interview.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCode = async () => {
    if (!currentCode.trim()) return;
    setIsRunningCode(true);
    setTestOutput(null);
    try {
      const response = await fetch(`${API_BASE}/api/tech-interview/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode })
      });
      if (response.ok) {
        const data = await response.json();
        setTestOutput(data.output);
      } else {
        setTestOutput("Failed to execute code.");
      }
    } catch (err) {
      setTestOutput("Error connecting to execution server.");
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() && !currentCode.trim()) return;
    setIsLoading(true);
    
    // Save to history locally for context
    const currentTurn = {
      question: currentQuestion,
      answer: currentAnswer,
      code: currentCode
    };
    const newHistory = [...history, currentTurn];
    setHistory(newHistory);
    
    // Check if interview is over
    if (newHistory.length >= numQuestions) {
      await generateFinalReport(newHistory);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tech-interview/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { difficulty, num_questions: numQuestions, topic },
          history: newHistory,
          current_question: currentQuestion,
          current_answer: currentAnswer,
          current_code: currentCode,
          hf_token: hfToken,
          model_name: modelName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentQuestion(data.next_question);
        setCurrentAnswer('');
        setCurrentCode(data.next_question.default_code || '');
        setTestOutput(null);
      } else {
        alert("Failed to get next question.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipQuestion = async () => {
    // Treat skip as an empty answer
    setCurrentAnswer("[Skipped by Candidate]");
    await handleSubmitAnswer();
  };

  const handleEndInterview = async () => {
    if (confirm("Are you sure you want to end the interview early?")) {
      await generateFinalReport(history);
    }
  };

  const generateFinalReport = async (finalHistory) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/tech-interview/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { difficulty, num_questions: numQuestions, topic },
          history: finalHistory,
          hf_token: hfToken,
          model_name: modelName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setPhase('report');
      } else {
        alert("Failed to generate report.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    } finally {
      setIsLoading(false);
    }
  };

  const restartInterview = () => {
    setPhase('config');
    setHistory([]);
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setCurrentCode('');
    setTestOutput(null);
    setReport(null);
  };

  if (phase === 'config') {
    return (
      <div className="ti-container">
        <div className="ti-landing">
          <h2>💻 Technical Interview</h2>
          <p>Test your Python and Data Structures & Algorithms skills with an AI technical interviewer.</p>
          
          <div className="ti-config-grid">
            <div className="ti-config-group">
              <label>Difficulty</label>
              <select className="ti-select" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="Easy">🟢 Easy</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Hard">🔴 Hard</option>
              </select>
            </div>
            
            <div className="ti-config-group">
              <label>Number of Questions</label>
              <select className="ti-select" value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}>
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
              </select>
            </div>
            
            <div className="ti-config-group">
              <label>Topic Selection</label>
              <select className="ti-select" value={topic} onChange={e => setTopic(e.target.value)}>
                <option value="All Topics">All Topics</option>
                <option value="Python Fundamentals">Python Fundamentals</option>
                <option value="Arrays & Strings">Arrays & Strings</option>
                <option value="Linked Lists">Linked Lists</option>
                <option value="Stacks & Queues">Stacks & Queues</option>
                <option value="Hashing">Hashing</option>
                <option value="Trees & Graphs">Trees & Graphs</option>
                <option value="Dynamic Programming">Dynamic Programming</option>
              </select>
            </div>
          </div>
          
          <button 
            className="ti-btn-start" 
            onClick={handleStartInterview} 
            disabled={isLoading}
          >
            {isLoading ? "Preparing Interview..." : "START TECHNICAL INTERVIEW"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'active') {
    const progressPercent = (history.length / numQuestions) * 100;
    
    return (
      <div className="ti-container">
        <div className="ti-workspace">
          {/* Left Panel: Question and Chat */}
          <div className="ti-sidebar">
            <div className="ti-progress-header">
              <span>Python + DSA | {difficulty}</span>
              <span className="ti-timer">⏱ {formatTime(timerSeconds)}</span>
            </div>
            <div className="ti-progress-header" style={{marginBottom: "5px", fontSize: "0.9rem"}}>
              <span>Question {history.length + 1} of {numQuestions}</span>
            </div>
            <div className="ti-progress-bar-bg">
              <div className="ti-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>

            <div className="ti-question-box">
              <div className="ti-ai-label">🤖 TECHNICAL INTERVIEWER</div>
              <div className="ti-question-content">
                {currentQuestion?.question}
              </div>
            </div>

            <div className="ti-answer-section">
              <label style={{fontWeight: "bold", marginTop: "10px"}}>YOUR APPROACH / EXPLANATION</label>
              <textarea 
                className="ti-textarea" 
                placeholder="Explain your approach here..."
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
              />
              
              <div className="ti-controls">
                <button 
                  className="ti-btn ti-btn-secondary" 
                  onClick={handleSkipQuestion}
                  disabled={isLoading}
                >
                  Skip
                </button>
                <button 
                  className="ti-btn ti-btn-primary" 
                  onClick={handleSubmitAnswer}
                  disabled={isLoading}
                >
                  {isLoading ? "Evaluating..." : "Submit Answer"}
                </button>
              </div>
              <button 
                className="ti-btn ti-btn-danger" 
                style={{marginTop: "10px"}}
                onClick={handleEndInterview}
              >
                End Interview
              </button>
            </div>
          </div>

          {/* Right Panel: Code Editor */}
          <div className="ti-main-panel">
            <CodeEditor 
              code={currentCode} 
              setCode={setCurrentCode} 
              onRun={handleRunCode} 
              isRunning={isRunningCode}
              testOutput={testOutput}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'report' && report) {
    return (
      <div className="ti-container">
        <div className="ti-report">
          <div className="ti-report-header">
            <h2>🏆 TECHNICAL INTERVIEW RESULTS</h2>
            <div className="ti-score-circle" style={{ "--score": report.overall_score }}>
              <span className="ti-score-text">{report.overall_score}/100</span>
            </div>
          </div>

          <div className="ti-metrics-grid">
            <div className="ti-metric-card">
              <div className="ti-metric-title">Python Knowledge</div>
              <div className="ti-metric-bar-bg">
                <div className="ti-metric-bar-fill" style={{ width: `${report.python_knowledge || 0}%` }}></div>
              </div>
              <div style={{marginTop: "5px", textAlign: "right"}}>{report.python_knowledge || 0}%</div>
            </div>
            <div className="ti-metric-card">
              <div className="ti-metric-title">DSA Knowledge</div>
              <div className="ti-metric-bar-bg">
                <div className="ti-metric-bar-fill" style={{ width: `${report.dsa_knowledge || 0}%` }}></div>
              </div>
              <div style={{marginTop: "5px", textAlign: "right"}}>{report.dsa_knowledge || 0}%</div>
            </div>
            <div className="ti-metric-card">
              <div className="ti-metric-title">Problem Solving</div>
              <div className="ti-metric-bar-bg">
                <div className="ti-metric-bar-fill" style={{ width: `${report.problem_solving || 0}%` }}></div>
              </div>
              <div style={{marginTop: "5px", textAlign: "right"}}>{report.problem_solving || 0}%</div>
            </div>
            <div className="ti-metric-card">
              <div className="ti-metric-title">Coding Ability</div>
              <div className="ti-metric-bar-bg">
                <div className="ti-metric-bar-fill" style={{ width: `${report.coding_ability || 0}%` }}></div>
              </div>
              <div style={{marginTop: "5px", textAlign: "right"}}>{report.coding_ability || 0}%</div>
            </div>
          </div>

          <div className="ti-report-section">
            <h3>💪 Strengths</h3>
            <ul className="ti-list">
              {(report.strengths || []).map((str, idx) => (
                <li key={idx}>{str}</li>
              ))}
            </ul>
          </div>

          <div className="ti-report-section">
            <h3>📈 Areas to Improve</h3>
            <ul className="ti-list">
              {(report.weaknesses || []).map((wk, idx) => (
                <li key={idx}>{wk}</li>
              ))}
            </ul>
          </div>
          
          <div className="ti-report-section">
            <h3>📚 Recommended Practice</h3>
            <ul className="ti-list">
              {(report.recommended_topics || []).map((topic, idx) => (
                <li key={idx}>{topic}</li>
              ))}
            </ul>
          </div>

          {report.question_review && report.question_review.length > 0 && (
            <div className="ti-report-section">
              <h3>Question-by-Question Review</h3>
              {report.question_review.map((qr, idx) => (
                <div className="ti-question-review" key={idx}>
                  <h4>Question {idx + 1}</h4>
                  {qr.topic && <div className="ti-review-topic">{qr.topic}</div>}
                  <div className="ti-review-item">
                    <span className="ti-review-label">Question: </span> {qr.question}
                  </div>
                  <div className="ti-review-item">
                    <span className="ti-review-label">Your Approach: </span> {qr.approach}
                  </div>
                  {qr.code && (
                    <div className="ti-review-item">
                      <span className="ti-review-label">Code: </span>
                      <pre style={{backgroundColor: "var(--bg-secondary)", padding: "10px", borderRadius: "5px"}}>{qr.code}</pre>
                    </div>
                  )}
                  <div className="ti-review-item">
                    <span className="ti-review-label">Time Complexity: </span> {qr.time_complexity || 'N/A'}
                  </div>
                  <div className="ti-review-item">
                    <span className="ti-review-label">Space Complexity: </span> {qr.space_complexity || 'N/A'}
                  </div>
                  <div className="ti-review-item" style={{color: "var(--accent-primary)", fontWeight: "bold"}}>
                    Score: {qr.score}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ti-report-actions">
            <button className="ti-btn ti-btn-primary" onClick={restartInterview}>
              🔄 Retake Technical Interview
            </button>
            <button className="ti-btn ti-btn-secondary" onClick={onBackToDashboard}>
              🏠 Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
