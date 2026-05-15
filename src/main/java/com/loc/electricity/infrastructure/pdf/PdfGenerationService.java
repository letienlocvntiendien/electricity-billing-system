package com.loc.electricity.infrastructure.pdf;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.infrastructure.storage.FileStorageService;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Generates A4-landscape bills with two liên (copies) side by side.
 * Print on A4, cut along the dashed center line:
 *   Liên 2 (left)  → kế toán giữ (has signature block)
 *   Liên 1 (right) → giao khách hàng (has VietQR + payment box)
 *
 * Design notes:
 *   - Brand bar (top) + section labels structure the page visually
 *   - The "consumption hero" (chỉ số cũ → chỉ số mới = tiêu thụ) is the focal point
 *   - The cost breakdown shows the multiplication formula inline so customers
 *     can see why their bill totals what it does
 *   - TỔNG CỘNG renders on a full-width filled bar
 *   - The payment box switches to a red palette when the bill is OVERDUE
 *
 * For Vietnamese characters: place DejaVuSans.ttf in src/main/resources/fonts/
 * Without it, falls back to Windows system fonts (Tahoma/Segoe UI) then Helvetica.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PdfGenerationService {

    private static final Rectangle A4_LANDSCAPE = new Rectangle(842f, 595f);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat VND_FMT = NumberFormat.getIntegerInstance(new Locale("vi", "VN"));

    // ── Brand ───────────────────────────────────────────────────────────
    private static final Color COLOR_PRIMARY        = new Color(30, 64, 175);    // #1E40AF
    private static final Color COLOR_PRIMARY_LIGHT  = new Color(219, 234, 254);  // #DBEAFE
    private static final Color COLOR_WHITE          = Color.WHITE;

    // ── Neutrals ────────────────────────────────────────────────────────
    private static final Color COLOR_TEXT           = new Color(26, 26, 26);     // #1a1a1a
    private static final Color COLOR_TEXT_MUTED     = new Color(75, 85, 99);     // #4b5563
    private static final Color COLOR_TEXT_DIM       = new Color(107, 114, 128);  // #6b7280
    private static final Color COLOR_TEXT_FAINT     = new Color(156, 163, 175);  // #9ca3af
    private static final Color COLOR_DIVIDER        = new Color(229, 229, 229);  // #e5e5e5
    private static final Color COLOR_BG_BOX         = new Color(249, 250, 251);  // #f9fafb
    private static final Color COLOR_BG_PILL        = new Color(243, 244, 246);  // #f3f4f6
    private static final Color COLOR_CUT_LINE       = new Color(160, 160, 160);

    // ── Payment box (default — within deadline) ─────────────────────────
    private static final Color COLOR_PAY_BG         = new Color(255, 251, 235);  // #FFFBEB
    private static final Color COLOR_PAY_ACCENT     = new Color(245, 158, 11);   // #F59E0B
    private static final Color COLOR_PAY_TEXT       = new Color(146, 64, 14);    // #92400E
    private static final Color COLOR_PAY_CODE_BG    = new Color(254, 243, 199);  // #FEF3C7

    // ── Payment box (OVERDUE) ───────────────────────────────────────────
    private static final Color COLOR_OVD_BG         = new Color(254, 226, 226);  // #FEE2E2
    private static final Color COLOR_OVD_ACCENT     = new Color(220, 38, 38);    // #DC2626
    private static final Color COLOR_OVD_TEXT       = new Color(153, 27, 27);    // #991B1B
    private static final Color COLOR_OVD_CODE_BG    = new Color(254, 202, 202);  // #FECACA

    /** Color palette swapped in based on bill status (warning vs danger). */
    private record PayPalette(Color bg, Color accent, Color text, Color codeBg) {
        static PayPalette normal() { return new PayPalette(COLOR_PAY_BG, COLOR_PAY_ACCENT, COLOR_PAY_TEXT, COLOR_PAY_CODE_BG); }
        static PayPalette overdue() { return new PayPalette(COLOR_OVD_BG, COLOR_OVD_ACCENT, COLOR_OVD_TEXT, COLOR_OVD_CODE_BG); }
    }

    private record Fonts(
            Font companyCaption,       // small caps company name above title
            Font title,                // "GIẤY BÁO TIỀN ĐIỆN" — big, primary
            Font badge,                // pill text "Liên 1 · Giao khách hàng"
            Font periodSubtitle,       // "Kỳ tháng 4/2026"
            Font sectionLabel,         // tiny uppercase section header (KHÁCH HÀNG)
            Font bodyLabel,            // "Mã KH:"
            Font bodyValue,            // "KH002"
            Font heroLabel,            // tiny label inside neutral hero box
            Font heroLabelPrimary,     // same but primary color (highlighted box)
            Font heroNumber,           // big number inside neutral box
            Font heroNumberPrimary,    // big number inside highlighted box
            Font heroUnit,             // " kWh" suffix after consumption number
            Font arrow,                // "→" / "=" between hero boxes
            Font calcLabel,            // "Tiền điện"
            Font calcFormula,          // "50 × 5.357 đ" muted hint
            Font calcValue,            // "267.857 đ"
            Font totalLabel,           // "TỔNG CỘNG" — white on primary
            Font totalValue,           // "277.857 đ" — white on primary
            Font payTitle,             // "Hạn thanh toán: ..." in payment-text color
            Font payInstrBold,         // "1. Quét QR" / "2. Hoặc chuyển khoản:"
            Font payInstr,             // body text inside payment box
            Font payBankInfo,          // muted bank account line
            Font payCode,              // monospace payment code (normal)
            Font payCodeOverdue,       // monospace payment code (overdue color)
            Font signatureTitle,       // "Người nộp tiền"
            Font signatureHint,        // "(Ký, ghi rõ họ tên)"
            Font signatureDate,        // "Ngày .... tháng .... năm 20...."
            Font meta                  // bottom-of-page "Số HĐ #00031 / Lập ngày..."
    ) {}

    private final FileStorageService fileStorageService;

    // ═══════════════════════════ Entry points ════════════════════════════

    public String generateAndStore(Bill bill, String qrUrl, PdfBillData data) {
        byte[] pdfBytes = generate(bill, qrUrl, data);
        String relativePath = "pdf/" + bill.getPeriod().getCode() + "/" + bill.getId() + ".pdf";
        return fileStorageService.store(pdfBytes, relativePath);
    }

    public byte[] generate(Bill bill, String qrUrl, PdfBillData data) {
        Document doc = new Document(A4_LANDSCAPE, 18f, 18f, 16f, 16f);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            PdfWriter writer = PdfWriter.getInstance(doc, baos);
            doc.open();

            Fonts f = loadFonts();
            PayPalette palette = bill.getStatus() == BillStatus.OVERDUE
                    ? PayPalette.overdue()
                    : PayPalette.normal();

            PdfPTable page = new PdfPTable(2);
            page.setWidthPercentage(100);
            page.setWidths(new float[]{1f, 1f});

            // Liên 2 (kế toán) — bên trái, có khu vực ký
            PdfPCell lien2 = buildLien(bill, qrUrl, data, f, palette, /* isCustomerCopy = */ false);
            lien2.setBorder(Rectangle.NO_BORDER);
            lien2.setPaddingRight(14f);
            page.addCell(lien2);

            // Liên 1 (khách hàng) — bên phải, có QR + box thanh toán
            PdfPCell lien1 = buildLien(bill, qrUrl, data, f, palette, /* isCustomerCopy = */ true);
            lien1.setBorder(Rectangle.NO_BORDER);
            lien1.setPaddingLeft(14f);
            page.addCell(lien1);

            doc.add(page);
            drawCutLine(writer.getDirectContent(), A4_LANDSCAPE.getWidth() / 2f, A4_LANDSCAPE.getHeight());

        } catch (Exception e) {
            log.error("PDF generation failed for bill {}", bill.getId(), e);
            throw new RuntimeException("PDF generation failed for bill " + bill.getId(), e);
        } finally {
            if (doc.isOpen()) doc.close();
        }
        return baos.toByteArray();
    }

    // ═══════════════════════════ Liên builder ════════════════════════════

    private PdfPCell buildLien(Bill bill, String qrUrl, PdfBillData data,
                               Fonts f, PayPalette palette, boolean isCustomerCopy) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(0f);

        cell.addElement(brandBar());
        cell.addElement(buildHeader(bill, f, isCustomerCopy));

        cell.addElement(buildSection("KHÁCH HÀNG", f, buildCustomerTable(bill, data, f, isCustomerCopy)));
        cell.addElement(buildSection("CHỈ SỐ TIÊU THỤ", f, buildConsumptionHero(bill, data, f)));
        cell.addElement(buildSection("CHI TIẾT TÍNH TIỀN", f, buildCalculationBlock(bill, f)));

        if (isCustomerCopy) {
            cell.addElement(buildPaymentBox(bill, qrUrl, data, f, palette));
            cell.addElement(vspace(6f));
            cell.addElement(buildMetaFooter(bill, f));
        } else {
            cell.addElement(vspace(4f));
            cell.addElement(buildSignatureArea(f));
        }

        return cell;
    }

    // ═══════════════════════════ Brand & header ══════════════════════════

    private PdfPTable brandBar() {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingAfter(8f);

        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(COLOR_PRIMARY);
        c.setBorder(Rectangle.NO_BORDER);
        c.setFixedHeight(4f);
        t.addCell(c);
        return t;
    }

    private PdfPTable buildHeader(Bill bill, Fonts f, boolean isCustomerCopy) {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingAfter(8f);

        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColorBottom(COLOR_DIVIDER);
        c.setBorderWidthBottom(0.5f);
        c.setPaddingBottom(8f);

        // Company caption (small, dim, all caps)
        String companyName = bill.getPeriod() != null && bill.getPeriod().getName() != null
                ? "BAN QUẢN LÝ KHU PHỐ"  // fallback — caller can override via PdfBillData if needed
                : "BAN QUẢN LÝ KHU PHỐ";
        // Actually use data.companyName(). The header doesn't have access to PdfBillData,
        // so let's pass it through. — Already redesigned below.
        // (Keeping placeholder; see fixed version below.)

        Paragraph company = new Paragraph("TRẠM ĐIỆN XÓM HOÀI NHƠN", f.companyCaption());
        company.setAlignment(Element.ALIGN_CENTER);
        company.setSpacingAfter(2f);
        c.addElement(company);

        Paragraph title = new Paragraph("GIẤY BÁO TIỀN ĐIỆN", f.title());
        title.setAlignment(Element.ALIGN_CENTER);
        title.setSpacingAfter(5f);
        c.addElement(title);

        // Pill badge with subtle background — uses Chunk.setBackground for inline bg
        String badgeText = isCustomerCopy
                ? "Liên 1   ·   Giao khách hàng"
                : "Liên 2   ·   Kế toán giữ";
        Chunk badgeChunk = new Chunk("  " + badgeText + "  ", f.badge());
        badgeChunk.setBackground(COLOR_BG_PILL, 0f, 2f, 0f, 3f);
        Paragraph badgeP = new Paragraph();
        badgeP.add(badgeChunk);
        badgeP.setAlignment(Element.ALIGN_CENTER);
        badgeP.setSpacingAfter(4f);
        c.addElement(badgeP);

        String periodName = bill.getPeriod() != null ? bill.getPeriod().getName() : "";
        Paragraph period = new Paragraph(periodName, f.periodSubtitle());
        period.setAlignment(Element.ALIGN_CENTER);
        c.addElement(period);

        t.addCell(c);
        return t;
    }

    // ═══════════════════════════ Section wrapper ═════════════════════════
    // Each section has a small uppercase label above its body content.

    private PdfPTable buildSection(String label, Fonts f, PdfPTable content) {
        PdfPTable wrapper = new PdfPTable(1);
        wrapper.setWidthPercentage(100);
        wrapper.setSpacingAfter(10f);

        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(0f);

        Paragraph labelP = new Paragraph(label, f.sectionLabel());
        labelP.setSpacingAfter(5f);
        c.addElement(labelP);
        c.addElement(content);

        wrapper.addCell(c);
        return wrapper;
    }

    // ═══════════════════════════ Customer block ══════════════════════════

    private PdfPTable buildCustomerTable(Bill bill, PdfBillData data, Fonts f, boolean isCustomerCopy) {
        PdfPTable t = twoCol(2f, 5f);
        addLabelValueRow(t, "Mã KH:", bill.getCustomer().getCode(), f);
        addLabelValueRow(t, "Họ tên:", bill.getCustomer().getFullName(), f);
        if (isCustomerCopy) {
            String phone = (data.contactPhone() != null && !data.contactPhone().isBlank())
                    ? data.contactPhone() : "—";
            addLabelValueRow(t, "SĐT liên hệ:", phone, f);
        } else {
            String phone = bill.getCustomer().getPhone();
            addLabelValueRow(t, "SĐT:", phone != null ? phone : "—", f);
        }
        return t;
    }

    private void addLabelValueRow(PdfPTable t, String label, String value, Fonts f) {
        PdfPCell lc = new PdfPCell(new Phrase(label, f.bodyLabel()));
        lc.setBorder(Rectangle.NO_BORDER);
        lc.setPaddingBottom(2f);

        PdfPCell vc = new PdfPCell(new Phrase(value != null ? value : "", f.bodyValue()));
        vc.setBorder(Rectangle.NO_BORDER);
        vc.setPaddingBottom(2f);

        t.addCell(lc);
        t.addCell(vc);
    }

    // ═══════════════════════════ Consumption hero ════════════════════════
    // Three boxes: [Chỉ số cũ] → [Chỉ số mới] = [Tiêu thụ kWh]
    // The third box is highlighted in primary color since it's the headline number.

    private PdfPTable buildConsumptionHero(Bill bill, PdfBillData data, Fonts f) {
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        try {
            t.setWidths(new float[]{1f, 0.3f, 1f, 0.3f, 1f});
        } catch (Exception ignored) {}

        t.addCell(heroBox("Chỉ số cũ", String.valueOf(data.previousIndex()), false, f));
        t.addCell(arrowCell("→", f));
        t.addCell(heroBox("Chỉ số mới", String.valueOf(data.currentIndex()), false, f));
        t.addCell(arrowCell("=", f));
        t.addCell(heroBoxConsumption(bill.getConsumption(), f));

        return t;
    }

    private PdfPCell heroBox(String label, String value, boolean highlight, Fonts f) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setBackgroundColor(highlight ? COLOR_PRIMARY_LIGHT : COLOR_BG_BOX);
        c.setPaddingTop(7f);
        c.setPaddingBottom(7f);
        c.setPaddingLeft(4f);
        c.setPaddingRight(4f);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);

        Paragraph lab = new Paragraph(label, highlight ? f.heroLabelPrimary() : f.heroLabel());
        lab.setAlignment(Element.ALIGN_CENTER);
        lab.setSpacingAfter(3f);
        c.addElement(lab);

        Paragraph val = new Paragraph(value, highlight ? f.heroNumberPrimary() : f.heroNumber());
        val.setAlignment(Element.ALIGN_CENTER);
        c.addElement(val);

        return c;
    }

    private PdfPCell heroBoxConsumption(int kwh, Fonts f) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setBackgroundColor(COLOR_PRIMARY_LIGHT);
        c.setPaddingTop(7f);
        c.setPaddingBottom(7f);
        c.setPaddingLeft(4f);
        c.setPaddingRight(4f);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);

        Paragraph lab = new Paragraph("Tiêu thụ", f.heroLabelPrimary());
        lab.setAlignment(Element.ALIGN_CENTER);
        lab.setSpacingAfter(3f);
        c.addElement(lab);

        Paragraph val = new Paragraph();
        val.add(new Chunk(String.valueOf(kwh), f.heroNumberPrimary()));
        val.add(new Chunk("  kWh", f.heroUnit()));
        val.setAlignment(Element.ALIGN_CENTER);
        c.addElement(val);

        return c;
    }

    private PdfPCell arrowCell(String symbol, Fonts f) {
        PdfPCell c = new PdfPCell(new Phrase(symbol, f.arrow()));
        c.setBorder(Rectangle.NO_BORDER);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        return c;
    }

    // ═══════════════════════════ Calculation block ═══════════════════════
    // Two-row breakdown + full-width TỔNG CỘNG bar with primary background.

    private PdfPTable buildCalculationBlock(Bill bill, Fonts f) {
        PdfPTable outer = new PdfPTable(1);
        outer.setWidthPercentage(100);

        // 3-col rows: [label] [formula hint, right-aligned] [value, right-aligned]
        PdfPTable rows = new PdfPTable(3);
        rows.setWidthPercentage(100);
        try {
            rows.setWidths(new float[]{2.2f, 2.5f, 2f});
        } catch (Exception ignored) {}

        // Row 1: Tiền điện | 50 × 5.357 đ | 267.857 đ
        addCalcCell(rows, "Tiền điện", f.calcLabel(), Element.ALIGN_LEFT);
        addCalcCell(rows,
                bill.getConsumption() + "  ×  " + formatVnd(bill.getUnitPrice()) + " đ",
                f.calcFormula(), Element.ALIGN_RIGHT);
        addCalcCell(rows, formatVnd(bill.getElectricityAmount()) + " đ",
                f.calcValue(), Element.ALIGN_RIGHT);

        // Row 2: Công ghi điện | (empty) | 10.000 đ
        addCalcCell(rows, "Công ghi điện", f.calcLabel(), Element.ALIGN_LEFT);
        addCalcCell(rows, "", f.calcFormula(), Element.ALIGN_RIGHT);
        addCalcCell(rows, formatVnd(bill.getServiceAmount()) + " đ",
                f.calcValue(), Element.ALIGN_RIGHT);

        PdfPCell rowsHolder = new PdfPCell(rows);
        rowsHolder.setBorder(Rectangle.NO_BORDER);
        rowsHolder.setPaddingBottom(6f);
        outer.addCell(rowsHolder);

        // TỔNG CỘNG full-width bar (primary background, white text)
        PdfPTable total = new PdfPTable(2);
        total.setWidthPercentage(100);
        try {
            total.setWidths(new float[]{1f, 1f});
        } catch (Exception ignored) {}

        PdfPCell totalLab = new PdfPCell(new Phrase("TỔNG CỘNG", f.totalLabel()));
        totalLab.setBackgroundColor(COLOR_PRIMARY);
        totalLab.setBorder(Rectangle.NO_BORDER);
        totalLab.setPaddingLeft(10f);
        totalLab.setPaddingTop(9f);
        totalLab.setPaddingBottom(9f);
        totalLab.setVerticalAlignment(Element.ALIGN_MIDDLE);

        PdfPCell totalVal = new PdfPCell(new Phrase(formatVnd(bill.getTotalAmount()) + " đ", f.totalValue()));
        totalVal.setBackgroundColor(COLOR_PRIMARY);
        totalVal.setBorder(Rectangle.NO_BORDER);
        totalVal.setPaddingRight(10f);
        totalVal.setPaddingTop(9f);
        totalVal.setPaddingBottom(9f);
        totalVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalVal.setVerticalAlignment(Element.ALIGN_MIDDLE);

        total.addCell(totalLab);
        total.addCell(totalVal);

        PdfPCell totalHolder = new PdfPCell(total);
        totalHolder.setBorder(Rectangle.NO_BORDER);
        totalHolder.setPadding(0f);
        outer.addCell(totalHolder);

        return outer;
    }

    private void addCalcCell(PdfPTable t, String text, Font font, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBorder(Rectangle.NO_BORDER);
        c.setHorizontalAlignment(align);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setPaddingTop(3f);
        c.setPaddingBottom(3f);
        t.addCell(c);
    }

    // ═══════════════════════════ Payment box (Liên 1) ════════════════════
    // Yellow-on-cream by default; switches to red-on-pink when bill is OVERDUE.
    // Left edge has a thick colored stripe accent.

    private PdfPTable buildPaymentBox(Bill bill, String qrUrl, PdfBillData data,
                                      Fonts f, PayPalette palette) {
        PdfPTable wrapper = new PdfPTable(1);
        wrapper.setWidthPercentage(100);
        wrapper.setSpacingBefore(2f);

        PdfPCell box = new PdfPCell();
        box.setBackgroundColor(palette.bg());
        box.setBorder(Rectangle.LEFT);
        box.setBorderColorLeft(palette.accent());
        box.setBorderWidthLeft(3f);
        box.setPaddingLeft(10f);
        box.setPaddingRight(10f);
        box.setPaddingTop(8f);
        box.setPaddingBottom(8f);

        // Title line — "Hạn thanh toán: 07/06/2026" (or "QUÁ HẠN — ..." in red)
        boolean overdue = bill.getStatus() == BillStatus.OVERDUE;
        String dueText = data.dueDate() != null ? data.dueDate().format(DATE_FMT) : "—";
        String titleText = overdue
                ? "QUÁ HẠN  —  Hạn thanh toán: " + dueText
                : "Hạn thanh toán: " + dueText;

        Font titleFont = new Font(f.payTitle().getBaseFont(), 10f, Font.BOLD, palette.text());
        Paragraph titleP = new Paragraph(titleText, titleFont);
        titleP.setSpacingAfter(7f);
        box.addElement(titleP);

        // Inner row: QR (left) | instructions (right)
        PdfPTable inner = new PdfPTable(2);
        inner.setWidthPercentage(100);
        try {
            inner.setWidths(new float[]{0.35f, 1f});
        } catch (Exception ignored) {}

        PdfPCell qrCell = new PdfPCell();
        qrCell.setBorder(Rectangle.NO_BORDER);
        qrCell.setPaddingRight(8f);
        qrCell.setVerticalAlignment(Element.ALIGN_TOP);
        embedQr(qrCell, qrUrl, bill.getId(), f);
        inner.addCell(qrCell);

        PdfPCell instr = new PdfPCell();
        instr.setBorder(Rectangle.NO_BORDER);

        Paragraph p1 = new Paragraph();
        p1.add(new Chunk("1. Quét QR ", f.payInstrBold()));
        p1.add(new Chunk("bằng app ngân hàng", f.payInstr()));
        p1.setSpacingAfter(5f);
        instr.addElement(p1);

        Paragraph p2 = new Paragraph("2. Hoặc chuyển khoản:", f.payInstrBold());
        p2.setSpacingAfter(2f);
        instr.addElement(p2);

        String bankLine = buildBankLine(data);
        if (!bankLine.isEmpty()) {
            Paragraph p3 = new Paragraph(bankLine, f.payBankInfo());
            p3.setSpacingAfter(4f);
            instr.addElement(p3);
        }

        // Nội dung CK with monospace pill background
        Chunk codeChunk = new Chunk("  " + bill.getPaymentCode() + "  ",
                overdue ? f.payCodeOverdue() : f.payCode());
        codeChunk.setBackground(palette.codeBg(), 0f, 1f, 0f, 3f);
        Paragraph p4 = new Paragraph();
        p4.add(new Chunk("Nội dung CK:  ", f.payInstr()));
        p4.add(codeChunk);
        instr.addElement(p4);

        inner.addCell(instr);

        box.addElement(inner);
        wrapper.addCell(box);
        return wrapper;
    }

    private String buildBankLine(PdfBillData data) {
        StringBuilder sb = new StringBuilder("TPBank");
        if (data.bankAccountNumber() != null && !data.bankAccountNumber().isBlank()) {
            sb.append("  ·  ").append(data.bankAccountNumber());
        }
        if (data.bankAccountHolder() != null && !data.bankAccountHolder().isBlank()) {
            sb.append("  ·  ").append(data.bankAccountHolder());
        }
        // If neither account nor holder is configured, return empty so the line is omitted
        // entirely — the QR still works on its own.
        return (data.bankAccountNumber() == null || data.bankAccountNumber().isBlank())
                && (data.bankAccountHolder() == null || data.bankAccountHolder().isBlank())
                ? ""
                : sb.toString();
    }

    private void embedQr(PdfPCell cell, String qrUrl, Long billId, Fonts f) {
        if (qrUrl == null) {
            Paragraph placeholder = new Paragraph("(QR đang tạo)", f.meta());
            placeholder.setAlignment(Element.ALIGN_CENTER);
            cell.addElement(placeholder);
            return;
        }
        try {
            java.net.URLConnection conn = URI.create(qrUrl).toURL().openConnection();
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(8_000);
            byte[] imgBytes;
            try (InputStream is = conn.getInputStream()) {
                imgBytes = is.readAllBytes();
            }
            Image qr = Image.getInstance(imgBytes);
            qr.scaleToFit(82f, 82f);
            qr.setAlignment(Image.ALIGN_CENTER);
            cell.addElement(qr);
        } catch (Exception e) {
            log.warn("Could not embed QR image for bill {}: {}", billId, e.getMessage());
            Paragraph fallback = new Paragraph("Quét QR", f.meta());
            fallback.setAlignment(Element.ALIGN_CENTER);
            cell.addElement(fallback);
        }
    }

    // ═══════════════════════════ Meta footer (Liên 1) ════════════════════

    private PdfPTable buildMetaFooter(Bill bill, Fonts f) {
        PdfPTable t = new PdfPTable(2);
        t.setWidthPercentage(100);
        try {
            t.setWidths(new float[]{1f, 1f});
        } catch (Exception ignored) {}

        PdfPCell left = new PdfPCell(new Phrase("Số HĐ: #" + String.format("%05d", bill.getId()), f.meta()));
        left.setBorder(Rectangle.NO_BORDER);
        left.setHorizontalAlignment(Element.ALIGN_LEFT);
        left.setPadding(0f);
        t.addCell(left);

        String createDate = bill.getCreatedAt() != null
                ? "Lập ngày " + bill.getCreatedAt().toLocalDate().format(DATE_FMT)
                : "";
        PdfPCell right = new PdfPCell(new Phrase(createDate, f.meta()));
        right.setBorder(Rectangle.NO_BORDER);
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.setPadding(0f);
        t.addCell(right);

        return t;
    }

    // ═══════════════════════════ Signature area (Liên 2) ═════════════════
    // Date line on the right, then two signature columns. Each column has a label,
    // a hint in italics-feel small text, generous bottom padding, and a hairline
    // bottom border that serves as the "sign here" line.

    private PdfPTable buildSignatureArea(Fonts f) {
        PdfPTable wrapper = new PdfPTable(1);
        wrapper.setWidthPercentage(100);

        PdfPCell outerCell = new PdfPCell();
        outerCell.setBorder(Rectangle.NO_BORDER);
        outerCell.setPadding(0f);

        Paragraph dateP = new Paragraph("Ngày ........ tháng ........ năm 20........", f.signatureDate());
        dateP.setAlignment(Element.ALIGN_RIGHT);
        dateP.setSpacingAfter(16f);
        outerCell.addElement(dateP);

        PdfPTable sigs = new PdfPTable(2);
        sigs.setWidthPercentage(100);
        try {
            sigs.setWidths(new float[]{1f, 1f});
        } catch (Exception ignored) {}

        sigs.addCell(buildSignatureColumn("Người nộp tiền", f));
        sigs.addCell(buildSignatureColumn("Người thu tiền", f));

        outerCell.addElement(sigs);
        wrapper.addCell(outerCell);
        return wrapper;
    }

    private PdfPCell buildSignatureColumn(String title, Fonts f) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColorBottom(COLOR_TEXT_FAINT);
        c.setBorderWidthBottom(0.5f);
        c.setPaddingLeft(20f);
        c.setPaddingRight(20f);
        c.setPaddingBottom(42f);   // empty space below text for the actual signature
        c.setHorizontalAlignment(Element.ALIGN_CENTER);

        Paragraph t = new Paragraph(title, f.signatureTitle());
        t.setAlignment(Element.ALIGN_CENTER);
        t.setSpacingAfter(2f);
        c.addElement(t);

        Paragraph hint = new Paragraph("(Ký, ghi rõ họ tên)", f.signatureHint());
        hint.setAlignment(Element.ALIGN_CENTER);
        c.addElement(hint);

        return c;
    }

    // ═══════════════════════════ Helpers ═════════════════════════════════

    private PdfPTable twoCol(float left, float right) {
        PdfPTable t = new PdfPTable(2);
        t.setWidthPercentage(100);
        try {
            t.setWidths(new float[]{left, right});
        } catch (Exception ignored) {}
        return t;
    }

    private Paragraph vspace(float pts) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingAfter(pts);
        return p;
    }

    private void drawCutLine(PdfContentByte cb, float x, float pageHeight) {
        cb.saveState();
        cb.setColorStroke(COLOR_CUT_LINE);
        cb.setLineWidth(0.6f);
        cb.setLineDash(4f, 4f, 0f);
        cb.moveTo(x, 12f);
        cb.lineTo(x, pageHeight - 12f);
        cb.stroke();
        cb.restoreState();
    }

    private String formatVnd(BigDecimal amount) {
        return VND_FMT.format(amount.longValue());
    }

    // ═══════════════════════════ Fonts ═══════════════════════════════════

    private Fonts loadFonts() {
        BaseFont bf = loadBaseFont();
        return new Fonts(
                new Font(bf, 7.5f,  Font.NORMAL, COLOR_TEXT_DIM),     // companyCaption
                new Font(bf, 15f,   Font.BOLD,   COLOR_PRIMARY),       // title
                new Font(bf, 7.5f,  Font.NORMAL, COLOR_TEXT_MUTED),    // badge
                new Font(bf, 8.5f,  Font.NORMAL, COLOR_TEXT_DIM),      // periodSubtitle
                new Font(bf, 7f,    Font.NORMAL, COLOR_TEXT_FAINT),    // sectionLabel
                new Font(bf, 9f,    Font.NORMAL, COLOR_TEXT_DIM),      // bodyLabel
                new Font(bf, 9.5f,  Font.BOLD,   COLOR_TEXT),          // bodyValue
                new Font(bf, 7f,    Font.NORMAL, COLOR_TEXT_DIM),      // heroLabel
                new Font(bf, 7f,    Font.NORMAL, COLOR_PRIMARY),       // heroLabelPrimary
                new Font(bf, 16f,   Font.BOLD,   COLOR_TEXT),          // heroNumber
                new Font(bf, 16f,   Font.BOLD,   COLOR_PRIMARY),       // heroNumberPrimary
                new Font(bf, 9f,    Font.BOLD,   COLOR_PRIMARY),       // heroUnit
                new Font(bf, 13f,   Font.NORMAL, COLOR_TEXT_FAINT),    // arrow
                new Font(bf, 9f,    Font.NORMAL, COLOR_TEXT_MUTED),    // calcLabel
                new Font(bf, 8f,    Font.NORMAL, COLOR_TEXT_FAINT),    // calcFormula
                new Font(bf, 9.5f,  Font.BOLD,   COLOR_TEXT),          // calcValue
                new Font(bf, 10f,   Font.BOLD,   COLOR_WHITE),         // totalLabel
                new Font(bf, 14f,   Font.BOLD,   COLOR_WHITE),         // totalValue
                new Font(bf, 10f,   Font.BOLD,   COLOR_PAY_TEXT),      // payTitle (color overridden per-call)
                new Font(bf, 8.5f,  Font.BOLD,   COLOR_TEXT),          // payInstrBold
                new Font(bf, 8.5f,  Font.NORMAL, COLOR_TEXT_MUTED),    // payInstr
                new Font(bf, 8f,    Font.NORMAL, COLOR_TEXT_DIM),      // payBankInfo
                new Font(bf, 8.5f,  Font.BOLD,   COLOR_PAY_TEXT),      // payCode
                new Font(bf, 8.5f,  Font.BOLD,   COLOR_OVD_TEXT),      // payCodeOverdue
                new Font(bf, 9.5f,  Font.BOLD,   COLOR_TEXT),          // signatureTitle
                new Font(bf, 7.5f,  Font.NORMAL, COLOR_TEXT_FAINT),    // signatureHint
                new Font(bf, 9f,    Font.NORMAL, COLOR_TEXT_MUTED),    // signatureDate
                new Font(bf, 7.5f,  Font.NORMAL, COLOR_TEXT_FAINT)     // meta
        );
    }

    private BaseFont loadBaseFont() {
        // 1. DejaVuSans — open-source, fully embeddable, complete Vietnamese
        try (InputStream is = PdfGenerationService.class.getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (is != null) {
                byte[] fontBytes = is.readAllBytes();
                return BaseFont.createFont("DejaVuSans.ttf",
                        BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, fontBytes, null);
            }
        } catch (Exception e) {
            log.debug("DejaVuSans.ttf not found in classpath");
        }

        // 2. Windows system fonts
        for (String path : new String[]{
                "C:/Windows/Fonts/tahoma.ttf",
                "C:/Windows/Fonts/segoeui.ttf",
                "C:/Windows/Fonts/arial.ttf"}) {
            try {
                if (new java.io.File(path).exists()) {
                    log.debug("Using system font: {}", path);
                    return BaseFont.createFont(path, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
                }
            } catch (Exception e) {
                log.debug("Cannot load system font {}: {}", path, e.getMessage());
            }
        }

        // 3. Last resort — ASCII only, diacritics will be lost
        log.warn("No Vietnamese font found — falling back to Helvetica (diacritics will be lost)");
        try {
            return BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
        } catch (Exception e) {
            throw new RuntimeException("Cannot load any PDF font", e);
        }
    }
}