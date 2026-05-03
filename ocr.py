"""
Vista360 — OCR Serverless Function
Vercel Python Runtime
Ruta: /api/ocr
"""

from http.server import BaseHTTPRequestHandler
import json, base64, re, io, os
from datetime import datetime

# ── Intentar importar librerías de imagen ────────────────────────
try:
    from PIL import Image, ImageFilter, ImageEnhance, ImageOps
    import PIL
    PIL_OK = True
except ImportError:
    PIL_OK = False

try:
    import pytesseract
    TESS_OK = True
except ImportError:
    TESS_OK = False

try:
    import numpy as np
    import cv2
    CV_OK = True
except ImportError:
    CV_OK = False


# ════════════════════════════════════════════════════════════════
# 1. PIPELINE DE PROCESAMIENTO DE IMAGEN
# ════════════════════════════════════════════════════════════════

def preprocesar_imagen(img_pil):
    """Pipeline completo de preprocesamiento para boletas peruanas."""
    resultados = []

    # ── Versión 1: Escala de grises + contraste fuerte ──────────
    img1 = img_pil.convert("L")
    img1 = ImageEnhance.Contrast(img1).enhance(2.5)
    img1 = ImageEnhance.Sharpness(img1).enhance(2.0)
    resultados.append(("gris_contraste", img1))

    # ── Versión 2: Binarización (blanco/negro limpio) ───────────
    img2 = img_pil.convert("L")
    img2 = ImageEnhance.Contrast(img2).enhance(3.0)
    # Umbral adaptativo simple
    img2_arr = list(img2.getdata())
    promedio = sum(img2_arr) / len(img2_arr)
    umbral = max(100, min(200, int(promedio * 0.85)))
    img2 = img2.point(lambda x: 255 if x > umbral else 0, '1').convert("L")
    resultados.append(("binarizada", img2))

    # ── Versión 3: Con OpenCV si disponible (mejor deskew) ──────
    if CV_OK:
        arr = np.array(img_pil.convert("L"))

        # CLAHE (mejora contraste adaptativo por zonas)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        arr = clahe.apply(arr)

        # Eliminar ruido
        arr = cv2.fastNlMeansDenoising(arr, h=15)

        # Binarización adaptativa (mejor para boletas arrugadas)
        arr = cv2.adaptiveThreshold(
            arr, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 10
        )

        # Deskew (corrección de inclinación)
        coords = np.column_stack(np.where(arr < 128))
        if len(coords) > 100:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if abs(angle) < 15:  # solo corregir inclinaciones razonables
                h, w = arr.shape
                M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
                arr = cv2.warpAffine(arr, M, (w, h),
                                     flags=cv2.INTER_CUBIC,
                                     borderMode=cv2.BORDER_REPLICATE)

        # Eliminar líneas verticales (arrugas)
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        lineas_v = cv2.morphologyEx(arr, cv2.MORPH_OPEN, kernel_v)
        arr = cv2.add(arr, lineas_v)

        img_cv = Image.fromarray(arr)
        resultados.append(("opencv_clahe", img_cv))

    # ── Versión 4: Escala grande (Tesseract funciona mejor) ─────
    w, h = img_pil.size
    factor = max(1.0, 2000 / max(w, h))
    if factor > 1.1:
        img4 = img_pil.convert("L").resize(
            (int(w * factor), int(h * factor)),
            Image.LANCZOS
        )
        img4 = ImageEnhance.Contrast(img4).enhance(2.0)
        resultados.append(("escalada", img4))

    return resultados


# ════════════════════════════════════════════════════════════════
# 2. CONFIGURACIÓN ÓPTIMA DE TESSERACT
# ════════════════════════════════════════════════════════════════

CONFIGS_TESSERACT = [
    # PSM 6 = bloque uniforme (mejor para boletas completas)
    "--oem 3 --psm 6 -l spa",
    # PSM 4 = columna de texto variable
    "--oem 3 --psm 4 -l spa",
    # PSM 11 = texto disperso (para boletas muy arrugadas)
    "--oem 3 --psm 11 -l spa",
    # Solo dígitos (para pasar extra sobre zonas de montos)
    "--oem 3 --psm 6 -l spa -c tessedit_char_whitelist=0123456789.,/: ",
]

def ocr_multiples_configs(img):
    """Intenta múltiples configuraciones y devuelve el mejor resultado."""
    if not TESS_OK:
        return ""

    mejor_texto = ""
    mejor_len = 0

    for config in CONFIGS_TESSERACT[:3]:  # las 3 primeras son de texto completo
        try:
            texto = pytesseract.image_to_string(img, config=config)
            if len(texto.strip()) > mejor_len:
                mejor_texto = texto
                mejor_len = len(texto.strip())
        except Exception:
            continue

    return mejor_texto


def extraer_texto_completo(img_pil):
    """Ejecuta el pipeline completo y combina resultados."""
    versiones = preprocesar_imagen(img_pil)
    todos_los_textos = []

    for nombre, img in versiones:
        texto = ocr_multiples_configs(img)
        if texto.strip():
            todos_los_textos.append(texto)

    # Devolver el texto más largo (más información extraída)
    if not todos_los_textos:
        return ""
    return max(todos_los_textos, key=lambda t: len(t.strip()))


# ════════════════════════════════════════════════════════════════
# 3. POST-PROCESAMIENTO DEL TEXTO
# ════════════════════════════════════════════════════════════════

def limpiar_texto_ocr(texto):
    """Corrige errores comunes del OCR en boletas peruanas."""
    # Errores comunes de OCR en letras/números
    correcciones = {
        r'\bT0TAL\b':    'TOTAL',
        r'\b1GV\b':      'IGV',
        r'\bSUBT0TAL\b': 'SUBTOTAL',
        r'\bFECHA\b':    'FECHA',
        r'\bIMF\b':      'IMP',
        r'\bRUC\b':      'RUC',
        r'S/\.':         'S/',
        r'SI ':          'S/ ',
    }
    for patron, reemplazo in correcciones.items():
        texto = re.sub(patron, reemplazo, texto, flags=re.IGNORECASE)

    # Normalizar separadores numéricos peruanos (1,234.56 o 1.234,56)
    # Formato peruano: S/ 1,234.56
    texto = re.sub(r'(\d)\.(\d{3}),(\d{2})', r'\1\2.\3', texto)  # 1.234,56 → 123456... fix
    texto = re.sub(r'(\d),(\d{3})\.(\d{2})', r'\1\2.\3', texto)  # 1,234.56 → 1234.56

    return texto


def parse_monto(texto_monto):
    """Convierte string de monto a float."""
    if not texto_monto:
        return None
    # Limpiar símbolo de moneda
    limpio = re.sub(r'[S/\$€£\s]', '', str(texto_monto))
    # Formato peruano: 1,234.56
    limpio = re.sub(r',(\d{3})', r'\1', limpio)
    try:
        return round(float(limpio), 2)
    except ValueError:
        return None


# ════════════════════════════════════════════════════════════════
# 4. EXTRACCIÓN DE DATOS (CRÍTICO)
# ════════════════════════════════════════════════════════════════

def extraer_datos(texto_raw):
    """Extrae datos estructurados del texto OCR con regex robustos."""
    texto = limpiar_texto_ocr(texto_raw)
    lineas = texto.split('\n')

    resultado = {
        "total":      None,
        "igv":        None,
        "subtotal":   None,
        "fecha":      None,
        "ruc":        None,
        "comercio":   None,
        "concepto":   None,
        "moneda":     "PEN",
        "confidence": 0,
        "texto_raw":  texto_raw[:500],  # primeros 500 chars para debug
        "campos_inciertos": [],
    }

    # ── PATRÓN BASE para montos (acepta S/, soles, $, etc.) ─────
    M = r'S?[/\$]?\s*(\d{1,6}[.,]\d{2})'

    # ── RUC (11 dígitos, empieza con 10 o 20) ───────────────────
    ruc_match = re.search(r'\b((?:10|20)\d{9})\b', texto)
    if ruc_match:
        resultado["ruc"] = ruc_match.group(1)

    # ── FECHA (múltiples formatos peruanos) ─────────────────────
    patrones_fecha = [
        r'(\d{2})[/\-](\d{2})[/\-](\d{4})',   # DD/MM/YYYY
        r'(\d{4})[/\-](\d{2})[/\-](\d{2})',   # YYYY-MM-DD
        r'(\d{2})[/\-](\d{2})[/\-](\d{2})\b', # DD/MM/YY
    ]
    for pat in patrones_fecha:
        m = re.search(pat, texto)
        if m:
            g = m.groups()
            try:
                if len(g[2]) == 4:  # DD/MM/YYYY
                    fecha = f"{g[2]}-{g[1].zfill(2)}-{g[0].zfill(2)}"
                elif len(g[0]) == 4:  # YYYY-MM-DD
                    fecha = f"{g[0]}-{g[1].zfill(2)}-{g[2].zfill(2)}"
                else:  # DD/MM/YY
                    anio = f"20{g[2]}"
                    fecha = f"{anio}-{g[1].zfill(2)}-{g[0].zfill(2)}"
                # Validar que sea fecha razonable
                dt = datetime.strptime(fecha, "%Y-%m-%d")
                if 2010 <= dt.year <= 2030:
                    resultado["fecha"] = fecha
                    break
            except ValueError:
                continue

    # ── TOTAL ────────────────────────────────────────────────────
    patrones_total = [
        r'(?:TOTAL\s*A\s*PAGAR|IMPORTE\s*TOTAL|TOTAL\s*GENERAL|MONTO\s*TOTAL)\s*:?\s*' + M,
        r'(?:TOTAL|IMPORTE)\s*:?\s*' + M,
        r'TOT[A4]L\s*:?\s*' + M,  # acepta errores OCR
        r'PAGAR\s*:?\s*' + M,
    ]
    for pat in patrones_total:
        m = re.search(pat, texto, re.IGNORECASE)
        if m:
            val = parse_monto(m.group(1))
            if val and val > 0:
                resultado["total"] = val
                break

    # ── IGV ──────────────────────────────────────────────────────
    patrones_igv = [
        r'(?:IGV|I\.G\.V|IMPUESTO)\s*(?:18%|18\s*)?\s*:?\s*' + M,
        r'I\.?G\.?V\.?\s*:?\s*' + M,
        r'TAX\s*:?\s*' + M,
    ]
    for pat in patrones_igv:
        m = re.search(pat, texto, re.IGNORECASE)
        if m:
            val = parse_monto(m.group(1))
            if val and val > 0:
                resultado["igv"] = val
                break

    # ── SUBTOTAL ─────────────────────────────────────────────────
    patrones_sub = [
        r'(?:SUBTOTAL|SUB\s*TOTAL|BASE\s*IMPONIBLE|VALOR\s*VENTA)\s*:?\s*' + M,
        r'SUB\.?\s*TOTAL\s*:?\s*' + M,
    ]
    for pat in patrones_sub:
        m = re.search(pat, texto, re.IGNORECASE)
        if m:
            val = parse_monto(m.group(1))
            if val and val > 0:
                resultado["subtotal"] = val
                break

    # ── COMERCIO (nombre del negocio) ────────────────────────────
    # Estrategia: buscar en las primeras 8 líneas no vacías
    lineas_utiles = [l.strip() for l in lineas if len(l.strip()) > 4][:8]
    for linea in lineas_utiles:
        # Ignorar líneas que son claramente dirección o datos técnicos
        if re.search(r'\d{4,}|TELF|TEL:|RUC|BOLETA|FACTURA|www\.', linea, re.IGNORECASE):
            continue
        if len(linea) >= 5 and linea.isupper():  # nombres de comercio suelen ser mayúsculas
            resultado["comercio"] = linea[:80]
            break
    if not resultado["comercio"] and lineas_utiles:
        resultado["comercio"] = lineas_utiles[0][:80]

    # ── CONCEPTO (qué se compró) ─────────────────────────────────
    # Buscar línea que describa el producto/servicio
    for linea in lineas:
        linea = linea.strip()
        if len(linea) > 10 and not re.search(r'^\d+[.,]\d{2}|RUC|TOTAL|IGV|FECHA|S/', linea, re.IGNORECASE):
            if re.search(r'[A-Za-z]{4,}', linea):  # tiene palabras reales
                resultado["concepto"] = linea[:120]
                break

    # ── HEURÍSTICA: total más grande al final ────────────────────
    if not resultado["total"]:
        montos = []
        for linea in reversed(lineas):
            nums = re.findall(r'\b\d{1,5}[.,]\d{2}\b', linea)
            for n in nums:
                val = parse_monto(n)
                if val and 1 <= val <= 99999:
                    montos.append(val)
        if montos:
            resultado["total"] = max(montos)
            resultado["campos_inciertos"].append("total")

    # ── DETECTAR MONEDA ──────────────────────────────────────────
    if re.search(r'\$|USD|DOLARES', texto, re.IGNORECASE):
        resultado["moneda"] = "USD"
    elif re.search(r'S/|SOLES|PEN', texto, re.IGNORECASE):
        resultado["moneda"] = "PEN"

    return resultado


# ════════════════════════════════════════════════════════════════
# 5. VALIDACIÓN Y COHERENCIA MATEMÁTICA
# ════════════════════════════════════════════════════════════════

def validar_y_completar(datos):
    """Verifica coherencia matemática y completa campos faltantes."""
    t = datos["total"]
    i = datos["igv"]
    s = datos["subtotal"]
    IGV_RATE = 0.18

    # Si tenemos total pero no igv/subtotal, calcular
    if t and not s and not i:
        datos["subtotal"] = round(t / 1.18, 2)
        datos["igv"] = round(t - datos["subtotal"], 2)
        datos["campos_inciertos"].extend(["igv", "subtotal"])

    # Si tenemos subtotal pero no total
    elif s and not t:
        datos["igv"] = datos["igv"] or round(s * IGV_RATE, 2)
        datos["total"] = round(s + datos["igv"], 2)
        datos["campos_inciertos"].append("total")

    # Si tenemos los tres, verificar coherencia
    elif t and s and i:
        esperado_total = round(s + i, 2)
        if abs(esperado_total - t) > 0.10:  # más de 10 centavos de diferencia
            # El total directo es más confiable
            datos["igv"] = round(t - s, 2)
            datos["campos_inciertos"].append("igv")

    # ── CALCULAR CONFIDENCE ──────────────────────────────────────
    puntos = 0
    if datos["total"]:    puntos += 35
    if datos["ruc"]:      puntos += 20
    if datos["fecha"]:    puntos += 15
    if datos["subtotal"]: puntos += 10
    if datos["igv"]:      puntos += 10
    if datos["comercio"]: puntos += 10
    datos["confidence"] = puntos

    return datos


# ════════════════════════════════════════════════════════════════
# 6. HANDLER PRINCIPAL (Vercel)
# ════════════════════════════════════════════════════════════════

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._headers_cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body)

            imagen_b64 = payload.get("imagen_base64", "")
            if not imagen_b64:
                return self._error("Se requiere imagen_base64")

            # Decodificar imagen
            img_bytes = base64.b64decode(imagen_b64)
            img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            # Extraer texto con pipeline completo
            texto = extraer_texto_completo(img_pil)

            if not texto.strip():
                return self._json({
                    "total": None, "igv": None, "subtotal": None,
                    "fecha": None, "ruc": None, "comercio": None,
                    "concepto": None, "moneda": "PEN",
                    "confidence": 0,
                    "error": "No se pudo extraer texto de la imagen",
                    "sugerencia": "Intenta con mejor iluminación y la boleta bien plana",
                    "campos_inciertos": ["total", "igv", "subtotal", "fecha", "ruc"],
                })

            # Extraer y validar datos
            datos = extraer_datos(texto)
            datos = validar_y_completar(datos)
            datos["texto_extraido"] = texto[:800]

            self._json(datos)

        except Exception as e:
            self._error(str(e))

    def _headers_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")

    def _json(self, data):
        self.send_response(200)
        self._headers_cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def _error(self, msg):
        self.send_response(400)
        self._headers_cors()
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())

    def log_message(self, *args):
        pass  # silenciar logs en Vercel
