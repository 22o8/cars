ASYCUDA Unified Procedure - fixed test button build

Fixed:
1. "للتجربة" is a separate safe job type.
2. Test job requires only mobile PIN; no company code or WhatsApp number.
3. Test path opens/focuses ASYCUDA, navigates to Unified Procedure, takes a screenshot, and stops.
4. Test path has no call to create_unified() and never clicks submit_button.
5. Windows charmap/Unicode console crash fixed using UTF-8 and ASCII-safe agent logs/file names.
6. Old failed test jobs with empty company code are recognized as legacy test jobs when retried.
7. Screenshot result is reported back to the website (file remains local on office PC).

Update steps:
- Deploy this project to Vercel.
- On office PC replace local-agent/agent.py and start-agent*.bat with these versions.
- Keep your existing local-agent/config.json and .venv if already configured.
- Restart agent using restart-agent.bat.
- In the website enter mobile PIN, then press "للتجربة".
