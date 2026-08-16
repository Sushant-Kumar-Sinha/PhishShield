# 🛡️ PhishShield — Unified Phishing Detection System

PhishShield is an AI-powered, dual-engine phishing detection platform designed to protect users in real-time across both **Emails** and **Websites**. It combines state-of-the-art transformer models (Hugging Face BERT classifiers) with a Chrome Extension (Manifest V3) and an interactive threat intelligence web dashboard.

---

## 🚀 Key Features

* **Dual-Engine Threat Analysis:**
  * **Email Phishing Engine:** Uses fine-tuned BERT sequence classification (`RamzyBakir/jellyphish-bert-base-mail`) to detect malicious email intent[cite: 11].
  * **Website URL Engine:** Uses URLBERT (`CrabInHoney/urlbert-tiny-v4-phishing-classifier`) combined with DOM heuristic fallback to flag credential-harvesting pages[cite: 12].
* **Autonomous Decision Agent:** Synthesizes model confidence scores and structural heuristics into a structured **4-tier risk classification** (`Safe`, `Low Risk`, `Medium Risk`, `High Risk`)[cite: 9].
* **Chrome Extension (Manifest V3):** Real-time interception, tab monitoring, and live webmail/DOM inspection for Gmail and Outlook[cite: 13, 16].
* **Interactive Threat Dashboard:** Local command console (`http://localhost:8000/dashboard`) featuring real-time scan history, threat breakdown metrics, and manual URL testing[cite: 10, 18].

---

## 🛠️ Project Architecture

```text
phishshield/
├── backend/
│   ├── main.py             # FastAPI Unified REST API & Static Server
│   ├── agent.py            # AI Decision & XAI Calibration Agent
│   ├── rag_engine.py       # BERT Email Sequence Classification Engine
│   └── website_scanner.py  # URLBERT Website Scanner + Heuristic Fallback
├── extension/
│   ├── manifest.json       # Chrome Extension Manifest V3 configuration
│   ├── popup.html / js     # Extension HUD & Gauge Renderer
│   ├── dashboard.html / js # Threat Intelligence Command Console
│   └── content.js          # DOM extraction script for Gmail & Outlook
├── requirements.txt        # Python package dependencies
└── README.md
```

⚙️ Installation & Setup Guide1.
Clone & Setup ProjectOpen your terminal and run the following commands to clone your repository, create your virtual environment, and install all required dependencies
:Bashgit clone [https://github.com/YOUR_USERNAME/PhishShield.git](https://github.com/YOUR_USERNAME/PhishShield.git)
cd PhishShield

python -m venv venv
# On Windows:
.\venv\Scripts\Activate
# On macOS/Linux:
source venv/bin/activate

1. pip install -r requirements.txt
2. Run the Backend ServerStart your FastAPI unified server locally:Bashpython backend/main.py
Access the local threat intelligence dashboard at: http://localhost:8000/dashboard  
3. Load the Chrome ExtensionOpen Google Chrome and navigate to chrome://extensions/.
4. Enable Developer mode using the toggle switch in the top-right corner.
5. Click the Load unpacked button in the top-left corner.
6. Select your project's extension/ folder.

📜 LicenseDistributed under the MIT License. See the LICENSE file for more details.
