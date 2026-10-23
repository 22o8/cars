# Python 3.14 / Pillow fix

This build intentionally runs the Windows Local Agent inside an isolated Python 3.12 virtual environment.

1. Install Python 3.12 64-bit. You may keep Python 3.14 installed side-by-side.
2. Run `local-agent\install-agent.bat`.
3. Run `local-agent\calibrate-agent.bat` for calibration.
4. Run `local-agent\start-agent.bat` to start the agent.

The installer uses `py -3.12`, so the system default Python version does not matter.
