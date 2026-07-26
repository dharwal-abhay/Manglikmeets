"""A small local server for the Manglik Meets static site and chat assistant."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

def reply_for(message: str) -> str:
    """Return a concise, helpful answer without storing user messages."""
    text = message.lower()
    if any(word in text for word in ("manglik", "astrology", "preference", "kundli")):
        return (
            "Manglik Meets is designed so you can share astrological or family "
            "preferences only when you choose. Start with values and interests, "
            "then take every conversation at your own pace."
        )
    if any(word in text for word in ("privacy", "safe", "data", "secure")):
        return (
            "Your contact details are never displayed publicly. You control what "
            "appears on your profile and can manage conversations at any time."
        )
    if any(word in text for word in ("join", "register", "sign up", "signup")):
        return (
            "Select Register at the top of the page, add your details, and then "
            "complete a profile that reflects your values and interests."
        )
    if any(word in text for word in ("profile", "photo", "bio")):
        return (
            "A strong profile is warm, honest, and specific. Share a little about "
            "what you enjoy, what matters to you, and the kind of connection you seek."
        )
    if any(word in text for word in ("password", "login", "log in", "account")):
        return "Use Log In at the top of the page. If you cannot access your account, select Forgot password? to request a reset link."
    if any(word in text for word in ("match", "member", "connect")):
        return "Browse the Members section to see community profiles, then start a respectful conversation when someone feels like a good fit."
    return "I can help with joining, profiles, privacy, password resets, and getting to know Manglik Meets. What would you like to explore?"


class ManglikMeetsHandler(SimpleHTTPRequestHandler):
    """Serve the static website plus one small JSON chat endpoint."""

    def do_POST(self) -> None:  # noqa: N802 - required by http.server
        if self.path != "/api/chat":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            message = str(payload.get("message", ""))[:1000]
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid chat message")
            return

        body = json.dumps({"reply": reply_for(message)}).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    site_dir = Path(__file__).resolve().parent
    # Make the page and API available from the same local origin.
    handler = lambda *args, **kwargs: ManglikMeetsHandler(*args, directory=str(site_dir), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 8000), handler)
    print("Manglik Meets is running at http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
