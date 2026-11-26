"""Kırılan Takım Kartı (T4.000) PDF çıktısı.

Excel kartıyla aynı yerleşimi kullanır; tüm alanlar tek A4 sayfaya sığacak şekilde
ölçeklenir. Türkçe karakterler için DejaVu fontu paket içinden yüklenir.
"""
from __future__ import annotations

import base64
import io
import os
from datetime import datetime
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ASSET_DIR = Path(__file__).parent / "assets"
FONT_DIR = ASSET_DIR / "fonts"
SYSTEM_FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")

PAGE_W, PAGE_H = A4
MARGIN_X = 26
CONTENT_W = PAGE_W - MARGIN_X * 2
BOTTOM_LIMIT = 30

_FONT_CACHE: dict[str, str] = {}


def _font_file(name: str) -> Path | None:
    for directory in (FONT_DIR, SYSTEM_FONT_DIR):
        candidate = directory / name
        if candidate.exists():
            return candidate
    return None


def pdf_fonts() -> tuple[str, str]:
    """(normal, kalın) font adlarını döndürür; font bulunamazsa Helvetica'ya düşer."""
    if _FONT_CACHE:
        return _FONT_CACHE["regular"], _FONT_CACHE["bold"]
    regular_file = _font_file("DejaVuSans.ttf")
    bold_file = _font_file("DejaVuSans-Bold.ttf")
    if regular_file:
        pdfmetrics.registerFont(TTFont("YazkanSans", str(regular_file)))
        regular = "YazkanSans"
    else:
        regular = "Helvetica"
    if bold_file:
        pdfmetrics.registerFont(TTFont("YazkanSans-Bold", str(bold_file)))
        bold = "YazkanSans-Bold"
    else:
        bold = "Helvetica-Bold"
    _FONT_CACHE["regular"] = regular
    _FONT_CACHE["bold"] = bold
    return regular, bold


def _text(*values) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _wrap(text: str, font: str, size: float, max_width: float) -> list[str]:
    text = str(text or "-").replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current)
                current = ""
            fragment = ""
            for char in word:
                if fragment and pdfmetrics.stringWidth(fragment + char, font, size) > max_width:
                    lines.append(fragment)
                    fragment = char
                else:
                    fragment += char
            current = fragment
        if current:
            lines.append(current)
    return lines or ["-"]


def _clip(lines: list[str], max_lines: int) -> list[str]:
    if len(lines) <= max_lines:
        return lines
    clipped = lines[:max_lines]
    last = clipped[-1]
    clipped[-1] = (last[:-1] if len(last) > 1 else last) + "…"
    return clipped


def _image_reader(data_url) -> ImageReader | None:
    if not data_url or not str(data_url).startswith("data:image/"):
        return None
    try:
        raw = base64.b64decode(str(data_url).split(",", 1)[1])
        with PILImage.open(io.BytesIO(raw)) as probe:
            if (probe.format or "").upper() not in {"JPEG", "PNG"}:
                converted = io.BytesIO()
                probe.convert("RGB").save(converted, format="PNG")
                raw = converted.getvalue()
        return ImageReader(io.BytesIO(raw))
    except Exception:
        return None


def _image_list(scrap: dict, prefix: str) -> list:
    values = scrap.get(f"{prefix}_image_urls") or []
    if not values:
        single = scrap.get(f"{prefix}_image_url")
        values = [single] if single else []
    return [value for value in values if value]


def extra_groups(scrap: dict) -> list[tuple[str, list[tuple[str, str]]]]:
    """Form sekmelerine göre, kartta yer almayan tüm doldurulmuş alanlar."""
    quantity = scrap.get("quantity", 0)
    try:
        quantity_text = f"{float(quantity):g}".replace(".", ",")
    except Exception:
        quantity_text = str(quantity or "")
    unit = _text(scrap.get("unit"), "adet")
    stock_type = "Stok ürünü" if _text(scrap.get("stock_type")) == "product" else "Takım tutucu"
    reasons = [str(item).strip() for item in (scrap.get("break_reasons") or []) if str(item).strip()]
    before_count = len(_image_list(scrap, "before"))
    after_count = len(_image_list(scrap, "after"))
    machine = " — ".join(part for part in (_text(scrap.get("machine_code")), _text(scrap.get("machine_name"))) if part)
    return [
        ("1 · STOK KAYDI", [
            ("Kayıt türü", stock_type),
            ("Hurda miktarı", f"{quantity_text} {unit}".strip()),
            ("Hurda nedeni", _text(scrap.get("scrap_reason"), "-")),
            ("Hurda tarihi", _text(scrap.get("scrap_date"), "-")),
            ("Konum / hurda alanı", _text(scrap.get("location"), "-")),
        ]),
        ("2 · TAKIM & PARÇA", [
            ("Takım üretici firma", _text(scrap.get("tool_manufacturer"), scrap.get("brand"), "-")),
            ("Takım adı / kodu", _text(scrap.get("tool_name_code"), scrap.get("name"), "-")),
            ("Parça adı / parça no", " / ".join(part for part in (_text(scrap.get("production_product")), _text(scrap.get("part_no"))) if part) or "-"),
            ("Tezgah", machine or "-"),
            ("Operatör", _text(scrap.get("operator_name"), scrap.get("user_name"), "-")),
        ]),
        ("3 · KIRILMA SEBEBİ", [
            ("Kırılma sebepleri", " | ".join(f"{index + 1}. {reason}" for index, reason in enumerate(reasons)) or "-"),
            ("Neden ve hasar açıklaması", _text(scrap.get("description"), "-")),
            ("Kök neden", _text(scrap.get("root_cause"), "-")),
            ("Uygunsuzluk kararı", _text(scrap.get("disposition"), "-")),
            ("Düzeltici faaliyet", _text(scrap.get("corrective_action"), "-")),
            ("Önleyici faaliyet", _text(scrap.get("preventive_action"), "-")),
        ]),
        ("4 · GÖRSELLER", [
            ("RESİM-1 (ilk hâl)", f"{before_count} fotoğraf" if before_count else "Fotoğraf yok"),
            ("RESİM-2 (hasarlı hâl)", f"{after_count} fotoğraf" if after_count else "Fotoğraf yok"),
        ]),
        ("5 · ONAY & DOKÜMAN", [
            ("Hazırlayan", _text(scrap.get("prepared_by"), "Abdullah Tetik")),
            ("Formen", _text(scrap.get("foreman_name"), "Celal")),
            ("Onaylayan", _text(scrap.get("approved_by"), "-")),
            ("Tanık / teslim alan", _text(scrap.get("witness"), "-")),
            ("Doküman no / rev. / değ. nedeni", " / ".join(part for part in (_text(scrap.get("document_no"), "T4.000"), _text(scrap.get("document_revision"), "00"), _text(scrap.get("change_reason"), "-")) if part)),
        ]),
    ]


def build_scrap_card_pdf(scrap: dict) -> bytes:
    """Kartı tek A4 sayfaya, okunabilir punto ile yerleştirir."""
    regular, bold = pdf_fonts()
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Kirilan Takim Karti {_text(scrap.get('record_no'), '')}".strip())
    pdf.setAuthor("YAZKAN DOKUM")

    ink = (0.06, 0.09, 0.13)
    label_ink = (0.22, 0.27, 0.34)
    line_color = (0.45, 0.5, 0.57)
    band = (0.90, 0.93, 0.97)

    top = PAGE_H - 24

    # ---------- Başlık ----------
    header_h = 46
    logo_path = ASSET_DIR / "yazkan-logo.jpg"
    logo_w = 118
    pdf.setStrokeColorRGB(*line_color)
    pdf.setLineWidth(0.8)
    pdf.rect(MARGIN_X, top - header_h, CONTENT_W, header_h, stroke=1, fill=0)
    if logo_path.exists():
        try:
            logo = ImageReader(str(logo_path))
            ratio = min((logo_w - 8) / logo.getSize()[0], (header_h - 8) / logo.getSize()[1])
            pdf.drawImage(logo, MARGIN_X + 4, top - header_h + 4, width=logo.getSize()[0] * ratio, height=logo.getSize()[1] * ratio, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    doc_w = 138
    title_x = MARGIN_X + logo_w
    title_w = CONTENT_W - logo_w - doc_w
    pdf.setFont(bold, 17)
    pdf.setFillColorRGB(*ink)
    pdf.drawCentredString(title_x + title_w / 2, top - header_h / 2 - 6, "Kırılan Takım Kartı")
    pdf.line(title_x, top - header_h, title_x, top)
    pdf.line(title_x + title_w, top - header_h, title_x + title_w, top)
    doc_x = title_x + title_w
    doc_lines = [
        ("Doküman No:", _text(scrap.get("document_no"), "T4.000")),
        ("Doküman Rev. No:", _text(scrap.get("document_revision"), "00")),
        ("Değ. Nedeni:", _text(scrap.get("change_reason"), "-")),
    ]
    for index, (label, value) in enumerate(doc_lines):
        row_top = top - index * (header_h / 3)
        row_bottom = row_top - header_h / 3
        if index:
            pdf.line(doc_x, row_top, doc_x + doc_w, row_top)
        pdf.setFont(bold, 6.6)
        pdf.setFillColorRGB(*label_ink)
        pdf.drawString(doc_x + 4, row_bottom + 6.5, label)
        label_width = pdfmetrics.stringWidth(label, bold, 6.6)
        value_size = 7.2
        value_width = doc_w - label_width - 12
        if pdfmetrics.stringWidth(value, regular, value_size) > value_width:
            value_size = 6.2
        pdf.setFont(regular, value_size)
        pdf.setFillColorRGB(*ink)
        value_lines = _clip(_wrap(value, regular, value_size, value_width), 1)
        pdf.drawRightString(doc_x + doc_w - 4, row_bottom + 6.5, value_lines[0])

    y = top - header_h

    # ---------- Bilgi tablosu ----------
    machine_code = _text(scrap.get("machine_code"), scrap.get("machine_name"))
    scrap_date = _text(scrap.get("scrap_date"))
    try:
        formatted_date = datetime.fromisoformat(scrap_date[:10]).strftime("%d/%m/%Y")
    except Exception:
        formatted_date = scrap_date
    machine_and_date = f"{machine_code} - {formatted_date}".strip(" -")
    quantity = scrap.get("quantity", 0)
    try:
        quantity_text = f"{float(quantity):g}".replace(".", ",")
    except Exception:
        quantity_text = str(quantity or "")

    rows = [
        ("TAKIM ÜRETİCİ FİRMA ADI", _text(scrap.get("tool_manufacturer"), scrap.get("brand"), "-"),
         "TAKIM ADI / KODU", _text(scrap.get("tool_name_code"), f"{_text(scrap.get('name'))} {_text(scrap.get('code'))}".strip(), "-")),
        ("PARÇA ADI", _text(scrap.get("production_product"), "-"),
         "PARÇA NO", _text(scrap.get("part_no"), "-")),
        ("OPERATÖR ADI-SOYADI", _text(scrap.get("operator_name"), scrap.get("user_name"), "-"),
         "TEZGAH NO - TARİH", machine_and_date or "-"),
        ("HURDA MİKTARI", f"{quantity_text} {_text(scrap.get('unit'), 'adet')}".strip(),
         "HURDA NEDENİ", _text(scrap.get("scrap_reason"), "-")),
        ("KONUM / HURDA ALANI", _text(scrap.get("location"), "-"),
         "TANIK / TESLİM ALAN", _text(scrap.get("witness"), "-")),
    ]
    label_w = 118
    value_w = (CONTENT_W - label_w * 2) / 2
    value_font_size = 8.6
    label_font_size = 6.8
    row_heights = []
    for label_1, value_1, label_2, value_2 in rows:
        lines_1 = _clip(_wrap(value_1, regular, value_font_size, value_w - 10), 2)
        lines_2 = _clip(_wrap(value_2, regular, value_font_size, value_w - 10), 2)
        row_heights.append(max(26, 13 + max(len(lines_1), len(lines_2)) * 10))
    for (label_1, value_1, label_2, value_2), row_h in zip(rows, row_heights):
        pdf.setStrokeColorRGB(*line_color)
        pdf.setLineWidth(0.7)
        pdf.rect(MARGIN_X, y - row_h, CONTENT_W, row_h, stroke=1, fill=0)
        pdf.line(MARGIN_X + label_w, y - row_h, MARGIN_X + label_w, y)
        pdf.line(MARGIN_X + label_w + value_w, y - row_h, MARGIN_X + label_w + value_w, y)
        pdf.line(MARGIN_X + label_w * 2 + value_w, y - row_h, MARGIN_X + label_w * 2 + value_w, y)
        for column, (label, value) in enumerate(((label_1, value_1), (label_2, value_2))):
            base_x = MARGIN_X + column * (label_w + value_w)
            pdf.setFont(bold, label_font_size)
            pdf.setFillColorRGB(*label_ink)
            label_lines = _clip(_wrap(label, bold, label_font_size, label_w - 10), 2)
            for line_index, line in enumerate(label_lines):
                pdf.drawString(base_x + 5, y - 13 - line_index * 9, line)
            pdf.setFont(regular, value_font_size)
            pdf.setFillColorRGB(*ink)
            value_lines = _clip(_wrap(value, regular, value_font_size, value_w - 10), 2)
            for line_index, line in enumerate(value_lines):
                pdf.drawString(base_x + label_w + 5, y - 13 - line_index * 10, line)
        y -= row_h

    # ---------- İçerik yüksekliği planı ----------
    reasons = [str(item).strip() for item in (scrap.get("break_reasons") or []) if str(item).strip()]
    if not reasons:
        reasons = [value for value in (_text(scrap.get("scrap_reason")), _text(scrap.get("description"))) if value]

    extra_rows = [
        ("Neden ve hasar açıklaması", _text(scrap.get("description"), "-")),
        ("Kök neden", _text(scrap.get("root_cause"), "-")),
        ("Uygunsuzluk kararı", _text(scrap.get("disposition"), "-")),
        ("Düzeltici faaliyet", _text(scrap.get("corrective_action"), "-")),
        ("Önleyici faaliyet", _text(scrap.get("preventive_action"), "-")),
    ]
    extra_label_w = 122
    extra_font_size = 8.0
    section_h = 15
    signature_h = 46
    footer_h = 16
    gap = 7
    caption_h = 12

    def plan(reason_max_lines: int, extra_max_lines: int, photo_min: float):
        reason_lines: list[str] = []
        for index, reason in enumerate(reasons[:11]):
            reason_lines.extend(_clip(_wrap(f"{index + 1}. {reason}", regular, 8.2, CONTENT_W - 12), reason_max_lines))
        reason_rows = max(len(reason_lines), 4)
        wrapped = [
            _clip(_wrap(value, regular, extra_font_size, CONTENT_W - extra_label_w - 12), extra_max_lines)
            for _label, value in extra_rows
        ]
        heights = [max(16, 6 + len(lines) * 9.6) for lines in wrapped]
        fixed_h = (section_h + reason_rows * 13) + (section_h + sum(heights)) + signature_h + footer_h + gap * 4
        available = y - BOTTOM_LIMIT - fixed_h
        photo_h = available - 16
        return reason_lines, reason_rows, wrapped, heights, photo_h, photo_h >= photo_min

    # Uzun metinlerde sayfa taşmasın diye sırasıyla daha sıkı planlar denenir.
    for reason_cap, extra_cap, photo_min in ((2, 3, 150), (2, 3, 100), (1, 3, 90), (1, 2, 80), (1, 1, 60)):
        reason_lines, reason_rows, extra_wrapped, extra_heights, photo_box_h, fits = plan(reason_cap, extra_cap, photo_min)
        if fits:
            break
    raw_photo_h = photo_box_h
    photo_box_h = max(60.0, min(raw_photo_h, 330.0))
    if not _image_list(scrap, "before") and not _image_list(scrap, "after"):
        # İki tarafta da fotoğraf yoksa boş kutular sayfayı kaplamasın.
        photo_box_h = min(photo_box_h, 95.0)
    photo_gap = 6
    photo_w = (CONTENT_W - photo_gap) / 2
    # Kutular görselin en-boy oranına yaklaştırılır; böylece içeride boş alan kalmaz.
    aspect_heights = []
    for side in ("before", "after"):
        side_images = _image_list(scrap, side)
        reader = _image_reader(side_images[0]) if side_images else None
        if reader:
            try:
                image_w, image_h = reader.getSize()
                aspect_heights.append((photo_w - 6) * image_h / max(image_w, 1) + 6)
            except Exception:
                continue
    if aspect_heights:
        photo_box_h = min(photo_box_h, max(aspect_heights))
    photo_box_h = max(60.0, photo_box_h)
    # Fotoğraf kutusu üst sınıra takıldıysa artan boşluk bloklar arasına eşit dağıtılır.
    gap = 7 + max(0.0, min(26.0, (raw_photo_h - photo_box_h) / 4))

    # ---------- Fotoğraf kutuları ----------
    before_images = _image_list(scrap, "before")
    after_images = _image_list(scrap, "after")
    for index, (caption, images) in enumerate((("RESİM-1", before_images), ("RESİM-2", after_images))):
        box_x = MARGIN_X + index * (photo_w + photo_gap)
        pdf.setFont(bold, 7.4)
        pdf.setFillColorRGB(*label_ink)
        pdf.drawString(box_x + 2, y - 9, caption)
        if len(images) > 1:
            pdf.setFont(regular, 6.6)
            pdf.drawRightString(box_x + photo_w - 2, y - 9, f"1 / {len(images)} fotoğraf")
        box_top = y - caption_h
        pdf.setStrokeColorRGB(*line_color)
        pdf.setLineWidth(0.7)
        pdf.rect(box_x, box_top - photo_box_h, photo_w, photo_box_h, stroke=1, fill=0)
        reader = _image_reader(images[0]) if images else None
        if reader:
            try:
                image_w, image_h = reader.getSize()
                ratio = min((photo_w - 6) / image_w, (photo_box_h - 6) / image_h)
                draw_w, draw_h = image_w * ratio, image_h * ratio
                pdf.drawImage(reader, box_x + (photo_w - draw_w) / 2, box_top - photo_box_h + (photo_box_h - draw_h) / 2, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
            except Exception:
                pass
        else:
            pdf.setFont(regular, 7.4)
            pdf.setFillColorRGB(*label_ink)
            pdf.drawCentredString(box_x + photo_w / 2, box_top - photo_box_h / 2, "Fotoğraf eklenmemiş")
    y = y - caption_h - photo_box_h - gap

    # ---------- Kırılma sebebi ----------
    pdf.setFillColorRGB(*band)
    pdf.setStrokeColorRGB(*line_color)
    pdf.rect(MARGIN_X, y - section_h, CONTENT_W, section_h, stroke=1, fill=1)
    pdf.setFillColorRGB(*ink)
    pdf.setFont(bold, 8.2)
    pdf.drawCentredString(PAGE_W / 2, y - 10.5, "KIRILMA SEBEBİ - UYARILAR - ÖNLEMLER")
    y -= section_h
    reason_area_top = y
    reason_area_h = reason_rows * 13
    pdf.setStrokeColorRGB(*line_color)
    pdf.rect(MARGIN_X, reason_area_top - reason_area_h, CONTENT_W, reason_area_h, stroke=1, fill=0)
    line_cursor = reason_area_top - 9
    for line in reason_lines:
        pdf.setFont(regular, 8.2)
        pdf.setFillColorRGB(*ink)
        pdf.drawString(MARGIN_X + 6, line_cursor, line)
        line_cursor -= 11.5
    for row_index in range(1, reason_rows):
        rule_y = reason_area_top - row_index * 13
        pdf.setStrokeColorRGB(0.72, 0.76, 0.82)
        pdf.setLineWidth(0.4)
        pdf.line(MARGIN_X, rule_y, MARGIN_X + CONTENT_W, rule_y)
    y = reason_area_top - reason_area_h - gap

    # ---------- Ek bilgiler (formda doldurulan diğer alanlar) ----------
    pdf.setFillColorRGB(*band)
    pdf.setStrokeColorRGB(*line_color)
    pdf.setLineWidth(0.7)
    pdf.rect(MARGIN_X, y - section_h, CONTENT_W, section_h, stroke=1, fill=1)
    pdf.setFillColorRGB(*ink)
    pdf.setFont(bold, 8.2)
    pdf.drawCentredString(PAGE_W / 2, y - 10.5, "EK BİLGİLER - FORMDA DOLDURULAN DİĞER ALANLAR")
    y -= section_h
    for (label, _value), lines, row_h in zip(extra_rows, extra_wrapped, extra_heights):
        pdf.setStrokeColorRGB(*line_color)
        pdf.setLineWidth(0.6)
        pdf.rect(MARGIN_X, y - row_h, CONTENT_W, row_h, stroke=1, fill=0)
        pdf.line(MARGIN_X + extra_label_w, y - row_h, MARGIN_X + extra_label_w, y)
        pdf.setFont(bold, 6.8)
        pdf.setFillColorRGB(*label_ink)
        label_lines = _clip(_wrap(label, bold, 6.8, extra_label_w - 10), 2)
        for line_index, line in enumerate(label_lines):
            pdf.drawString(MARGIN_X + 5, y - 10 - line_index * 9, line)
        pdf.setFont(regular, extra_font_size)
        pdf.setFillColorRGB(*ink)
        for line_index, line in enumerate(lines):
            pdf.drawString(MARGIN_X + extra_label_w + 6, y - 10 - line_index * 9.6, line)
        y -= row_h
    y -= gap

    # ---------- İmza bloğu ----------
    signature_y = max(y - signature_h, BOTTOM_LIMIT + footer_h)
    pdf.setStrokeColorRGB(*line_color)
    pdf.setLineWidth(0.7)
    pdf.rect(MARGIN_X, signature_y, CONTENT_W, signature_h, stroke=1, fill=0)
    column_w = CONTENT_W / 3
    for index in range(1, 3):
        pdf.line(MARGIN_X + index * column_w, signature_y, MARGIN_X + index * column_w, signature_y + signature_h)
    prepared_name = _text(scrap.get("prepared_by"), "Abdullah Tetik")
    operator_name = _text(scrap.get("operator_name"))
    if operator_name and prepared_name.casefold() == operator_name.casefold():
        prepared_name = "Abdullah Tetik"
    signature_values = [
        ("HAZIRLAYAN", prepared_name),
        ("FORMEN", _text(scrap.get("foreman_name"), "Celal")),
        ("ONAYLAYAN", _text(scrap.get("approved_by"), "-")),
    ]
    for index, (label, value) in enumerate(signature_values):
        center_x = MARGIN_X + column_w * index + column_w / 2
        pdf.setFont(bold, 7.4)
        pdf.setFillColorRGB(*label_ink)
        pdf.drawCentredString(center_x, signature_y + signature_h - 12, label)
        pdf.setFont(regular, 8.4)
        pdf.setFillColorRGB(*ink)
        pdf.drawCentredString(center_x, signature_y + signature_h - 26, _clip(_wrap(value, regular, 8.4, column_w - 12), 1)[0])

    # ---------- Alt bilgi ----------
    pdf.setStrokeColorRGB(*line_color)
    pdf.setLineWidth(0.6)
    pdf.line(MARGIN_X, BOTTOM_LIMIT - 4, PAGE_W - MARGIN_X, BOTTOM_LIMIT - 4)
    pdf.setFont(regular, 6.6)
    pdf.setFillColorRGB(*label_ink)
    document_label = f"{_text(scrap.get('document_no'), 'T4.000')} / R.{_text(scrap.get('document_revision'), '00')}"
    pdf.drawString(MARGIN_X, BOTTOM_LIMIT - 14, document_label)
    record_no = _text(scrap.get("record_no"))
    if record_no:
        pdf.drawCentredString(PAGE_W / 2, BOTTOM_LIMIT - 14, f"Tutanak No: {record_no}")
    pdf.drawRightString(PAGE_W - MARGIN_X, BOTTOM_LIMIT - 14, "Sayfa 1 / 1")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
