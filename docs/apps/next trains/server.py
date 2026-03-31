from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent
SEPTA_BASE_URL = "http://www3.septa.org/hackathon/NextToArrive/"


class SeptaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/next-trains":
            self.handle_next_trains_api(parsed.query)
            return

        super().do_GET()

    def handle_next_trains_api(self, query: str) -> None:
        params = parse_qs(query)
        origin = params.get("origin", [""])[0].strip()
        destination = params.get("destination", [""])[0].strip()

        if not origin or not destination:
            self.send_api_error(HTTPStatus.BAD_REQUEST, "Missing origin or destination.")
            return

        septa_url = f"{SEPTA_BASE_URL}?{urlencode({'req1': origin, 'req2': destination, 'req3': '3'})}"
        request = Request(
            septa_url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=10) as response:
                payload = response.read()
        except Exception as exc:
            self.send_api_error(
                HTTPStatus.BAD_GATEWAY,
                f"Could not reach the SEPTA API from the local proxy: {exc}",
            )
            return

        try:
            trains = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_api_error(
                HTTPStatus.BAD_GATEWAY,
                "SEPTA returned an unreadable response.",
            )
            return

        body = json.dumps(trains).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_api_error(self, status: HTTPStatus, message: str) -> None:
        body = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), SeptaHandler)
    print("Serving SEPTA Next Trains on http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
