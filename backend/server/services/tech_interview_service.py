import json
import re
import subprocess
import tempfile
import os
from server.services.ai import call_huggingface

def extract_json(text):
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except:
            pass
    return None

def execute_python_code(code: str, timeout_seconds: int = 5) -> dict:
    """Executes python code in a subprocess and returns output."""
    if not code or not code.strip():
        return {"status": "error", "output": "No code provided."}
    
    # Write code to temp file
    fd, path = tempfile.mkstemp(suffix=".py")
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(code)
            
        # Execute the script
        result = subprocess.run(
            ["python", path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        
        output = result.stdout
        if result.stderr:
            output += f"\n[Errors/Warnings]:\n{result.stderr}"
            
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": output or "[No output generated]"
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": f"Code execution timed out after {timeout_seconds} seconds. Infinite loop detected?"}
    except Exception as e:
        return {"status": "error", "output": f"Execution failed: {str(e)}"}
    finally:
        try:
            os.remove(path)
        except:
            pass

def get_tech_prompt_base(config):
    return f"""You are a professional technical interviewer specializing in Python and Data Structures & Algorithms.
Topic: {config.topic}
Difficulty: {config.difficulty}

Conduct a realistic technical interview. Ask one question at a time.
Vary the question types between:
1. Conceptual (e.g. explain a concept)
2. Code Explanation (e.g. what does this code do)
3. Debugging (e.g. find the bug)
4. DSA Problem / Coding Problem (e.g. write a function)
5. Complexity Analysis

Do not reveal answers immediately. Behave professionally.
"""

def generate_first_tech_question(config, hf_token=None, model_name=None):
    system_prompt = get_tech_prompt_base(config) + """
Your task is to ask the FIRST technical interview question.
Ensure it matches the difficulty and topic.

Output ONLY a JSON object with this exact format:
{
    "question": "The question text here. Use markdown for code blocks if needed.",
    "type": "conceptual", // or "coding", "debugging", "explanation", "complexity"
    "default_code": "# write your code here" // provide starter code if type is "coding" or "debugging", else empty string
}
"""
    try:
        content = call_huggingface(
            messages=[{"role": "system", "content": system_prompt}],
            token=hf_token,
            model=model_name,
            max_tokens=300
        )
        data = extract_json(content)
        if data and "question" in data:
            return data
        return {
            "question": "What is the difference between a list and a tuple in Python?",
            "type": "conceptual",
            "default_code": ""
        }
    except Exception as e:
        print(f"Error generating first tech question: {e}")
        return {
            "question": "Could you explain the concept of time complexity (Big O notation)?",
            "type": "conceptual",
            "default_code": ""
        }

def evaluate_tech_answer(config, history, current_question, current_answer, current_code, hf_token=None, model_name=None):
    history_text = ""
    for item in history:
        history_text += f"\nInterviewer: {item.get('question', {}).get('question', '')}\nCandidate Answer: {item.get('answer', '')}\nCandidate Code: {item.get('code', '')}\n"
        
    system_prompt = get_tech_prompt_base(config) + f"""
Previous Interview Context:{history_text}

Currently, you just asked: "{current_question.get('question', '')}" (Type: {current_question.get('type', '')})
The candidate answered: "{current_answer}"
The candidate submitted this code: "{current_code}"

Your tasks:
1. Evaluate their reasoning, code quality, time/space complexity, correctness, and communication.
2. Provide a score out of 10.
3. Provide brief, constructive feedback.
4. Generate the NEXT question (either a follow-up or a new topic).

Output ONLY a JSON object with this exact format:
{{
    "score": 8,
    "feedback": "Your evaluation feedback here.",
    "time_complexity": "O(n) - Explain briefly",
    "space_complexity": "O(1) - Explain briefly",
    "next_question": {{
        "question": "The next question here.",
        "type": "coding",
        "default_code": "def example():\\n    pass"
    }}
}}
"""
    try:
        content = call_huggingface(
            messages=[{"role": "system", "content": system_prompt}],
            token=hf_token,
            model=model_name,
            max_tokens=600
        )
        data = extract_json(content)
        if data and "score" in data and "next_question" in data:
            return data
            
        return {
            "score": 7,
            "feedback": "Good attempt. Make sure to consider edge cases.",
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "next_question": {
                "question": "What is the time complexity of your solution?",
                "type": "complexity",
                "default_code": ""
            }
        }
    except Exception as e:
        print(f"Error evaluating tech answer: {e}")
        return {
            "score": 5,
            "feedback": "Evaluation failed due to server error.",
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "next_question": {
                "question": "Let's move on. Can you explain what a Hash Map is?",
                "type": "conceptual",
                "default_code": ""
            }
        }

def generate_tech_report(config, history, hf_token=None, model_name=None):
    history_text = ""
    for i, item in enumerate(history):
        q_text = item.get('question', {}).get('question', '')
        history_text += f"\nQ{i+1}: {q_text}\nAnswer: {item.get('answer')}\nCode: {item.get('code')}\n"

    system_prompt = f"""You are an expert technical engineering manager analyzing an interview transcript.
Topic: {config.topic}
Difficulty: {config.difficulty}

Transcript:{history_text}

Analyze the entire interview performance.
Output ONLY a JSON object with this exact format:
{{
    "overall_score": 85,
    "python_knowledge": 80,
    "dsa_knowledge": 90,
    "problem_solving": 85,
    "coding_ability": 80,
    "complexity_analysis": 75,
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "recommended_topics": ["Topic 1", "Topic 2"],
    "topic_performance": [
        {{"topic": "Arrays", "score": 80}},
        {{"topic": "Python Fundamentals", "score": 90}}
    ],
    "question_review": [
        {{
            "topic": "Arrays",
            "question": "Find two numbers...",
            "approach": "Candidate's response...",
            "code": "Submitted python code...",
            "result": "Passed / Failed etc.",
            "time_complexity": "O(n)",
            "space_complexity": "O(1)",
            "score": "9/10"
        }}
    ]
}}
"""
    try:
        content = call_huggingface(
            messages=[{"role": "system", "content": system_prompt}],
            token=hf_token,
            model=model_name,
            max_tokens=800
        )
        data = extract_json(content)
        
        if data and "overall_score" in data:
            return data
            
        return default_tech_report()
    except Exception as e:
        print(f"Error generating tech report: {e}")
        return default_tech_report()

def default_tech_report():
    return {
        "overall_score": 70,
        "python_knowledge": 70,
        "dsa_knowledge": 70,
        "problem_solving": 70,
        "coding_ability": 70,
        "complexity_analysis": 70,
        "strengths": ["Attempted questions"],
        "weaknesses": ["Server failed to generate detailed report"],
        "recommended_topics": ["Core DSA"],
        "topic_performance": [
            {"topic": "General", "score": 70}
        ],
        "question_review": []
    }
