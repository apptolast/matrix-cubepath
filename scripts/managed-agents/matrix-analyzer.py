#!/usr/bin/env python3
"""
Matrix Config Analyzer — Managed Agent Client

Creates a session with the Matrix Config Analyzer agent and streams
its analysis of the monitoring dashboard codebase.

Usage:
    python3 matrix-analyzer.py [--prompt "custom analysis prompt"]

Environment:
    ANTHROPIC_API_KEY — required, your Anthropic API key

Resources:
    Agent:       agent_011CZspnTK1CsaBJzEm7Ghba  (Matrix Config Analyzer)
    Environment: env_019nYjr7qpfsCGFQu9pBfAow     (matrix-cubepath-env)
"""

import os
import sys
import json
import urllib.request
import urllib.error

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
BASE_URL = "https://api.anthropic.com/v1"
AGENT_ID = "agent_011CZspnTK1CsaBJzEm7Ghba"
ENV_ID = "env_019nYjr7qpfsCGFQu9pBfAow"

HEADERS = {
    "x-api-key": API_KEY,
    "anthropic-beta": "managed-agents-2026-04-01",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
}

STREAM_HEADERS = {
    "x-api-key": API_KEY,
    "anthropic-beta": "managed-agents-2026-04-01",
    "anthropic-version": "2023-06-01",
    "Accept": "text/event-stream",
}

DEFAULT_PROMPT = """Clone the repository https://github.com/apptolast/matrix-cubepath (branch: apptolast) and analyze ALL health check configurations.

1. First, clone: git clone -b apptolast https://github.com/apptolast/matrix-cubepath
2. Read all files in src/backend/services/collectors/
3. Read src/backend/services/monitoring-manager.ts
4. Read src/backend/services/k8s-client.ts

For each collector, identify:
- Services being monitored and their configured endpoints
- Potential misconfigurations (wrong ports, namespaces, protocols)
- Health check methods used (HTTP, TCP, Prometheus)
- TLS/certificate handling issues

Generate a comprehensive audit report with findings and recommended fixes."""


def api_request(method: str, path: str, data: dict | None = None) -> dict:
    """Make an API request to the Anthropic Managed Agents API."""
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"API Error ({e.code}): {error_body}", file=sys.stderr)
        sys.exit(1)


def create_session(title: str = "Matrix Config Analysis") -> str:
    """Create a new agent session and return the session ID."""
    result = api_request("POST", "/sessions", {
        "agent": AGENT_ID,
        "environment_id": ENV_ID,
        "title": title,
    })
    session_id = result["id"]
    print(f"Session created: {session_id}")
    print(f"Status: {result['status']}")
    return session_id


def send_message(session_id: str, text: str) -> None:
    """Send a user message to the session."""
    api_request("POST", f"/sessions/{session_id}/events", {
        "events": [{
            "type": "user.message",
            "content": [{"type": "text", "text": text}],
        }],
    })
    print(f"Message sent to session {session_id}")


def stream_events(session_id: str) -> None:
    """Stream and display agent events from the session (SSE)."""
    url = f"{BASE_URL}/sessions/{session_id}/stream"
    req = urllib.request.Request(url, headers=STREAM_HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            buffer = ""
            for line_bytes in resp:
                line = line_bytes.decode("utf-8", errors="replace")
                buffer += line
                if line.strip() == "":
                    # Process complete SSE event
                    process_sse_block(buffer)
                    buffer = ""
    except KeyboardInterrupt:
        print("\n\nStream interrupted by user.")
    except urllib.error.HTTPError as e:
        print(f"Stream error ({e.code}): {e.read().decode()}", file=sys.stderr)


def process_sse_block(block: str) -> None:
    """Parse and display an SSE event block."""
    data_line = ""
    for line in block.strip().split("\n"):
        if line.startswith("data: "):
            data_line = line[6:]

    if not data_line:
        return

    try:
        event = json.loads(data_line)
    except json.JSONDecodeError:
        return

    event_type = event.get("type", "")

    if event_type == "agent.message":
        content = event.get("content", [])
        for block in content:
            if block.get("type") == "text":
                print(block["text"], end="", flush=True)

    elif event_type == "agent_tool_use":
        tool = event.get("tool_name", "")
        inp = event.get("input", {})
        if tool == "bash":
            print(f"\n> bash: {inp.get('command', '')[:100]}")
        elif tool == "read":
            print(f"\n> read: {inp.get('file_path', '')}")
        elif tool == "grep":
            print(f"\n> grep: {inp.get('pattern', '')}")

    elif event_type == "agent_tool_result":
        pass  # Tool results can be verbose, skip display

    elif event_type in ("session.status_idle", "session.status_terminated"):
        status = event_type.split(".")[-1]
        print(f"\n\n--- Session {status} ---")


def get_session_status(session_id: str) -> dict:
    """Get the current session status."""
    return api_request("GET", f"/sessions/{session_id}")


def main():
    if not API_KEY:
        print("Error: ANTHROPIC_API_KEY environment variable not set", file=sys.stderr)
        print("Usage: ANTHROPIC_API_KEY=sk-ant-... python3 matrix-analyzer.py", file=sys.stderr)
        sys.exit(1)

    prompt = DEFAULT_PROMPT
    if len(sys.argv) > 2 and sys.argv[1] == "--prompt":
        prompt = sys.argv[2]

    print("=== Matrix Config Analyzer ===")
    print(f"Agent: {AGENT_ID}")
    print(f"Environment: {ENV_ID}")
    print()

    session_id = create_session()
    print()

    print("Sending analysis request...")
    send_message(session_id, prompt)
    print()

    print("Streaming agent output:")
    print("=" * 60)
    stream_events(session_id)
    print()

    status = get_session_status(session_id)
    print(f"\nSession {session_id}:")
    print(f"  Status: {status['status']}")
    print(f"  Tokens: {status['usage']['input_tokens']} in / {status['usage']['output_tokens']} out")
    print(f"  Duration: {status['stats']['duration_seconds']}s active, {status['stats']['active_seconds']}s running")


if __name__ == "__main__":
    main()
