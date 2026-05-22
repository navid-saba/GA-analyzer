import os
import json
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv('backend/.env')
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

def test_parsing(filepath):
    try:
        df = pd.read_csv(filepath, comment='#')
        csv_data = df.to_csv(index=False)
        
        prompt = """
        Analyze the following data and return a single JSON object with these exact keys:
        - "summary_table": array of { "metric", "value", "change" }
        - "questions_and_answers": array of { "question", "answer" }
        - "exec_summary": array of 5 objects { "area", "key_finding", "implication" }
        - "podcast_script": string
        
        Data:
        """ + csv_data

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        text = response.text
        
        print("====== RAW OUTPUT FROM GEMINI ======")
        print(text)
        print("====================================")
        
        try:
            result = json.loads(text.strip())
            print("Successfully parsed JSON!")
            print("Keys:", result.keys())
        except Exception as json_e:
            print("JSON Parsing Error:", repr(json_e))

    except Exception as e:
        print("Error during test API call:", repr(e))

if __name__ == '__main__':
    test_parsing('sample-data.csv')
