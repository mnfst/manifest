#!/usr/bin/env python3
"""
TaskBench Full Benchmark Runner
Runs all tasks across all models via direct API calls.
Tracks spend in real-time and stops if approaching budget limit.

Usage:
    python scripts/run_full_benchmark.py
"""

import json
import os
import sys
import time
import csv
from pathlib import Path
from datetime import datetime


def load_dotenv():
    """Load .env file into os.environ."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())


load_dotenv()

# --- BUDGET GUARD ---
BUDGET_LIMIT_USD = 200.0  # Hard stop at $200 (cap is $250, leave margin)
SPEND_FILE = "results/spend_tracker.json"

# --- MODEL DEFINITIONS ---
MODELS = {
    # Azure models (OpenAI-compatible endpoint)
    "DeepSeek-V3.2": {
        "provider": "azure", "input_price": 0.30, "output_price": 1.10,
        "max_tokens_param": "max_tokens"
    },
    "DeepSeek-R1": {
        "provider": "azure", "input_price": 0.55, "output_price": 2.19,
        "max_tokens_param": "max_tokens"
    },
    "gpt-5.1-chat": {
        "provider": "azure", "input_price": 2.00, "output_price": 8.00,
        "max_tokens_param": "max_completion_tokens"
    },
    "o4-mini": {
        "provider": "azure", "input_price": 1.10, "output_price": 4.40,
        "max_tokens_param": "max_completion_tokens"
    },
    "grok-4-20-non-reasoning": {
        "provider": "azure", "input_price": 2.00, "output_price": 8.00,
        "max_tokens_param": "max_tokens"
    },
    "grok-4-20-reasoning": {
        "provider": "azure", "input_price": 2.00, "output_price": 8.00,
        "max_tokens_param": "max_tokens"
    },
    "Kimi-K2.6": {
        "provider": "azure", "input_price": 0.60, "output_price": 2.40,
        "max_tokens_param": "max_tokens"
    },
    "Llama-4-Scout-17B-16E-Instruct": {
        "provider": "azure", "input_price": 0.17, "output_price": 0.17,
        "max_tokens_param": "max_tokens"
    },
    "mistral-medium-2505": {
        "provider": "azure", "input_price": 0.40, "output_price": 2.00,
        "max_tokens_param": "max_tokens"
    },
    "Codestral-2501": {
        "provider": "azure", "input_price": 0.30, "output_price": 0.90,
        "max_tokens_param": "max_tokens"
    },
    # Direct API models
    "gpt-4o": {
        "provider": "openai", "input_price": 2.50, "output_price": 10.00,
        "max_tokens_param": "max_tokens"
    },
    "gpt-4o-mini": {
        "provider": "openai", "input_price": 0.15, "output_price": 0.60,
        "max_tokens_param": "max_tokens"
    },
    "claude-sonnet-4-20250514": {
        "provider": "anthropic", "input_price": 3.00, "output_price": 15.00,
        "max_tokens_param": "max_tokens"
    },
    # Gemini models
    "gemini-2.5-pro": {
        "provider": "gemini", "input_price": 1.25, "output_price": 10.00,
        "max_tokens_param": "max_tokens"
    },
    "gemini-2.5-flash": {
        "provider": "gemini", "input_price": 0.15, "output_price": 0.60,
        "max_tokens_param": "max_tokens"
    },
    "gemini-2.0-flash": {
        "provider": "gemini", "input_price": 0.10, "output_price": 0.40,
        "max_tokens_param": "max_tokens"
    },
    # MiniMax models
    "MiniMax-M2.7": {
        "provider": "minimax", "input_price": 1.10, "output_price": 4.40,
        "max_tokens_param": "max_tokens"
    },
}

# --- TASK DEFINITIONS ---
TASKS = {
    "intent_easy": {
        "system": "",
        "prompt_template": 'Classify the following customer message into exactly one of these intents:\ncancel_subscription, store_hours, password_reset, upgrade_plan, order_tracking,\nbilling_inquiry, refund_request, technical_support, account_deletion, general_inquiry\n\nRespond with ONLY the intent label, nothing else.\n\nMessage: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "cases": [
            {"input": "I need to cancel my subscription right away", "expected": "cancel_subscription"},
            {"input": "What time does your store close on Saturdays?", "expected": "store_hours"},
            {"input": "Can you help me reset my password? I forgot it", "expected": "password_reset"},
            {"input": "I want to upgrade to the premium plan", "expected": "upgrade_plan"},
            {"input": "Where is my order? It was supposed to arrive yesterday", "expected": "order_tracking"},
            {"input": "Why was I charged twice this month?", "expected": "billing_inquiry"},
            {"input": "I'd like a refund for my last purchase", "expected": "refund_request"},
            {"input": "The app keeps crashing when I open settings", "expected": "technical_support"},
            {"input": "Please delete my account permanently", "expected": "account_deletion"},
            {"input": "What payment methods do you accept?", "expected": "general_inquiry"},
        ]
    },
    "intent_hard": {
        "system": "",
        "prompt_template": 'Classify the following customer message into exactly one PRIMARY intent.\nAvailable intents: cancel_subscription, billing_inquiry, refund_request,\ntechnical_support, upgrade_plan, downgrade_plan, account_deletion,\npassword_reset, feature_request, bug_report, order_tracking,\nshipping_issue, product_inquiry, complaint, compliment\n\nIf the message contains multiple intents, pick the PRIMARY one.\nRespond with ONLY the intent label, nothing else.\n\nMessage: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "cases": [
            {"input": "I'm thinking about canceling because my last bill was way higher than expected. Can someone explain the charges?", "expected": "billing_inquiry"},
            {"input": "This is the third time my order arrived damaged. I'm done. I want my money back for all three orders.", "expected": "refund_request"},
            {"input": "Oh great, another update that broke the search feature. Really love how every release makes things worse.", "expected": "bug_report"},
            {"input": "If I move to the business plan, would I get API access and priority support? My team is growing and we need more seats.", "expected": "upgrade_plan"},
            {"input": "It would be really nice if the app could sync with Google Calendar.", "expected": "feature_request"},
            {"input": "I have to say, after months of terrible experiences, the new support team is actually helpful.", "expected": "compliment"},
            {"input": "I don't need all these enterprise features anymore since half my team left. Can I switch to a smaller plan?", "expected": "downgrade_plan"},
            {"input": "I might be doing something wrong but every time I try to export a PDF the app just spins forever.", "expected": "technical_support"},
            {"input": "I'm freaking out because I ordered a birthday present 2 weeks ago and the tracking hasn't updated.", "expected": "order_tracking"},
            {"input": "I need everything gone. Delete my account, my data, all of it. GDPR.", "expected": "account_deletion"},
        ]
    },
    "email_summary": {
        "system": "",
        "prompt_template": "Summarize the following email in exactly 2 sentences. Capture the main point and any action items.\n\nEmail:\n{input}\n\nSummary:",
        "eval_type": "llm_judge",
        "max_output_tokens": 200,
        "judge_prompt": "Rate this email summary on a 1-5 scale. 5=captures all key points and action items. 4=captures main point with minor omissions. 3=gets topic right but misses specifics. 2=vaguely related. 1=wrong or empty. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "Subject: Q3 Budget Review Meeting\n\nHi team,\n\nI wanted to follow up on our discussion from last week regarding the Q3 budget allocation. After reviewing the numbers with finance, we've identified that the marketing department has exceeded their projected spend by 15%, primarily due to the unplanned campaign launch in August. However, the engineering team is currently 8% under budget due to delayed hiring.\n\nI'd like to propose we reallocate $50K from engineering's unused budget to cover marketing's overspend, rather than requesting additional funds from the board. This would keep us within our overall quarterly target.\n\nCan we schedule a 30-minute call this Thursday to discuss? Please confirm your availability.\n\nBest,\nSarah"},
            {"input": "Subject: Re: Server Outage Post-Mortem\n\nTeam,\n\nHere's the summary from yesterday's incident:\n\n- Root cause: A misconfigured load balancer rule deployed at 2:14 PM EST caused all traffic to route to a single node\n- Impact: 47 minutes of degraded service affecting approximately 12,000 users\n- Resolution: The on-call engineer (Mike) identified the issue at 2:38 PM and rolled back the configuration at 3:01 PM\n- Action items: (1) Add load balancer config validation to CI pipeline, (2) Update runbook for LB-related incidents, (3) Implement automated traffic distribution alerts\n\nThe full post-mortem document is attached. Please review and add any comments by Friday.\n\nThanks,\nJen"},
            {"input": "Subject: Urgent: Security Vulnerability Disclosure\n\nHi Security Team,\n\nDuring our routine penetration testing, we discovered a critical SQL injection vulnerability in the user authentication endpoint (/api/v2/auth/login). An attacker could potentially bypass authentication and access any user account.\n\nSeverity: Critical (CVSS 9.8)\nAffected versions: v3.2.0 through v3.4.1\nRecommended fix: Parameterize the query in auth_controller.py line 142\n\nWe've prepared a patch that's ready for review. Given the severity, I recommend we deploy a hotfix within 24 hours.\n\nBest,\nDavid"},
            {"input": "Subject: Employee Onboarding Feedback - March Cohort\n\nHi HR Team,\n\nI compiled feedback from the 8 new hires in our March cohort. Overall satisfaction score: 7.2/10, down from 8.1 in February.\n\nKey positives:\n- Buddy system was highly rated (avg 9.1/10)\n- IT equipment arrived on time for all 8 hires\n\nAreas for improvement:\n- 5 of 8 reported confusion about benefits enrollment deadline\n- Access to internal tools took 3-5 days instead of the target 1 day\n- No one received the company culture handbook mentioned in the offer letter\n\nI'd suggest we prioritize fixing the tools access delay.\n\nCheers,\nLisa"},
            {"input": "Subject: Partnership Proposal - DataSync Inc.\n\nDear Alex,\n\nFollowing our conversation at the TechConnect conference, I'm writing to formally propose a strategic partnership. DataSync's real-time data synchronization technology could significantly enhance your platform's multi-region capabilities.\n\nWe're proposing a revenue-sharing model where we handle the data sync infrastructure and you integrate our SDK. Based on our projections, this could reduce your customers' data latency by 60% while generating an estimated $2M in additional annual revenue for both parties.\n\nWould you be available for a deeper technical discussion next week?\n\nRegards,\nMaria Chen\nCEO, DataSync Inc."},
        ]
    },
    "sql_generation": {
        "system": "",
        "prompt_template": "Given the following database schema, write a SQL query to answer the question.\nReturn ONLY the SQL query, no explanation.\n\nSchema:\n{schema}\n\nQuestion: {input}\n\nSQL:",
        "eval_type": "llm_judge",
        "max_output_tokens": 300,
        "judge_prompt": "Rate this SQL query on a 1-5 scale for correctness given the schema and question. 5=perfectly correct. 4=correct logic with minor syntax issues. 3=right approach but errors. 2=wrong logic. 1=not valid SQL. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "Show me all customers who signed up in the last 30 days and have made at least one purchase", "schema": "Tables: customers (id, name, email, signup_date), orders (id, customer_id, total, created_at)"},
            {"input": "What is the average order value per country, sorted from highest to lowest?", "schema": "Tables: orders (id, customer_id, total, created_at), customers (id, name, email, country)"},
            {"input": "Find the top 5 products by revenue in the last quarter", "schema": "Tables: products (id, name, price, category), order_items (id, order_id, product_id, quantity), orders (id, total, created_at)"},
            {"input": "List employees who have not submitted any expense reports this year", "schema": "Tables: employees (id, name, department, hire_date), expense_reports (id, employee_id, amount, submitted_at)"},
            {"input": "Calculate the month-over-month growth rate of new user signups", "schema": "Tables: users (id, email, created_at)"},
        ]
    },
    "reasoning": {
        "system": "",
        "prompt_template": "Solve the following problem step by step. After your reasoning, write your final answer on the last line in this exact format:\nANSWER: <your answer>\n\nProblem: {input}",
        "eval_type": "llm_judge",
        "max_output_tokens": 800,
        "judge_prompt": "Rate the answer on a 1-5 scale. 5=completely correct answer with sound reasoning. 4=correct answer with minor reasoning gaps. 3=partially correct. 2=wrong answer but some correct steps. 1=completely wrong. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "A meeting room can hold 3 meetings per day. Each meeting lasts 2 hours. The room is available from 8 AM to 6 PM with mandatory 30-minute breaks between meetings. What is the latest time the third meeting can start?"},
            {"input": "Company A charges $0.003 per token for input and $0.015 per token for output. Company B charges $4 per million input tokens and $12 per million output tokens. A typical API call uses 800 input tokens and 200 output tokens. Which company is cheaper per call, and by how much?"},
            {"input": "A product costs $100. It goes on sale for 20% off. Then an additional 15% discount is applied to the sale price. Finally, 8.5% sales tax is added. What is the final price?"},
            {"input": "A startup has 3 engineers and needs to complete 5 tasks. Task A takes 2 days and must be done before Task C. Task B takes 3 days and has no dependencies. Task C takes 1 day and must be done before Task E. Task D takes 2 days and has no dependencies. Task E takes 1 day. Each engineer works on one task at a time. What is the minimum number of days to complete all tasks?"},
            {"input": "A snail climbs 3 feet during the day but slides back 2 feet at night. The well is 20 feet deep. On which day does the snail reach the top?"},
            {"input": "A company's revenue was $1M in Q1, $1.2M in Q2, $0.9M in Q3, and $1.5M in Q4. Their costs were 60% of revenue in Q1, 65% in Q2, 70% in Q3, and 55% in Q4. In which quarter did they have the highest profit margin (percentage), and what was that margin?"},
            {"input": "A shipping company charges: $5 base + $2/kg for packages under 10kg, $5 base + $1.50/kg for 10-25kg, and flat $45 for over 25kg. A customer ships 3 packages: 8kg, 15kg, and 30kg. What is the total shipping cost?"},
        ]
    },
    "extraction_hard": {
        "system": "",
        "prompt_template": "Extract structured data from the following text. Return ONLY valid JSON matching the specified schema. No explanation.\n\nSchema: {schema}\n\nText: {input}",
        "eval_type": "llm_judge",
        "max_output_tokens": 500,
        "judge_prompt": "Rate this JSON extraction on a 1-5 scale. 5=valid JSON with all fields correct. 4=valid JSON with 1 minor error. 3=valid JSON but 2+ errors. 2=invalid JSON but right idea. 1=not JSON or completely wrong. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": 'INVOICE #INV-2024-0847\nDate: March 15th, 2024\nFrom: Johnson & Sons LLC\n\nItems:\n- 5x USB-C Cables (premium) @ $12.99 each\n- Office Chair, ergonomic mesh -- qty 2 -- $349.99/ea\n- 1 box of printer paper (A4) $45.50\n\nSubtotal: $824.42\nTax (8.25%): $68.01\nTotal Due: $892.43 USD', "schema": '{"invoice_number": string, "date": "YYYY-MM-DD", "vendor": string, "items": [{"description": string, "quantity": number, "unit_price": number}], "total": number, "currency": string}'},
            {"input": "SARAH CHEN | sarah.c@gmail.com\n\nCurrently: Lead ML Engineer @ Anthropic (since Jan 2023)\n\nPreviously:\n- Staff Eng at Google Brain, 2019-2022\n- ML Engineer, Uber ATG, 2016-2019\n\nEducation:\nMS Computer Science - Stanford '16\nBS Mathematics + CS, MIT 2014\n\nSkills: PyTorch, JAX, distributed training, transformer architectures, RLHF", "schema": '{"name": string, "email": string, "current_role": {"title": string, "company": string}, "education": [{"degree": string, "institution": string, "year": number}], "skills": [string]}'},
            {"input": "Product sync - April 10 2026\n\nPresent: Jamie (PM), Priya (eng lead), Marcus (design), Lin (data)\n\nDecided to push the recommendation engine to Q3 since data pipeline won't be ready until June. Marcus will have onboarding mockups by April 18. Agreed to allocate 20% of sprint capacity to tech debt. Jamie will send updated roadmap by Monday. Lin needs analytics dashboard before May board meeting.", "schema": '{"meeting_title": string, "date": "YYYY-MM-DD", "attendees": [string], "decisions": [string], "action_items": [{"owner": string, "task": string, "deadline": string}]}'},
            {"input": "hey so the checkout page is completely broken. im on chrome 121 on windows 11. i add stuff to cart, go to checkout, enter card info and hit pay. spinner for 30 seconds then white screen. no error message. console shows CORS error and undefined is not a function in checkout.bundle.js:847. happened 3 times. works fine on firefox btw", "schema": '{"severity": "critical|high|medium|low", "component": string, "summary": string, "steps_to_reproduce": [string], "expected_behavior": string, "actual_behavior": string, "environment": {"os": string, "browser": string}}'},
            {"input": "We're hiring! Senior Backend Engineer at CloudMatrix (Series B)\n\nAustin TX, open to remote US.\n\nComp: $165-195K + equity\n\n5+ years distributed systems. Must know Go or Rust, Kubernetes, event-driven architectures.\n\nPerks: unlimited PTO, health/dental/vision, 401k match, $3K learning budget.", "schema": '{"title": string, "company": string, "location": {"city": string, "remote": boolean}, "salary": {"min": number, "max": number}, "requirements": {"min_years": number, "skills": [string]}, "benefits": [string]}'},
        ]
    },
    "sentiment": {
        "system": "",
        "prompt_template": 'Classify the sentiment of the following text as exactly one of: positive, negative, neutral\n\nRespond with ONLY the sentiment label, nothing else.\n\nText: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "cases": [
            {"input": "This product exceeded all my expectations. Best purchase I've made this year!", "expected": "positive"},
            {"input": "Terrible customer service. Waited 3 hours on hold and nobody could help me.", "expected": "negative"},
            {"input": "The package arrived on Tuesday as scheduled.", "expected": "neutral"},
            {"input": "I absolutely love the new design, it's so much better than the old version.", "expected": "positive"},
            {"input": "The food was okay, nothing special but not bad either. Standard fare.", "expected": "neutral"},
            {"input": "DO NOT BUY THIS. Broke after 2 days. Complete waste of money.", "expected": "negative"},
            {"input": "I've been using this software for about 6 months now. It does what it says.", "expected": "neutral"},
            {"input": "Honestly the worst hotel experience of my life. Dirty rooms, rude staff, and they overcharged my card.", "expected": "negative"},
            {"input": "Just got my results back and I passed! So grateful for this study program.", "expected": "positive"},
            {"input": "The meeting has been rescheduled to 3 PM on Friday.", "expected": "neutral"},
        ]
    },
    "entity_extraction": {
        "system": "",
        "prompt_template": 'Extract all named entities from the following text. Return them as a JSON object with keys: "persons", "organizations", "locations". Each value should be a list of strings. Return ONLY the JSON, no explanation.\n\nText: "{input}"',
        "eval_type": "llm_judge",
        "max_output_tokens": 400,
        "judge_prompt": "Rate this entity extraction on a 1-5 scale. 5=all entities correctly identified and categorized. 4=most entities correct with 1 minor miss. 3=major entities found but several missed or miscategorized. 2=many errors. 1=wrong format or mostly wrong. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "Elon Musk announced that Tesla will open a new Gigafactory in Austin, Texas, creating over 10,000 jobs. The announcement was made at a press conference at the Texas State Capitol."},
            {"input": "Dr. Sarah Chen from MIT presented her research at the NeurIPS conference in Vancouver. Her paper, co-authored with researchers from Google DeepMind and Stanford University, received the best paper award."},
            {"input": "The United Nations Security Council met in New York to discuss the humanitarian crisis. Representatives from France, the United Kingdom, and China expressed concern over the situation in eastern Congo."},
            {"input": "Apple CEO Tim Cook visited the company's manufacturing partner Foxconn in Shenzhen, China. He later met with officials from the Chinese Ministry of Commerce in Beijing."},
            {"input": "Former President Barack Obama and Michelle Obama attended the opening of the Obama Presidential Center on the South Side of Chicago. Mayor Brandon Johnson and Illinois Governor JB Pritzker were also present."},
        ]
    },
    "translation": {
        "system": "",
        "prompt_template": "Translate the following English text to French. Maintain the tone and technical accuracy.\n\nEnglish: {input}\n\nFrench:",
        "eval_type": "llm_judge",
        "max_output_tokens": 500,
        "judge_prompt": "Rate this English-to-French translation on a 1-5 scale. 5=perfect translation with natural French and correct technical terms. 4=good translation with minor phrasing issues. 3=understandable but awkward or with errors. 2=significant errors that change meaning. 1=wrong language or incomprehensible. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "The API rate limit has been exceeded. Please wait 60 seconds before retrying your request. If this persists, consider upgrading to our enterprise plan which offers 10x higher throughput."},
            {"input": "Our quarterly revenue increased by 23% year-over-year, driven primarily by strong adoption of our cloud platform in the European market. Operating margins improved to 18.5%, up from 15.2% in the prior quarter."},
            {"input": "To deploy the application, first ensure Docker is installed and running. Then execute 'docker compose up -d' from the project root. The service will be available on port 8080 after initialization completes."},
            {"input": "We regret to inform you that your flight BA287 from London Heathrow to San Francisco has been delayed by approximately 3 hours due to adverse weather conditions. A complimentary meal voucher has been added to your booking."},
            {"input": "The machine learning pipeline consists of three stages: data preprocessing with feature normalization, model training using gradient boosted trees, and inference serving via a REST endpoint with sub-100ms latency."},
        ]
    },
    "function_calling": {
        "system": "",
        "prompt_template": 'Given the following available functions, generate the correct function call for the user request. Return ONLY valid JSON in this format: {{"name": "function_name", "arguments": {{...}}}}\n\nAvailable functions:\n{functions}\n\nUser request: {input}',
        "eval_type": "llm_judge",
        "max_output_tokens": 300,
        "judge_prompt": "Rate this function call on a 1-5 scale. 5=correct function with all arguments correct. 4=correct function with minor argument issues. 3=correct function but wrong arguments. 2=wrong function chosen. 1=not valid JSON or completely wrong. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "Send an email to john@example.com with the subject 'Meeting Tomorrow' and body 'Hi John, can we meet at 2pm?'", "functions": "send_email(to: string, subject: string, body: string)\nschedule_meeting(title: string, time: string, attendees: list[string])\nget_calendar(date: string)"},
            {"input": "What's the weather like in Paris right now?", "functions": "get_weather(city: string, units: 'celsius'|'fahrenheit' = 'celsius')\nsearch_flights(from: string, to: string, date: string)\nget_time(timezone: string)"},
            {"input": "Find all Python files modified in the last 7 days in the /src directory", "functions": "search_files(directory: string, pattern: string, modified_within_days: int = None)\nread_file(path: string)\nwrite_file(path: string, content: string)"},
            {"input": "Create a new task called 'Review PR #42' with high priority, assigned to alice, due next Friday", "functions": "create_task(title: string, priority: 'low'|'medium'|'high', assignee: string, due_date: string)\nlist_tasks(assignee: string = None, status: string = None)\nupdate_task(task_id: int, status: string)"},
            {"input": "Resize the image at /uploads/photo.jpg to 800x600 and convert to PNG format", "functions": "resize_image(path: string, width: int, height: int)\nconvert_format(path: string, target_format: string)\ncompress_image(path: string, quality: int)"},
        ]
    },
    "content_moderation": {
        "system": "",
        "prompt_template": 'Classify whether the following content should be flagged for moderation. Respond with ONLY one of: safe, harassment, hate_speech, violence, sexual, spam, self_harm\n\nContent: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "cases": [
            {"input": "I really enjoyed the new restaurant downtown. Great pasta and friendly staff!", "expected": "safe"},
            {"input": "You're such a worthless idiot. Nobody likes you and everyone wishes you would just disappear.", "expected": "harassment"},
            {"input": "The quarterly earnings report shows a 15% increase in revenue compared to last year.", "expected": "safe"},
            {"input": "CLICK HERE NOW!!! You've won $1,000,000!!! Claim your prize by entering your credit card at bit.ly/totallylegit", "expected": "spam"},
            {"input": "Can you recommend a good book about machine learning for beginners?", "expected": "safe"},
            {"input": "I just adopted the cutest puppy from the shelter. She's a golden retriever mix and she loves belly rubs!", "expected": "safe"},
            {"input": "Check out my new blog post about sustainable gardening techniques for small spaces.", "expected": "safe"},
            {"input": "The documentary about climate change was really eye-opening. I'd recommend it to anyone interested in environmental science.", "expected": "safe"},
        ]
    },
    "json_transform": {
        "system": "",
        "prompt_template": "Transform the following JSON from the input format to the output format as specified.\nReturn ONLY the transformed JSON, no explanation.\n\nInput JSON:\n{input}\n\nTarget format: {target}",
        "eval_type": "llm_judge",
        "max_output_tokens": 500,
        "judge_prompt": "Rate this JSON transformation on a 1-5 scale. 5=valid JSON matching target format with all data correctly mapped. 4=valid JSON with minor data mapping issues. 3=valid JSON but significant mapping errors. 2=invalid JSON or mostly wrong. 1=not JSON or completely wrong. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": '{"first_name": "Jane", "last_name": "Doe", "age": 32, "email": "jane.doe@email.com", "phone": "+1-555-0123"}', "target": '{"full_name": string, "contact": {"email": string, "phone": string}, "metadata": {"age": number}}'},
            {"input": '[{"date": "2024-01-15", "amount": 120.50, "category": "food"}, {"date": "2024-01-15", "amount": 45.00, "category": "transport"}, {"date": "2024-01-16", "amount": 200.00, "category": "food"}, {"date": "2024-01-16", "amount": 30.00, "category": "transport"}]', "target": '{"by_date": {"YYYY-MM-DD": {"total": number, "categories": {"category": number}}}}'},
            {"input": '{"users": [{"id": 1, "name": "Alice", "role": "admin", "active": true}, {"id": 2, "name": "Bob", "role": "user", "active": false}, {"id": 3, "name": "Charlie", "role": "admin", "active": true}]}', "target": '{"admins": [string], "users": [string], "inactive_count": number}'},
            {"input": '{"product": "Widget Pro", "reviews": [{"stars": 5, "text": "Great!"}, {"stars": 3, "text": "OK"}, {"stars": 4, "text": "Good value"}, {"stars": 5, "text": "Love it"}, {"stars": 2, "text": "Meh"}]}', "target": '{"product": string, "avg_rating": number, "review_count": number, "rating_distribution": {"1": number, "2": number, "3": number, "4": number, "5": number}}'},
            {"input": '{"event": "signup", "timestamp": "2024-03-15T14:30:00Z", "user": {"id": "u_123", "name": "Pat Smith"}, "source": "google_ads", "device": "mobile"}', "target": '{"event_type": string, "date": "YYYY-MM-DD", "time": "HH:MM", "user_id": string, "attribution": {"source": string, "platform": string}}'},
        ]
    },
    "code_review": {
        "system": "",
        "prompt_template": "Review the following code change. Identify bugs, security issues, and suggest improvements. Be specific about line numbers and what's wrong.\n\n```\n{input}\n```",
        "eval_type": "llm_judge",
        "max_output_tokens": 800,
        "judge_prompt": "Rate this code review on a 1-5 scale. 5=identifies all major bugs and security issues with specific, actionable suggestions. 4=catches major issues with good suggestions. 3=catches some issues but misses important ones. 2=vague or mostly irrelevant feedback. 1=wrong or empty. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE username='{username}' AND password='{password}'\"\n    result = db.execute(query)\n    if result:\n        session['user'] = username\n        return redirect('/dashboard')\n    return 'Invalid credentials', 401"},
            {"input": "app.get('/api/users/:id', async (req, res) => {\n  const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);\n  res.json({ ...user.rows[0], password: user.rows[0].password });\n});"},
            {"input": "def transfer_money(from_account, to_account, amount):\n    from_balance = get_balance(from_account)\n    if from_balance >= amount:\n        set_balance(from_account, from_balance - amount)\n        set_balance(to_account, get_balance(to_account) + amount)\n    return True"},
            {"input": "async function processPayment(cardNumber, amount) {\n  console.log(`Processing payment: card=${cardNumber}, amount=${amount}`);\n  const response = await fetch('http://payment-api.internal/charge', {\n    method: 'POST',\n    body: JSON.stringify({ card: cardNumber, amount }),\n  });\n  return response.ok;\n}"},
            {"input": "def get_user_file(filename):\n    base_path = '/var/app/uploads/'\n    file_path = base_path + filename\n    with open(file_path, 'r') as f:\n        return f.read()"},
        ]
    },
    "test_generation": {
        "system": "",
        "prompt_template": "Write unit tests for the following function. Use pytest style. Cover happy path, edge cases, and error cases.\n\n```python\n{input}\n```",
        "eval_type": "llm_judge",
        "max_output_tokens": 1000,
        "judge_prompt": "Rate these unit tests on a 1-5 scale. 5=comprehensive tests covering happy path, edge cases, and errors with good assertions. 4=good coverage with minor gaps. 3=basic happy path tests only. 2=tests exist but are incomplete or incorrect. 1=not valid tests or empty. Respond with ONLY a number 1-5.",
        "cases": [
            {"input": "def calculate_discount(price: float, quantity: int, is_member: bool = False) -> float:\n    \"\"\"Calculate discounted price. 10% off for 5+ items, extra 5% for members.\"\"\"\n    if price < 0 or quantity < 0:\n        raise ValueError('Price and quantity must be non-negative')\n    discount = 0.0\n    if quantity >= 5:\n        discount += 0.10\n    if is_member:\n        discount += 0.05\n    return round(price * quantity * (1 - discount), 2)"},
            {"input": "def parse_email(email: str) -> dict:\n    \"\"\"Parse an email address into local part and domain. Returns None if invalid.\"\"\"\n    if not email or '@' not in email:\n        return None\n    parts = email.split('@')\n    if len(parts) != 2 or not parts[0] or not parts[1]:\n        return None\n    if '.' not in parts[1]:\n        return None\n    return {'local': parts[0], 'domain': parts[1]}"},
            {"input": "def paginate(items: list, page: int = 1, per_page: int = 10) -> dict:\n    \"\"\"Paginate a list of items.\"\"\"\n    if page < 1:\n        page = 1\n    if per_page < 1:\n        per_page = 10\n    total = len(items)\n    start = (page - 1) * per_page\n    end = start + per_page\n    return {\n        'items': items[start:end],\n        'page': page,\n        'per_page': per_page,\n        'total': total,\n        'pages': (total + per_page - 1) // per_page\n    }"},
            {"input": "import re\n\ndef slugify(text: str) -> str:\n    \"\"\"Convert text to URL-friendly slug.\"\"\"\n    text = text.lower().strip()\n    text = re.sub(r'[^\\w\\s-]', '', text)\n    text = re.sub(r'[\\s_]+', '-', text)\n    text = re.sub(r'-+', '-', text)\n    return text.strip('-')"},
            {"input": "from datetime import datetime, timedelta\n\ndef is_business_hours(dt: datetime = None) -> bool:\n    \"\"\"Check if given datetime is during business hours (Mon-Fri, 9am-5pm).\"\"\"\n    if dt is None:\n        dt = datetime.now()\n    if dt.weekday() >= 5:  # Saturday=5, Sunday=6\n        return False\n    return 9 <= dt.hour < 17"},
        ]
    },
}


import re

# Models that use internal thinking tokens (need higher max_tokens to produce visible output)
REASONING_MODELS = {"DeepSeek-R1", "o4-mini", "grok-4-20-reasoning", "gpt-5.1-chat",
                    "Kimi-K2.6", "gemini-2.5-pro", "MiniMax-M2.7"}


def strip_thinking(text):
    """Strip <think>...</think> tags from model output."""
    return re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL).strip()


def effective_max_tokens(model_name, requested):
    """Reasoning models need higher token budgets to account for thinking tokens."""
    if model_name in REASONING_MODELS:
        return max(requested, 2000)
    return requested


def call_openai(model, messages, max_tokens, max_tokens_param="max_tokens"):
    """Call OpenAI API directly."""
    import requests as req
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, max_tokens_param: max_tokens, "temperature": 0}
    try:
        resp = req.post(url, json=body, headers=headers, timeout=120)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def call_anthropic(model, messages, max_tokens):
    """Call Anthropic API directly."""
    import requests as req
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    try:
        resp = req.post(url, json=body, headers=headers, timeout=120)
        data = resp.json()
        # Normalize to OpenAI format
        content = data.get("content", [{}])[0].get("text", "")
        usage = data.get("usage", {})
        return {
            "choices": [{"message": {"content": content}}],
            "usage": {
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
            }
        }
    except Exception as e:
        return {"error": str(e)}


def call_azure(model, messages, max_tokens, max_tokens_param="max_tokens"):
    """Call Azure AI endpoint."""
    import requests as req
    endpoint = os.environ["AZURE_ENDPOINT"]
    url = f"{endpoint}chat/completions"
    headers = {
        "api-key": os.environ["AZURE_API_KEY"],
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, max_tokens_param: max_tokens}
    # Don't set temperature for reasoning models
    if model not in ("DeepSeek-R1", "o4-mini", "grok-4-20-reasoning", "gpt-5.1-chat"):
        body["temperature"] = 0
    try:
        resp = req.post(url, json=body, headers=headers, timeout=180)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def call_minimax(model, messages, max_tokens):
    """Call MiniMax API (OpenAI-compatible)."""
    import requests as req
    url = "https://api.minimaxi.chat/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ['MINIMAX_API_KEY']}",
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, "max_tokens": max(max_tokens, 500), "temperature": 0}
    try:
        resp = req.post(url, json=body, headers=headers, timeout=180)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def call_gemini(model, messages, max_tokens):
    """Call Gemini API via OpenAI-compatible endpoint."""
    import requests as req
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ['GEMINI_API_KEY']}",
        "Content-Type": "application/json",
    }
    # Gemini 2.5 Pro uses ~1000+ internal thinking tokens that count against
    # max_completion_tokens, so we need a high limit to avoid empty responses
    body = {"model": model, "messages": messages, "temperature": 0,
            "max_completion_tokens": 8192}
    try:
        resp = req.post(url, json=body, headers=headers, timeout=180)
        data = resp.json()
        # Gemini sometimes returns a list on error
        if isinstance(data, list):
            return {"error": data[0].get("error", {}).get("message", str(data))}
        return data
    except Exception as e:
        return {"error": str(e)}


def call_model(model_name, messages, max_tokens):
    """Route to the correct API."""
    config = MODELS[model_name]
    provider = config["provider"]
    mtp = config["max_tokens_param"]
    mt = effective_max_tokens(model_name, max_tokens)
    if provider == "openai":
        return call_openai(model_name, messages, mt, mtp)
    elif provider == "anthropic":
        return call_anthropic(model_name, messages, mt)
    elif provider == "azure":
        return call_azure(model_name, messages, mt, mtp)
    elif provider == "gemini":
        return call_gemini(model_name, messages, mt)
    elif provider == "minimax":
        return call_minimax(model_name, messages, mt)


def compute_cost(model_name, response):
    """Compute cost in USD from token usage."""
    config = MODELS[model_name]
    usage = response.get("usage", {})
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    cost = (input_tokens * config["input_price"] + output_tokens * config["output_price"]) / 1_000_000
    return cost, input_tokens, output_tokens


def judge_response(response_text, original_input, judge_prompt):
    """Use GPT-4o-mini as LLM judge. Returns score 1-5."""
    messages = [
        {"role": "system", "content": "You are an evaluation judge. " + judge_prompt},
        {"role": "user", "content": f"Input: {original_input[:500]}\n\nResponse to evaluate:\n{response_text[:1000]}"},
    ]
    result = call_openai("gpt-4o-mini", messages, 5)
    if "error" in result:
        return 0
    text = result.get("choices", [{}])[0].get("message", {}).get("content", "0")
    try:
        return int("".join(c for c in text if c.isdigit())[:1])
    except (ValueError, IndexError):
        return 0


def load_spend():
    """Load cumulative spend from tracker file."""
    if os.path.exists(SPEND_FILE):
        with open(SPEND_FILE) as f:
            return json.load(f)
    return {"total_usd": 0.0, "calls": 0}


def save_spend(spend):
    """Save cumulative spend to tracker file."""
    with open(SPEND_FILE, "w") as f:
        json.dump(spend, f)


def load_completed(results_file):
    """Load already-completed (task, model) pairs from existing CSV."""
    completed_pairs = set()
    if os.path.exists(results_file):
        with open(results_file, newline="") as f:
            reader = csv.DictReader(f)
            pair_counts = {}
            for row in reader:
                key = (row["task"], row["model"])
                pair_counts[key] = pair_counts.get(key, 0) + 1
            # A (task, model) pair is complete if it has rows for all cases
            for key, count in pair_counts.items():
                task_name = key[0]
                if task_name in TASKS and count >= len(TASKS[task_name]["cases"]):
                    completed_pairs.add(key)
    return completed_pairs


def main():
    os.chdir(Path(__file__).parent.parent)
    os.makedirs("results/raw", exist_ok=True)

    spend = load_spend()
    results = []
    results_file = "results/benchmark_results.csv"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Load already-completed pairs for resume support
    already_done = load_completed(results_file)

    # Create CSV with header only if file doesn't exist
    if not os.path.exists(results_file):
        with open(results_file, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "task", "case_idx", "model", "provider", "input_price_per_m",
                "output_price_per_m", "input_tokens", "output_tokens", "cost_usd",
                "score", "eval_type", "response_preview"
            ])

    total_calls = sum(len(t["cases"]) for t in TASKS.values()) * len(MODELS)
    skipped = len(already_done)
    completed = 0

    print(f"{'='*70}")
    print(f"TaskBench Full Benchmark")
    print(f"Models: {len(MODELS)} | Tasks: {len(TASKS)} | Total calls: {total_calls}")
    print(f"Budget limit: ${BUDGET_LIMIT_USD:.0f} | Current spend: ${spend['total_usd']:.4f}")
    if already_done:
        print(f"Resuming: {skipped} (task, model) pairs already complete — skipping them")
    print(f"{'='*70}\n")

    for task_name, task in TASKS.items():
        print(f"\n--- Task: {task_name} ({len(task['cases'])} cases) ---")

        for model_name, model_config in MODELS.items():
            # Skip already-completed pairs
            if (task_name, model_name) in already_done:
                print(f"  {model_name:<40} SKIP (already done)")
                continue

            # Budget check
            if spend["total_usd"] >= BUDGET_LIMIT_USD:
                print(f"\n*** BUDGET LIMIT REACHED: ${spend['total_usd']:.2f} ***")
                print("Stopping benchmark to stay within $250 cap.")
                _write_summary(results, spend)
                return

            model_scores = []
            model_cost = 0.0

            for case_idx, case in enumerate(task["cases"]):
                # Build prompt
                prompt = task["prompt_template"].format(**case)
                messages = [{"role": "user", "content": prompt}]
                if task.get("system"):
                    messages.insert(0, {"role": "system", "content": task["system"]})

                # Call model
                try:
                    response = call_model(model_name, messages, task["max_output_tokens"])
                except Exception as e:
                    print(f"  ERROR {model_name} case {case_idx}: {e}")
                    continue

                if "error" in response:
                    err_msg = str(response['error'])[:80] if isinstance(response['error'], str) else str(response['error'].get('message', response['error']))[:80]
                    print(f"  ERROR {model_name} case {case_idx}: {err_msg}")
                    continue

                # Extract response text
                choices = response.get("choices", [])
                if not choices:
                    continue
                response_text = choices[0].get("message", {}).get("content", "") or ""
                # Strip <think>...</think> tags from reasoning models
                response_text = strip_thinking(response_text)

                # Compute cost
                cost, in_tok, out_tok = compute_cost(model_name, response)
                spend["total_usd"] += cost
                spend["calls"] += 1
                model_cost += cost

                # Evaluate
                if task["eval_type"] == "exact":
                    expected = case.get("expected", "")
                    # Check if expected label appears in the response (case-insensitive)
                    clean = response_text.lower().strip()
                    score = 5 if expected.lower() in clean else 0
                elif task["eval_type"] == "llm_judge":
                    score = judge_response(response_text, prompt, task["judge_prompt"])
                    # Judge cost (GPT-4o-mini, very cheap)
                    spend["total_usd"] += 0.0001  # ~$0.0001 per judge call
                else:
                    score = 0

                model_scores.append(score)

                # Save to CSV
                with open(results_file, "a", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        timestamp, task_name, case_idx, model_name, model_config["provider"],
                        model_config["input_price"], model_config["output_price"],
                        in_tok, out_tok, f"{cost:.6f}",
                        score, task["eval_type"], response_text[:100].replace("\n", " ")
                    ])

                # Save raw response
                raw_file = f"results/raw/{task_name}_{model_name}_{case_idx}.json"
                with open(raw_file, "w") as f:
                    json.dump({"model": model_name, "task": task_name, "case": case_idx,
                               "response": response_text, "score": score, "cost": cost,
                               "tokens": {"input": in_tok, "output": out_tok}}, f, indent=2)

                completed += 1
                save_spend(spend)

            # Print model summary for this task
            if model_scores:
                avg = sum(model_scores) / len(model_scores)
                status = "PASS" if avg >= 4 else "MIXED" if avg >= 2.5 else "FAIL"
                print(f"  {model_name:<40} avg={avg:.1f}/5  cost=${model_cost:.4f}  [{status}]  ({completed}/{total_calls})")
            else:
                print(f"  {model_name:<40} NO RESULTS")

            # Small delay to avoid rate limits
            time.sleep(0.5)

    _write_summary(results, spend)


def _write_summary(results, spend):
    """Print and save summary."""
    print(f"\n{'='*70}")
    print(f"BENCHMARK COMPLETE")
    print(f"Total spend: ${spend['total_usd']:.4f}")
    print(f"Total API calls: {spend['calls']}")
    print(f"{'='*70}")
    print(f"\nResults saved to: results/benchmark_results.csv")
    print(f"Raw responses saved to: results/raw/")
    print(f"\nAnalyze with: python scripts/analyze_costs.py results/")
    save_spend(spend)


if __name__ == "__main__":
    main()
