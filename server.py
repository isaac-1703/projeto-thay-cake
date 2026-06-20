import os
import json
import base64
import hmac
import hashlib
import time
import uuid
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Port to listen on
PORT = 8585

# Secret key for HS256 JWT signature verification
SECRET_KEY = b"thay_cake_super_secret_key_2026_988194690"

# Directories configuration
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
FEEDBACKS_FILE = os.path.join(DATA_DIR, "feedbacks.json")
CREATORS_FILE = os.path.join(DATA_DIR, "creators.json")

# Supabase configuration (loaded from environment variables)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip('/')
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

# Ensure required directories exist
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

if not os.path.exists(PRODUCTS_FILE):
    with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(FEEDBACKS_FILE):
    with open(FEEDBACKS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(CREATORS_FILE):
    with open(CREATORS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

# JWT helper functions
def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signature_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY, signature_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> dict or None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        signature_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY, signature_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            return None
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        # Check token expiration (24 hour validity)
        if "exp" in payload and payload["exp"] < time.time():
            return None
            
        return payload
    except Exception:
        return None

# Supabase API request helper functions
def supabase_api_request(endpoint, method="GET", payload=None):
    """
    Realiza requisições HTTP para a API REST do Supabase.
    """
    url = f"{SUPABASE_URL}{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    data = None
    if payload is not None:
        if isinstance(payload, bytes):
            data = payload
        else:
            data = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read()
            if res_body:
                return json.loads(res_body.decode('utf-8'))
            return []
    except urllib.error.HTTPError as e:
        err_content = e.read().decode('utf-8')
        try:
            err_json = json.loads(err_content)
            err_msg = err_json.get("message", err_content)
        except Exception:
            err_msg = err_content
        raise Exception(f"Supabase API Error [{e.code}]: {err_msg}")
    except Exception as e:
        raise Exception(f"Supabase Connection Error: {str(e)}")

def supabase_upload_image(base64_photo):
    """
    Faz o upload de uma imagem em Base64 para o Bucket 'uploads' do Supabase Storage.
    Retorna a URL pública final da imagem.
    """
    if "," in base64_photo:
        header, base64_str = base64_photo.split(",", 1)
        mime = "image/png"
        ext = ".png"
        if "image/jpeg" in header or "image/jpg" in header:
            mime = "image/jpeg"
            ext = ".jpg"
        elif "image/webp" in header:
            mime = "image/webp"
            ext = ".webp"
        elif "image/gif" in header:
            mime = "image/gif"
            ext = ".gif"
    else:
        base64_str = base64_photo
        mime = "image/png"
        ext = ".png"

    photo_bytes = base64.b64decode(base64_str)
    filename = f"uploads_{uuid.uuid4().hex}{ext}"
    
    url = f"{SUPABASE_URL}/storage/v1/object/uploads/{filename}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": mime
    }
    
    req = urllib.request.Request(url, data=photo_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            response.read()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        raise Exception(f"Erro no Supabase Storage [{e.code}]: {err_msg}")
    except Exception as e:
        raise Exception(f"Erro de conexão com Supabase Storage: {str(e)}")
        
    return f"{SUPABASE_URL}/storage/v1/object/public/uploads/{filename}"

def supabase_delete_image(public_url):
    """
    Remove uma imagem do Bucket 'uploads' do Supabase Storage com base na sua URL pública.
    """
    if not public_url or "/storage/v1/object/public/uploads/" not in public_url:
        return
        
    filename = public_url.split("/storage/v1/object/public/uploads/")[-1]
    url = f"{SUPABASE_URL}/storage/v1/object/uploads/{filename}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req) as response:
            response.read()
    except Exception as e:
        print(f"Warning: Falha ao deletar imagem {filename} do Supabase: {str(e)}")

class CakeStoreRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for safety, although everything is hosted together
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def get_jwt_payload_from_request(self) -> dict or None:
        auth_header = self.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ")[1]
        return verify_jwt(token)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Route aliases
        if path == "/" or path == "/index.html":
            self.serve_static_file("index.html")
            return
        elif path == "/z_admin" or path == "/z_admin/":
            self.serve_static_file("admin.html")
            return
        elif path == "/creators":
            self.serve_static_file("creators.html")
            return
        
        # API Endpoints
        elif path == "/api/products":
            self.handle_get_products()
            return
        elif path == "/api/feedbacks":
            self.handle_get_feedbacks()
            return
        elif path == "/api/creators":
            self.handle_get_creators()
            return

        # Serve static assets
        # Strip leading slash
        relative_path = path.lstrip('/')
        
        # Block access to server scripts, python files, or hidden files/directories
        if relative_path.endswith('.py') or any(part.startswith('.') for part in relative_path.split('/')):
            self.send_error_response(403, "Acesso proibido")
            return
            
        # Safely resolve path to avoid Directory Traversal vulnerabilities
        target_path = os.path.abspath(os.path.join(STATIC_DIR, relative_path))
        if target_path.startswith(STATIC_DIR) and os.path.isfile(target_path):
            self.serve_file(target_path)
        else:
            self.send_error_response(404, "Arquivo não encontrado")

    def do_POST(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == "/api/login":
            self.handle_login()
        elif path == "/api/products":
            self.handle_create_product()
        elif path == "/api/feedbacks":
            self.handle_create_feedback()
        elif path == "/api/creators":
            self.handle_create_creator()
        else:
            self.send_error_response(404, "Rota de API não encontrada")

    def do_DELETE(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == "/api/products":
            self.handle_delete_product()
        elif path == "/api/feedbacks":
            self.handle_delete_feedback()
        elif path == "/api/creators":
            self.handle_delete_creator()
        else:
            self.send_error_response(404, "Rota de API não encontrada")

    def do_PUT(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == "/api/feedbacks":
            self.handle_update_feedback()
        elif path == "/api/creators":
            self.handle_update_creator()
        else:
            self.send_error_response(404, "Rota de API não encontrada")

    # Serve static templates (HTML, CSS, JS) from static/
    def serve_static_file(self, filename):
        file_path = os.path.join(STATIC_DIR, filename)
        if os.path.exists(file_path):
            self.serve_file(file_path)
        else:
            self.send_error_response(404, f"{filename} não encontrado no servidor.")

    def serve_file(self, file_path):
        mime_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".ico": "image/x-icon",
        }
        _, ext = os.path.splitext(file_path)
        content_type = mime_types.get(ext.lower(), "application/octet-stream")

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error_response(500, f"Erro interno ao ler arquivo: {str(e)}")

    # API Handler Helpers
    def read_json_payload(self) -> dict or None:
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            body = self.rfile.read(content_length)
            return json.loads(body.decode('utf-8'))
        except Exception:
            return None

    def send_json_response(self, status_code, data):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_response(self, status_code, message):
        self.send_json_response(status_code, {"error": message})

    # Handler Implementations
    def handle_login(self):
        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return
            
        username = payload.get("username")
        password = payload.get("password")

        if username == "admin" and password == "admin123":
            # Generate JWT valid for 24 hours
            token_payload = {
                "user": "admin",
                "exp": time.time() + (24 * 3600),
                "iat": time.time()
            }
            token = create_jwt(token_payload)
            self.send_json_response(200, {"success": True, "token": token})
        else:
            self.send_error_response(401, "Usuário ou senha incorretos")

    def handle_get_products(self):
        if USE_SUPABASE:
            try:
                products = supabase_api_request("/rest/v1/products?select=*")
                self.send_json_response(200, products)
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao ler produtos do Supabase: {str(e)}")
                return

        try:
            with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
                products = json.load(f)
            self.send_json_response(200, products)
        except Exception as e:
            self.send_error_response(500, f"Erro ao ler produtos: {str(e)}")

    def handle_create_product(self):
        # 1. Authorize JWT
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        # 2. Read product details
        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return

        name = payload.get("name")
        price = payload.get("price")
        photo_base64 = payload.get("photo")

        if not name or not price or not photo_base64:
            self.send_error_response(400, "Campos nome, preço e foto são obrigatórios")
            return

        if USE_SUPABASE:
            try:
                # Upload image to Supabase Storage
                photo_url = supabase_upload_image(photo_base64)
                
                new_product = {
                    "id": uuid.uuid4().hex,
                    "name": name,
                    "price": float(price),
                    "photo": photo_url,
                    "created_at": time.time()
                }
                
                supabase_api_request("/rest/v1/products", method="POST", payload=new_product)
                self.send_json_response(201, {"success": True, "product": new_product})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao salvar produto no Supabase: {str(e)}")
                return

        try:
            # 3. Decode base64 image and save to file
            if "," in photo_base64:
                header, base64_str = photo_base64.split(",", 1)
                ext = ".png"
                if "image/jpeg" in header or "image/jpg" in header:
                    ext = ".jpg"
                elif "image/webp" in header:
                    ext = ".webp"
                elif "image/gif" in header:
                    ext = ".gif"
            else:
                base64_str = photo_base64
                ext = ".png"

            photo_bytes = base64.b64decode(base64_str)
            image_filename = f"cake_{uuid.uuid4().hex}{ext}"
            image_filepath = os.path.join(UPLOADS_DIR, image_filename)

            with open(image_filepath, "wb") as img_file:
                img_file.write(photo_bytes)

            # 4. Save to JSON database
            with open(PRODUCTS_FILE, "r+", encoding="utf-8") as f:
                products = json.load(f)
                
                new_product = {
                    "id": uuid.uuid4().hex,
                    "name": name,
                    "price": float(price),
                    "photo": f"/uploads/{image_filename}",
                    "created_at": time.time()
                }
                
                products.append(new_product)
                f.seek(0)
                json.dump(products, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(201, {"success": True, "product": new_product})
        except Exception as e:
            self.send_error_response(500, f"Erro ao criar produto: {str(e)}")

    def handle_delete_product(self):
        # 1. Authorize JWT
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        # 2. Get product id from query param or body
        payload = self.read_json_payload()
        product_id = payload.get("id") if payload else None
        
        if not product_id:
            # check query string as fallback
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            if 'id' in query_params:
                product_id = query_params['id'][0]

        if not product_id:
            self.send_error_response(400, "ID do produto é obrigatório")
            return

        if USE_SUPABASE:
            try:
                # Find product first to get photo URL
                products = supabase_api_request(f"/rest/v1/products?id=eq.{product_id}&select=*")
                if not products:
                    self.send_error_response(404, "Produto não encontrado")
                    return
                product = products[0]
                
                # Delete image from storage
                supabase_delete_image(product.get("photo"))
                
                # Delete from table
                supabase_api_request(f"/rest/v1/products?id=eq.{product_id}", method="DELETE")
                self.send_json_response(200, {"success": True, "message": "Produto excluído com sucesso"})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao excluir produto no Supabase: {str(e)}")
                return

        try:
            with open(PRODUCTS_FILE, "r+", encoding="utf-8") as f:
                products = json.load(f)
                filtered_products = []
                deleted_product = None

                for p in products:
                    if p["id"] == product_id:
                        deleted_product = p
                    else:
                        filtered_products.append(p)

                if not deleted_product:
                    self.send_error_response(404, "Produto não encontrado")
                    return

                # Delete associated file if it exists
                photo_rel_path = deleted_product["photo"].lstrip("/")
                photo_abs_path = os.path.join(STATIC_DIR, photo_rel_path)
                if os.path.exists(photo_abs_path) and os.path.isfile(photo_abs_path):
                    try:
                        os.remove(photo_abs_path)
                    except Exception:
                        pass # Ignore photo file deletion errors if file is locked or already missing

                f.seek(0)
                json.dump(filtered_products, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(200, {"success": True, "message": "Produto excluído com sucesso"})
        except Exception as e:
            self.send_error_response(500, f"Erro ao excluir produto: {str(e)}")

    def handle_get_feedbacks(self):
        if USE_SUPABASE:
            try:
                feedbacks = supabase_api_request("/rest/v1/feedbacks?select=*")
                # Return feedback in reverse chronological order
                feedbacks.sort(key=lambda x: x.get("created_at", 0), reverse=True)
                self.send_json_response(200, feedbacks)
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao ler feedbacks do Supabase: {str(e)}")
                return

        try:
            with open(FEEDBACKS_FILE, "r", encoding="utf-8") as f:
                feedbacks = json.load(f)
            # Return feedback in reverse chronological order
            feedbacks.sort(key=lambda x: x.get("created_at", 0), reverse=True)
            self.send_json_response(200, feedbacks)
        except Exception as e:
            self.send_error_response(500, f"Erro ao ler feedbacks: {str(e)}")

    def handle_create_feedback(self):
        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return

        name = payload.get("name", "Anônimo").strip()
        rating = payload.get("rating")
        comment = payload.get("comment", "").strip()

        if rating is None or not (1 <= int(rating) <= 5):
            self.send_error_response(400, "A avaliação por estrelas (1 a 5) é obrigatória")
            return

        new_feedback = {
            "id": uuid.uuid4().hex,
            "name": name if name else "Anônimo",
            "rating": int(rating),
            "comment": comment,
            "created_at": time.time()
        }

        if USE_SUPABASE:
            try:
                supabase_api_request("/rest/v1/feedbacks", method="POST", payload=new_feedback)
                self.send_json_response(201, {"success": True, "feedback": new_feedback})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao salvar feedback no Supabase: {str(e)}")
                return

        try:
            with open(FEEDBACKS_FILE, "r+", encoding="utf-8") as f:
                feedbacks = json.load(f)
                feedbacks.append(new_feedback)
                f.seek(0)
                json.dump(feedbacks, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(201, {"success": True, "feedback": new_feedback})
        except Exception as e:
            self.send_error_response(500, f"Erro ao salvar feedback: {str(e)}")

    def handle_update_feedback(self):
        # 1. Authorize JWT
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        # 2. Read feedback details to update
        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return

        feedback_id = payload.get("id")
        name = payload.get("name")
        rating = payload.get("rating")
        comment = payload.get("comment")

        if not feedback_id or rating is None or not (1 <= int(rating) <= 5):
            self.send_error_response(400, "Campos ID e avaliação (1 a 5) são obrigatórios")
            return

        update_data = {}
        if name is not None:
            update_data["name"] = name.strip() if name.strip() else "Anônimo"
        update_data["rating"] = int(rating)
        if comment is not None:
            update_data["comment"] = comment.strip()

        if USE_SUPABASE:
            try:
                res = supabase_api_request(f"/rest/v1/feedbacks?id=eq.{feedback_id}", method="PATCH", payload=update_data)
                if not res:
                    self.send_error_response(404, "Feedback não encontrado")
                    return
                self.send_json_response(200, {"success": True, "message": "Feedback atualizado com sucesso"})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao atualizar feedback no Supabase: {str(e)}")
                return

        try:
            with open(FEEDBACKS_FILE, "r+", encoding="utf-8") as f:
                feedbacks = json.load(f)
                updated = False
                
                for fb in feedbacks:
                    if fb["id"] == feedback_id:
                        if name is not None:
                            fb["name"] = name.strip() if name.strip() else "Anônimo"
                        fb["rating"] = int(rating)
                        if comment is not None:
                            fb["comment"] = comment.strip()
                        updated = True
                        break
                        
                if not updated:
                    self.send_error_response(404, "Feedback não encontrado")
                    return
                    
                f.seek(0)
                json.dump(feedbacks, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(200, {"success": True, "message": "Feedback atualizado com sucesso"})
        except Exception as e:
            self.send_error_response(500, f"Erro ao atualizar feedback: {str(e)}")

    def handle_delete_feedback(self):
        # 1. Authorize JWT
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        # 2. Get feedback id from query param or body
        payload = self.read_json_payload()
        feedback_id = payload.get("id") if payload else None
        
        if not feedback_id:
            # check query string as fallback
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            if 'id' in query_params:
                feedback_id = query_params['id'][0]

        if not feedback_id:
            self.send_error_response(400, "ID da avaliação é obrigatório")
            return

        if USE_SUPABASE:
            try:
                res = supabase_api_request(f"/rest/v1/feedbacks?id=eq.{feedback_id}", method="DELETE")
                if not res:
                    self.send_error_response(404, "Avaliação não encontrada")
                    return
                self.send_json_response(200, {"success": True, "message": "Avaliação excluída com sucesso"})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao excluir avaliação no Supabase: {str(e)}")
                return

        try:
            with open(FEEDBACKS_FILE, "r+", encoding="utf-8") as f:
                feedbacks = json.load(f)
                filtered_feedbacks = []
                deleted_feedback = None

                for fb in feedbacks:
                    if fb["id"] == feedback_id:
                        deleted_feedback = fb
                    else:
                        filtered_feedbacks.append(fb)

                if not deleted_feedback:
                    self.send_error_response(404, "Avaliação não encontrada")
                    return

                f.seek(0)
                json.dump(filtered_feedbacks, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(200, {"success": True, "message": "Avaliação excluída com sucesso"})
        except Exception as e:
            self.send_error_response(500, f"Erro ao excluir avaliação: {str(e)}")

    def handle_get_creators(self):
        if USE_SUPABASE:
            try:
                creators = supabase_api_request("/rest/v1/creators?select=*")
                # Return creators sorted by created_at or default
                creators.sort(key=lambda x: x.get("created_at", 0))
                self.send_json_response(200, creators)
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao ler criadores do Supabase: {str(e)}")
                return

        try:
            with open(CREATORS_FILE, "r", encoding="utf-8") as f:
                creators = json.load(f)
            self.send_json_response(200, creators)
        except Exception as e:
            self.send_error_response(500, f"Erro ao ler criadores: {str(e)}")

    def handle_create_creator(self):
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return

        name = payload.get("name")
        role = payload.get("role")
        bio = payload.get("bio")
        photo_base64 = payload.get("photo")
        instagram = payload.get("instagram", "")
        github = payload.get("github", "")
        linkedin = payload.get("linkedin", "")

        if not name or not role or not bio or not photo_base64:
            self.send_error_response(400, "Campos nome, cargo, biografia e foto são obrigatórios")
            return

        if USE_SUPABASE:
            try:
                # Upload image to Supabase Storage
                photo_url = supabase_upload_image(photo_base64)
                
                new_creator = {
                    "id": uuid.uuid4().hex,
                    "name": name,
                    "role": role,
                    "bio": bio,
                    "photo": photo_url,
                    "instagram": instagram,
                    "github": github,
                    "linkedin": linkedin,
                    "created_at": time.time()
                }
                
                supabase_api_request("/rest/v1/creators", method="POST", payload=new_creator)
                self.send_json_response(201, {"success": True, "creator": new_creator})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao criar criador no Supabase: {str(e)}")
                return

        try:
            if "," in photo_base64:
                header, base64_str = photo_base64.split(",", 1)
                ext = ".png"
                if "image/jpeg" in header or "image/jpg" in header:
                    ext = ".jpg"
                elif "image/webp" in header:
                    ext = ".webp"
                elif "image/gif" in header:
                    ext = ".gif"
            else:
                base64_str = photo_base64
                ext = ".png"

            photo_bytes = base64.b64decode(base64_str)
            image_filename = f"creator_{uuid.uuid4().hex}{ext}"
            image_filepath = os.path.join(UPLOADS_DIR, image_filename)

            with open(image_filepath, "wb") as img_file:
                img_file.write(photo_bytes)

            with open(CREATORS_FILE, "r+", encoding="utf-8") as f:
                creators = json.load(f)
                
                new_creator = {
                    "id": uuid.uuid4().hex,
                    "name": name,
                    "role": role,
                    "bio": bio,
                    "photo": f"/uploads/{image_filename}",
                    "instagram": instagram,
                    "github": github,
                    "linkedin": linkedin,
                    "created_at": time.time()
                }
                
                creators.append(new_creator)
                f.seek(0)
                json.dump(creators, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(201, {"success": True, "creator": new_creator})
        except Exception as e:
            self.send_error_response(500, f"Erro ao criar criador: {str(e)}")

    def handle_update_creator(self):
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        payload = self.read_json_payload()
        if not payload:
            self.send_error_response(400, "Corpo de requisição inválido")
            return

        creator_id = payload.get("id")
        name = payload.get("name")
        role = payload.get("role")
        bio = payload.get("bio")
        photo_base64 = payload.get("photo")
        instagram = payload.get("instagram", "")
        github = payload.get("github", "")
        linkedin = payload.get("linkedin", "")

        if not creator_id or not name or not role or not bio:
            self.send_error_response(400, "Campos ID, nome, cargo e biografia são obrigatórios")
            return

        if USE_SUPABASE:
            try:
                # Find creator first
                creators = supabase_api_request(f"/rest/v1/creators?id=eq.{creator_id}&select=*")
                if not creators:
                    self.send_error_response(404, "Criador não encontrado")
                    return
                creator = creators[0]

                photo_url = creator.get("photo")
                if photo_base64 and photo_base64.startswith("data:image/"):
                    # Upload new photo
                    photo_url = supabase_upload_image(photo_base64)
                    # Delete old photo
                    supabase_delete_image(creator.get("photo"))
                elif photo_base64:
                    photo_url = photo_base64

                update_data = {
                    "name": name.strip(),
                    "role": role.strip(),
                    "bio": bio.strip(),
                    "photo": photo_url,
                    "instagram": instagram.strip(),
                    "github": github.strip(),
                    "linkedin": linkedin.strip()
                }

                supabase_api_request(f"/rest/v1/creators?id=eq.{creator_id}", method="PATCH", payload=update_data)
                self.send_json_response(200, {"success": True, "message": "Criador atualizado com sucesso"})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao atualizar criador no Supabase: {str(e)}")
                return

        try:
            with open(CREATORS_FILE, "r+", encoding="utf-8") as f:
                creators = json.load(f)
                updated = False
                
                for cr in creators:
                    if cr["id"] == creator_id:
                        cr["name"] = name.strip()
                        cr["role"] = role.strip()
                        cr["bio"] = bio.strip()
                        cr["instagram"] = instagram.strip()
                        cr["github"] = github.strip()
                        cr["linkedin"] = linkedin.strip()

                        # Check if photo was updated
                        if photo_base64 and photo_base64.startswith("data:image/"):
                            old_photo = cr.get("photo", "")
                            if old_photo.startswith("/uploads/"):
                                old_path = os.path.join(STATIC_DIR, old_photo.lstrip("/"))
                                if os.path.exists(old_path) and os.path.isfile(old_path):
                                    try:
                                        os.remove(old_path)
                                    except Exception:
                                        pass

                            if "," in photo_base64:
                                header, base64_str = photo_base64.split(",", 1)
                                ext = ".png"
                                if "image/jpeg" in header or "image/jpg" in header:
                                    ext = ".jpg"
                                elif "image/webp" in header:
                                    ext = ".webp"
                                elif "image/gif" in header:
                                    ext = ".gif"
                            else:
                                base64_str = photo_base64
                                ext = ".png"

                            photo_bytes = base64.b64decode(base64_str)
                            image_filename = f"creator_{uuid.uuid4().hex}{ext}"
                            image_filepath = os.path.join(UPLOADS_DIR, image_filename)

                            with open(image_filepath, "wb") as img_file:
                                img_file.write(photo_bytes)

                            cr["photo"] = f"/uploads/{image_filename}"
                        elif photo_base64:
                            cr["photo"] = photo_base64

                        updated = True
                        break
                        
                if not updated:
                    self.send_error_response(404, "Criador não encontrado")
                    return
                    
                f.seek(0)
                json.dump(creators, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(200, {"success": True, "message": "Criador atualizado com sucesso"})
        except Exception as e:
            self.send_error_response(500, f"Erro ao atualizar criador: {str(e)}")

    def handle_delete_creator(self):
        admin_data = self.get_jwt_payload_from_request()
        if not admin_data:
            self.send_error_response(401, "Acesso negado. Token JWT ausente ou inválido.")
            return

        payload = self.read_json_payload()
        creator_id = payload.get("id") if payload else None
        
        if not creator_id:
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            if 'id' in query_params:
                creator_id = query_params['id'][0]

        if not creator_id:
            self.send_error_response(400, "ID do criador é obrigatório")
            return

        if USE_SUPABASE:
            try:
                # Find creator to get photo url
                creators = supabase_api_request(f"/rest/v1/creators?id=eq.{creator_id}&select=*")
                if not creators:
                    self.send_error_response(404, "Criador não encontrado")
                    return
                creator = creators[0]
                
                # Delete image from storage
                supabase_delete_image(creator.get("photo"))
                
                # Delete from table
                supabase_api_request(f"/rest/v1/creators?id=eq.{creator_id}", method="DELETE")
                self.send_json_response(200, {"success": True, "message": "Criador excluído com sucesso"})
                return
            except Exception as e:
                self.send_error_response(500, f"Erro ao excluir criador no Supabase: {str(e)}")
                return

        try:
            with open(CREATORS_FILE, "r+", encoding="utf-8") as f:
                creators = json.load(f)
                filtered_creators = []
                deleted_creator = None

                for cr in creators:
                    if cr["id"] == creator_id:
                        deleted_creator = cr
                    else:
                        filtered_creators.append(cr)

                if not deleted_creator:
                    self.send_error_response(404, "Criador não encontrado")
                    return

                # Delete old photo file
                photo_rel_path = deleted_creator["photo"].lstrip("/")
                photo_abs_path = os.path.join(STATIC_DIR, photo_rel_path)
                if photo_rel_path.startswith("uploads/") and os.path.exists(photo_abs_path) and os.path.isfile(photo_abs_path):
                    try:
                        os.remove(photo_abs_path)
                    except Exception:
                        pass

                f.seek(0)
                json.dump(filtered_creators, f, ensure_ascii=False, indent=2)
                f.truncate()

            self.send_json_response(200, {"success": True, "message": "Criador excluído com sucesso"})
        except Exception as e:
            self.send_error_response(500, f"Erro ao excluir criador: {str(e)}")

def run():
    print(f"Iniciando o servidor Thay Cake na porta {PORT}...")
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, CakeStoreRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado pelo usuário.")
        httpd.server_close()

if __name__ == '__main__':
    run()
