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
⚙️ Installation & Local SetupClone the Repository:Bashgit clone [https://github.com/YOUR_USERNAME/PhishShield.git](https://github.com/YOUR_USERNAME/PhishShield.git)
cd PhishShield
Create & Activate Virtual Environment:Bashpython -m venv venv
# On Windows:
.\venv\Scripts\Activate
# On macOS/Linux:
source venv/bin/activate
Install Dependencies:Bashpip install -r requirements.txt
Run the Backend Server:Bashpython backend/main.py
Access the local dashboard at: http://localhost:8000/dashboard  Load the Chrome Extension:Open Chrome and navigate to chrome://extensions/.Enable Developer mode (top right).Click Load unpacked and select your extension/ folder.📜 LicenseDistributed under the MIT License. See LICENSE for more information.
