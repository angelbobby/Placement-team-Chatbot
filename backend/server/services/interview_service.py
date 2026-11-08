import json
import re
from fastapi import HTTPException
from server.services.ai import call_huggingface

def extract_json(text):
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except:
            pass
    return None

def generate_first_question(config, hf_token=None, model_name=None):
    system_prompt = f"""You are a professional placement interviewer conducting a realistic interview.
The candidate is applying for the role of: {config.role}.
The interview type is: {config.type}.
The difficulty is: {config.difficulty}.

Your task is to ask the FIRST interview question.
Do NOT act like a chatbot. Act like a real interviewer.
Do not provide answers or tips. Just ask the question.

Output ONLY a JSON object with this exact format:
{{
    "question": "The question text here"
}}
"""
    try:
        content = call_huggingface(
            messages=[{"role": "system", "content": system_prompt}],
            token=hf_token,
            model=model_name,
            max_tokens=200
        )
        data = extract_json(content)
        if data and "question" in data:
            return data["question"]
        return "Could you tell me a little bit about yourself and your background?"
    except Exception as e:
        print(f"Error generating first question: {e}")
        return "Could you introduce yourself and tell me about your background?"

def evaluate_and_next(config, history, current_question, current_answer, hf_token=None, model_name=None):
    # Format history
    history_text = ""
    for item in history:
        history_text += f"\nInterviewer: {item.get('question')}\nCandidate: {item.get('answer')}\n"
        
    system_prompt = f"""You are a professional placement interviewer conducting a realistic interview.
Role: {config.role}
Type: {config.type}
Difficulty: {config.difficulty}

Previous Interview Context:{history_text}

Currently, you just asked: "{current_question}"
The candidate answered: "{current_answer}"

Your tasks:
1. Evaluate the candidate's answer based on correctness, clarity, and relevance.
2. Provide a score out of 10.
3. Provide brief, constructive feedback on the answer.
4. Generate the NEXT question. The next question should logically follow up on their answer if appropriate, or move to a new relevant topic. Do not repeat questions.

Output ONLY a JSON object with this exact format:
{{
    "score": 8,
    "feedback": "Your feedback here.",
    "next_question": "The next question here."
}}
"""
    try:
        content = call_huggingface(
            messages=[{"role": "system", "content": system_prompt}],
            token=hf_token,
            model=model_name,
            max_tokens=400
        )
        data = extract_json(content)
        
        if data and "score" in data and "next_question" in data:
            return data
            
        # Fallback if json parsing fails
        return {
            "score": 7,
            "feedback": "Good attempt, but could be more detailed.",
            "next_question": "Can you elaborate on a related technical concept you are familiar with?"
        }
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return {
            "score": 5,
            "feedback": "Evaluation failed due to server error.",
            "next_question": "Let's move on. Can you describe a challenging project you've worked on?"
        }

def generate_report(config, history, hf_token=None, model_name=None):
    history_text = ""
    for i, item in enumerate(history):
        history_text += f"\nQ{i+1}: {item.get('question')}\nAnswer: {item.get('answer')}\n"

    system_prompt = f"""You are an expert technical recruiter analyzing an interview transcript.
Role: {config.role}
Type: {config.type}

Interview Transcript:{history_text}

Analyze the entire interview performance.
Output ONLY a JSON object with this exact format:
{{
    "overall_score": 85,
    "technical": 80,
    "communication": 90,
    "confidence": 85,
    "strengths": ["Strength 1", "Strength 2", "Strength 3"],
    "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
    "recommended_topics": ["Topic 1", "Topic 2", "Topic 3"],
    "summary": "A short 3-sentence overall summary of performance."
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
        
        if data and "overall_score" in data:
            return data
            
        # Fallback
        return default_report()
    except Exception as e:
        print(f"Error generating report: {e}")
        return default_report()

def default_report():
    return {
        "overall_score": 70,
        "technical": 70,
        "communication": 70,
        "confidence": 70,
        "strengths": ["Attempted all questions", "Communicated reasonably well"],
        "weaknesses": ["Needs more technical depth", "Lacked structured answers"],
        "recommended_topics": ["Core technical fundamentals", "STAR method for answering"],
        "summary": "The candidate completed the interview but the detailed report could not be generated due to a server error. Keep practicing!"
    }
