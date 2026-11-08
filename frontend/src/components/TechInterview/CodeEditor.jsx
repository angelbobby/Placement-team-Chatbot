import React, { useState, useEffect, useRef } from 'react';

export default function CodeEditor({ code, setCode, onRun, isRunning, testOutput }) {
  const textareaRef = useRef(null);

  // Simple auto-indentation and tab support
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      
      // Move cursor right after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  return (
    <div className="ti-code-editor-wrapper">
      <div className="ti-editor-header">
        <span className="ti-editor-lang">python</span>
        <button className="ti-btn ti-btn-run" onClick={onRun} disabled={isRunning}>
          {isRunning ? "Running..." : "▶ Run Code"}
        </button>
      </div>
      
      <div className="ti-editor-body">
        <textarea
          ref={textareaRef}
          className="ti-textarea-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck="false"
          placeholder="# Write your Python solution here..."
        />
      </div>

      {(testOutput !== null && testOutput !== undefined) && (
        <div className="ti-test-output">
          <div className="ti-output-header">Terminal Output</div>
          <pre className="ti-output-content">{testOutput}</pre>
        </div>
      )}
    </div>
  );
}
