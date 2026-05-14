---
name: electricity-bill-pdf
description: >
  Use this skill whenever the user wants to change, fix, or improve the electricity bill PDF
  in the project at `electricity-billing-system`. Triggers on any request involving:
  - PDF layout, spacing, column widths, margins
  - Adding or removing fields on the bill (e.g., address, notes, stamp)
  - Font sizes, colors, bold/normal weight
  - Vietnamese character issues (boxes, missing diacritics)
  - QR code not showing or misaligned
  - Liên 1 / Liên 2 structure changes
  - Anything about `PdfGenerationService.java` or `PdfBillData.java`
  Always load this skill before touching PDF generation code — it prevents common mistakes
  and gives you the full context of the 2-liên bill format.
---

# Electricity Bill PDF — Project Skill

## Architecture at a glance

| File | Role |
|---|---|
| `src/.../infrastructure/pdf/PdfGenerationService.java` | Renders the PDF — **main file to edit** |
| `src/.../infrastructure/pdf/PdfBillData.java` | Record passed into PDF service (company name, address, meter indices, due date) |
| `src/.../application/service/BillGenerationService.java` | Builds `PdfBillData`, calls PDF service after period is APPROVED |
| `src/main/resources/fonts/DejaVuSans.ttf` | Unicode font for Vietnamese — **must exist** |
| `src/main/resources/db/migration/V8__add_company_settings.sql` | Seeds `company_name` and `company_address` settings |

## Page layout

- **Page**: A4 landscape — `new Rectangle(842f, 595f)` — margins 16pt each side
- **Structure**: `PdfPTable(2)` with equal columns (50/50)
  - Left cell → **Liên 1** (giao khách) — paddingRight 13pt
  - Right cell → **Liên 2** (kế toán giữ) — paddingLeft 13pt
  - Dashed cut line drawn via `PdfContentByte` at `x = 421f`
- Each liên ≈ A5 portrait size (148mm × 210mm) — enough room for all content

## Content per liên

**Liên 1 (customer copy):**
company name → "GIẤY BÁO ĐIỆN" → period → `addSharedBody()` → signature line

**Liên 2 (accountant copy):**
company name → "GIẤY BÁO (THU TIỀN ĐIỆN)" → contact/liên label → period → `addSharedBody()` → due date + payment code + QR code

**`addSharedBody()` (shared by both):**
customer info block → horizontal rule → billing block → total block

## Critical: Vietnamese font setup

**The font file is NOT bundled in the repo** — without it, ALL Vietnamese diacritics (ắ, ế, ọ, etc.) display as boxes or question marks.

### Setup steps

1. Download DejaVuSans.ttf from https://dejavu-fonts.github.io/ (free, open source)
2. Place at: `src/main/resources/fonts/DejaVuSans.ttf`
3. Rebuild: `./mvnw package -DskipTests`

The service's `loadBaseFont()` checks for this file at classpath `/fonts/DejaVuSans.ttf` and falls back to Helvetica (ASCII only) if missing. You'll see this in logs:
```
DEBUG - DejaVuSans.ttf not found, falling back to Helvetica
```

**No code change needed** — just add the font file.

## How to add a field

Fields come from two sources:
- `Bill` entity (consumption, unitPrice, electricityAmount, serviceAmount, totalAmount, paymentCode, paidAmount, status)
- `PdfBillData` record (companyName, companyAddress, previousIndex, currentIndex, dueDate)
- `bill.getCustomer()` (code, fullName, phone, meterSerial)
- `bill.getPeriod()` (name, code, startDate, endDate, approvedAt)

**If the data already exists in the above** → add a line to the relevant block in `buildLien1()` or `buildLien2()` or `infoBlock()` / `billingBlock()`.

**If you need a new data point** (e.g., customer address, account holder name) → add it to `PdfBillData.java` AND update `BillGenerationService.doGenerate()` to populate it.

Example — adding a field to the info block:
```java
// In infoBlock():
addRow(t, "Địa chỉ:", bill.getCustomer().getAddress(), f.label(), f.value());
```

## How to adjust spacing / layout

| What to change | Where |
|---|---|
| Column widths within a block | `twoCol(left, right)` call — e.g., `twoCol(3f, 4f)` |
| Space between sections | `vspace(float pts)` calls in `buildLien1/2` |
| Horizontal rule thickness | `c.setBorderWidthTop(0.5f)` in `rule()` |
| Padding between liên and cut line | `lien1.setPaddingRight(13f)` / `lien2.setPaddingLeft(13f)` in `generate()` |
| Page margins | `new Document(A4_LANDSCAPE, left, right, top, bottom)` |

## Font hierarchy (Fonts record)

```
company  → 10pt Bold          (organization name)
title    → 11pt Bold          (GIẤY BÁO ĐIỆN)
subtitle →  8pt Normal Muted  (contact info, Liên 2 label)
label    →  8.5pt Bold        (field names: Mã KH:, Họ tên:)
value    →  8.5pt Normal      (field values)
small    →  7.5pt Normal Muted (notes, hints, dates)
totalLbl → 10pt Bold          (TỔNG CỘNG:)
totalVal → 10pt Bold Blue     (total amount — COLOR_PRIMARY)
code     →  7.5pt Normal Muted (payment code, long text)
```

To change a font size globally, edit the `loadFonts()` method.
To change a single field's styling, pass a different font to `addRow()` or `addRightRow()`.

## Color constants

```java
COLOR_DIVIDER = new Color(190, 190, 200)  // horizontal rules, borders
COLOR_MUTED   = new Color(100, 100, 110)  // secondary text
COLOR_TOTAL   = new Color(225, 235, 255)  // total row background (light blue)
COLOR_PRIMARY = new Color(30, 64, 175)    // total amount text (dark blue)
```

## Common issues

### QR code not showing
- **Cause 1**: Network timeout fetching from `img.vietqr.io` — check server connectivity
- **Cause 2**: `bill.qrCodeUrl` is null — period wasn't APPROVED or PDF generation didn't complete
- **Fallback**: When QR fails, service logs a WARN and renders the URL as text instead
- **Timeout config**: `conn.setConnectTimeout(5_000)` / `conn.setReadTimeout(8_000)` in `embedQr()`

### Content overflowing / cut off
- Reduce font sizes in `loadFonts()`
- Reduce `vspace()` values between sections
- If infoBlock has many rows, increase A4_LANDSCAPE height or reduce paddingLeft/Right

### Columns uneven / misaligned
- Adjust `twoCol(left, right)` ratios — the numbers are proportional (e.g., `3f, 5f` = 37.5% / 62.5%)
- For the main 50/50 split, the outer `PdfPTable` uses `{1f, 1f}` — don't change this unless switching to different liên proportions

### Vietnamese text shows as boxes (Helvetica fallback)
→ See "Critical: Vietnamese font setup" above

## OpenPDF patterns used in this project

```java
// Add content to a PdfPCell — always use addElement(), not setPhrase()
PdfPCell cell = new PdfPCell();
cell.addElement(someTable);
cell.addElement(someParagraph);

// Draw arbitrary graphics (cut line, borders) — runs AFTER table is added
PdfContentByte cb = writer.getDirectContent();
cb.saveState();
cb.setLineDash(4f, 4f, 0f);
cb.moveTo(x, y1); cb.lineTo(x, y2); cb.stroke();
cb.restoreState();

// Image embedded from URL
Image qr = Image.getInstance(imgBytes);
qr.scaleToFit(85f, 85f);
qr.setAlignment(Image.ALIGN_CENTER);
cell.addElement(qr);
```

`Document.add()` throws `DocumentException` — always wrap in the existing try/catch in `generate()`.

## Regenerating PDFs after code changes

Code changes to `PdfGenerationService` only affect **new** PDF generation. To regenerate existing bills:

1. Navigate to PeriodDetailPage in the frontend
2. Go to tab **Hóa đơn**
3. Click **"Tạo hóa đơn"** (calls `POST /api/periods/{id}/generate-bills`)

Or via curl:
```bash
curl -X POST http://localhost:8080/api/periods/{id}/generate-bills \
  -H "Authorization: Bearer {token}"
```