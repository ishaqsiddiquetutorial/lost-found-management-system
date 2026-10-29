
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from email.parser import BytesParser
from email.policy import default
from urllib.parse import urlparse
from pathlib import Path
import json
import mimetypes
import os
import re
import uuid
import threading
import html

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
UPLOAD_DIR = BASE_DIR / "uploads"

HOST = "127.0.0.1"
PORT = 8080
MAX_REQUEST = 8 * 1024 * 1024
MAX_PHOTO = 5 * 1024 * 1024

UPLOAD_DIR.mkdir(exist_ok=True)
DATA_LOCK = threading.Lock()

CATEGORIES = {
    "Electronics", "Bags", "Keys", "Documents",
    "Clothing", "Accessories", "Pets", "Other"
}


def load_items():
    if not DATA_FILE.exists():
        return []

    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        print("Warning: data.json could not be read.")
        return []


items = load_items()
next_id = max((int(i.get("id", 0)) for i in items), default=0) + 1


def save_items():
    temporary = DATA_FILE.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    os.replace(temporary, DATA_FILE)


def clean(value, limit=500):
    return str(value).strip()[:limit]


def get_item(item_id):
    return next((item for item in items if item["id"] == item_id), None)


class FindItHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid request size")

        if length <= 0 or length > MAX_REQUEST:
            raise ValueError("Request must be between 1 byte and 8 MB")

        return self.rfile.read(length)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/items":
            with DATA_LOCK:
                self.send_json(items)
            return

        if path.startswith("/api/"):
            self.send_json({"error": "API endpoint not found"}, 404)
            return

        super().do_GET()

    def parse_form(self, body):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            raise ValueError("Please submit the form using multipart/form-data")

        envelope = (
            b"Content-Type: " + content_type.encode("ascii") +
            b"\r\nMIME-Version: 1.0\r\n\r\n" + body
        )
        message = BytesParser(policy=default).parsebytes(envelope)

        if not message.is_multipart():
            raise ValueError("Invalid form data")

        fields = {}
        photo = None

        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue

            payload = part.get_payload(decode=True) or b""
            filename = part.get_filename()

            if filename:
                if name != "photo" or not payload:
                    continue

                if len(payload) > MAX_PHOTO:
                    raise ValueError("Photo must be 5 MB or smaller")

                content_type = part.get_content_type()
                allowed = {
                    "image/jpeg": ".jpg",
                    "image/png": ".png",
                    "image/webp": ".webp",
                    "image/gif": ".gif"
                }

                if content_type not in allowed:
                    raise ValueError("Use a JPG, PNG, WEBP or GIF photo")

                photo = (payload, allowed[content_type])
            else:
                fields[name] = payload.decode("utf-8", errors="replace").strip()

        return fields, photo

    def do_POST(self):
        global next_id

        path = urlparse(self.path).path

        if path == "/api/items":
            try:
                body = self.read_body()
                fields, photo = self.parse_form(body)
            except (ValueError, OSError) as error:
                self.send_json({"error": str(error)}, 400)
                return

            required = ["name", "type", "category", "location", "description", "date"]

            if any(not fields.get(key) for key in required):
                self.send_json({"error": "Please fill in all required fields"}, 400)
                return

            if fields["type"] not in ("Lost", "Found"):
                self.send_json({"error": "Choose Lost or Found"}, 400)
                return

            if fields["category"] not in CATEGORIES:
                self.send_json({"error": "Choose a valid category"}, 400)
                return

            if len(fields["name"]) > 100 or len(fields["location"]) > 150:
                self.send_json({"error": "Name or location is too long"}, 400)
                return

            if len(fields["description"]) > 1000:
                self.send_json({"error": "Description is too long"}, 400)
                return

            photo_url = ""

            with DATA_LOCK:
                if photo:
                    payload, extension = photo
                    filename = f"{uuid.uuid4().hex}{extension}"
                    (UPLOAD_DIR / filename).write_bytes(payload)
                    photo_url = f"/uploads/{filename}"

                item = {
                    "id": next_id,
                    "name": clean(fields["name"], 100),
                    "type": fields["type"],
                    "category": fields["category"],
                    "location": clean(fields["location"], 150),
                    "description": clean(fields["description"], 1000),
                    "date": fields["date"],
                    "photo": photo_url,
                    "status": "Available",
                    "created": __import__("datetime").datetime.now().isoformat(timespec="seconds")
                }

                items.append(item)
                next_id += 1
                save_items()

            self.send_json(item, 201)
            return

        match = re.fullmatch(r"/api/items/(\d+)/(claim|approve|reject|return)", path)

        if not match:
            self.send_json({"error": "API endpoint not found"}, 404)
            return

        item_id = int(match.group(1))
        action = match.group(2)

        with DATA_LOCK:
            item = get_item(item_id)

            if item is None:
                self.send_json({"error": "Item not found"}, 404)
                return

            current = item["status"]

            if action == "claim" and current == "Available":
                item["status"] = "Claim requested"

            elif action == "approve" and current == "Claim requested":
                item["status"] = "Claim approved"

            elif action == "reject" and current == "Claim requested":
                item["status"] = "Available"

            elif action == "return" and current in (
                "Available", "Claim requested", "Claim approved"
            ):
                item["status"] = "Returned"

            else:
                self.send_json(
                    {"error": f"Cannot perform {action} while status is {current}"},
                    400
                )
                return

            save_items()
            self.send_json(item)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[FindIt] {args[0]}")


if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer((HOST, PORT), FindItHandler)
    except OSError as error:
        print(f"Could not start server: {error}")
        print("Change PORT to 8081 if port 8080 is unavailable.")
        raise SystemExit(1)

    print("=" * 45)
    print(" FindIt Lost & Found is running!")
    print(f" http://{HOST}:{PORT}")
    print(" Data: data.json")
    print(" Photos: uploads/")
    print(" Press Ctrl+C to stop.")
    print("=" * 45)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFindIt stopped.")
    finally:
        server.server_close()