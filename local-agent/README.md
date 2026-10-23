# Tarabil ASYCUDA Agent 4.0 — safe navigation candidate

This is a tested code candidate, NOT a certified production release. Live JAB navigation and restart/phone acceptance remain unverified.

## Architecture
The existing 64-bit agent polls the same Vercel/Upstash queue. It uses a persistent 32-bit `.venv32\Scripts\python.exe jab_helper.py` process via inherited JSON stdin/stdout pipes. No helper network port exists. `navigation.py` is the pure state/action policy. The helper uses PyJAB 1.12.0 directly, never its inspector CLI and never `JABDriver.__exit__` (which kills Java).

## Safety
- `run_navigation_test()` is separate from `create_unified_procedure()`.
- Real creation is deliberately disabled in the agent and website API until explicitly authorized and implemented with verified selectors.
- Only exact allowlisted navigation names are actionable. Unknown dialogs and ambiguous controls stop execution. No calibrated-coordinate fallback remains.
- The unread-mail question is dismissed only through a unique enabled No button inside that exact known alert.
- Save/discard dialogs require manual intervention. No document-closing actions exist.
- Readiness requires an active unified internal frame, a company label and an enabled field; a navigator label is insufficient. This fingerprint still needs validation against the live Iraqi client.
- Screenshots remain local and are cropped to the ASYCUDA window. They are not uploaded or sent to WhatsApp during tests.
- Credentials are read locally from Windows Credential Manager. They never go to Vercel or logs. The helper receives login credentials only over inherited pipes and does not return field contents.
- Login selectors and Java warning identity checks intentionally fail closed when unrecognized.

## Install / operation
Preserve `config.json`, `.venv`, `.venv32` and Windows credentials.
`update-agent.bat` installs separately pinned 64-bit and 32-bit requirements and runs tests. It does not force-stop an active job.
`install-autostart.bat` registers an interactive, limited-permission Task Scheduler task at Windows login. After successful registration it removes the old HKCU startup entry. The task runs `watchdog.py` with pythonw, hidden. This installer could not be executed successfully in the restricted Codex session; run it from the authorized Windows account.
`start-agent.bat` runs the foreground agent. `run-agent-hidden.vbs` starts the watchdog. A named mutex prevents duplicate watchdogs; the agent retains its existing localhost instance lock.
The watchdog restarts crashes with bounded backoff and rotates 5 MB logs. Place a file named `STOP_AGENT` in this directory to stop gracefully between jobs; remove it before starting again. No restart script force-kills ASYCUDA.
`diagnostics.bat` reports versions, local credential availability (boolean/access denied only), Java/JAB state, and API health. It does not claim jobs or mark an absent agent online.
`test-smart-navigation.bat` runs a local navigation-only test. Do not run alongside a cloud test.

## Queue / reliability
Deploy the updated Nuxt API before relying on `/api/agent/heartbeat` or `/api/agent/health`. Older SPA deployments may return HTML 200 for an unknown route; that is NOT a healthy API.
Heartbeat runs independently of UI work. Completion is written to `pending-result.json` before transmission; retries send the result without repeating UI actions. Queue claims are atomic Redis Lua operations. A lost claim response or crash before completion can leave a processing job for manual review; it is intentionally not replayed automatically. This is not exactly-once execution.
Test jobs accept legacy `test` and new `test_navigation`. Missing/unknown kinds never infer production execution. Production and completed jobs cannot be retried through the test retry endpoint.

## Tests
`.venv\Scripts\python.exe -X utf8 -m unittest -v test_navigation`
13 safety tests cover popup scoping, unsaved data, readiness, ambiguous controls, unknown jobs and disabled production.
Website: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`.
The 7 website contract tests use mocked Redis HTTP responses; they do not prove real Upstash Lua behavior or desktop E2E.

## Known acceptance gaps (2026-10-23)
- Codex could detect an ASYCUDA window but JAB attachment failed in its restricted execution session. No successful live tree or navigation screenshot was obtained.
- Windows Credential Manager returned Access denied; authenticated agent-to-cloud testing was unavailable.
- Task Scheduler registration failed with CIM access unavailable. Login/reboot startup remains unverified.
- Website changes are local, not deployed. Phone Online/test-button E2E remains unverified.
- Existing app roles are client-controlled; they are NOT server-enforced admin authentication. Technical details are kept local instead of adding an insecure admin-only expander.
- No popup body or screenshot upload endpoint is provided. Local diagnostics/screenshot review is required.
- Declaration/login/navigation selectors must be confirmed from an actual live accessibility tree; no claim of 100% reliability is made.

## Backup / rollback
Original top-level agent files: `C:\asycuda-office-1\backups\20261023-213613`.
Original website source: `C:\Users\cdste\Documents\Codex\2026-10-23\files-pasted-by-the-user-c\work\site-backup-20261023-213613`.
Use `rollback.py BACKUP_DIRECTORY` only after stopping the agent between jobs. It refuses when the instance port is occupied, restores original top-level files and preserves current config.json and both virtual environments. Newly added modules remain unused by the restored old agent. Review safety of the old implementation before restarting it.
Legacy calibration files are archived under `legacy-calibration`; they are not imported by the agent.
