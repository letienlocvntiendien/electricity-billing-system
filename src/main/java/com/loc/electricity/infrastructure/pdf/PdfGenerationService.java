package com.loc.electricity.infrastructure.pdf;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.infrastructure.storage.FileStorageService;
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
 * Generates A5 portrait bill PDFs using OpenPDF.
 *
 * For Vietnamese character support, place a Unicode font file at:
 *   src/main/resources/fonts/DejaVuSans.ttf
 * Without this file the service falls back to Helvetica (ASCII only).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PdfGenerationService {

    private static final Rectangle A5 = new Rectangle(420f, 595f);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat VND_FMT = NumberFormat.getIntegerInstance(new Locale("vi", "VN"));

    private final FileStorageService fileStorageService;

    /** Generates a bill PDF, saves it to storage, and returns the relative path. */
    public String generateAndStore(Bill bill, String qrUrl) {
        byte[] pdfBytes = generate(bill, qrUrl);
        String relativePath = "pdf/" + bill.getPeriod().getCode() + "/" + bill.getId() + ".pdf";
        return fileStorageService.store(pdfBytes, relativePath);
    }

    public byte[] generate(Bill bill, String qrUrl) {
        Document document = new Document(A5, 28f, 28f, 28f, 28f);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, baos);
            document.open();

            Font titleFont = loadFont(12f, Font.BOLD);
            Font headerFont = loadFont(9f, Font.BOLD);
            Font normalFont = loadFont(9f, Font.NORMAL);
            Font smallFont = loadFont(8f, Font.NORMAL);

            // Title
            Paragraph title = new Paragraph("HÓA ĐƠN TIỀN ĐIỆN", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            Paragraph periodLine = new Paragraph("Kỳ: " + bill.getPeriod().getName(), normalFont);
            periodLine.setAlignment(Element.ALIGN_CENTER);
            periodLine.setSpacingAfter(8f);
            document.add(periodLine);

            // Customer info table
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setWidths(new float[]{3f, 5f});
            infoTable.setSpacingAfter(6f);

            addInfoRow(infoTable, "Khách hàng:", bill.getCustomer().getFullName(), headerFont, normalFont);
            addInfoRow(infoTable, "Mã KH:", bill.getCustomer().getCode(), headerFont, normalFont);
            addInfoRow(infoTable, "Kỳ điện:",
                    bill.getPeriod().getStartDate().format(DATE_FMT)
                            + " – " + bill.getPeriod().getEndDate().format(DATE_FMT),
                    headerFont, normalFont);
            document.add(infoTable);

            // Reading + billing table
            PdfPTable billingTable = new PdfPTable(2);
            billingTable.setWidthPercentage(100);
            billingTable.setWidths(new float[]{5f, 3f});
            billingTable.setSpacingAfter(6f);

            addBillingRow(billingTable, "Tiêu thụ (kWh):", bill.getConsumption() + " kWh", headerFont, normalFont);
            addBillingRow(billingTable, "Đơn giá điện:", formatVnd(bill.getUnitPrice()) + " đ/kWh", headerFont, normalFont);
            addBillingRow(billingTable, "Đơn giá dịch vụ:", formatVnd(bill.getServiceUnitPrice()) + " đ/kWh", headerFont, normalFont);
            addBillingRow(billingTable, "Tiền điện:", formatVnd(bill.getElectricityAmount()) + " đ", headerFont, normalFont);
            addBillingRow(billingTable, "Tiền dịch vụ:", formatVnd(bill.getServiceAmount()) + " đ", headerFont, normalFont);
            document.add(billingTable);

            // Total
            PdfPTable totalTable = new PdfPTable(2);
            totalTable.setWidthPercentage(100);
            totalTable.setWidths(new float[]{5f, 3f});
            totalTable.setSpacingAfter(8f);
            PdfPCell totalLabel = new PdfPCell(new Phrase("TỔNG TIỀN:", loadFont(10f, Font.BOLD)));
            totalLabel.setBorder(Rectangle.TOP);
            totalLabel.setPaddingTop(4f);
            PdfPCell totalValue = new PdfPCell(new Phrase(formatVnd(bill.getTotalAmount()) + " đ", loadFont(10f, Font.BOLD)));
            totalValue.setBorder(Rectangle.TOP);
            totalValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totalValue.setPaddingTop(4f);
            totalTable.addCell(totalLabel);
            totalTable.addCell(totalValue);
            document.add(totalTable);

            // Payment code
            Paragraph payCode = new Paragraph("Mã CK: " + bill.getPaymentCode(), headerFont);
            payCode.setSpacingAfter(4f);
            document.add(payCode);

            // QR code
            if (qrUrl != null) {
                try (InputStream is = URI.create(qrUrl).toURL().openStream()) {
                    byte[] imgBytes = is.readAllBytes();
                    Image qr = Image.getInstance(imgBytes);
                    qr.scaleToFit(100f, 100f);
                    qr.setAlignment(Image.ALIGN_CENTER);
                    document.add(qr);
                } catch (Exception e) {
                    log.warn("Could not embed QR image for bill {}: {}", bill.getId(), e.getMessage());
                    Paragraph qrFallback = new Paragraph("QR: " + qrUrl, smallFont);
                    qrFallback.setAlignment(Element.ALIGN_CENTER);
                    document.add(qrFallback);
                }
            }

        } catch (Exception e) {
            log.error("PDF generation failed for bill {}", bill.getId(), e);
            throw new RuntimeException("PDF generation failed for bill " + bill.getId(), e);
        } finally {
            if (document.isOpen()) document.close();
        }
        return baos.toByteArray();
    }

    private void addInfoRow(PdfPTable t, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell l = new PdfPCell(new Phrase(label, labelFont));
        l.setBorder(Rectangle.NO_BORDER);
        l.setPaddingBottom(2f);
        PdfPCell v = new PdfPCell(new Phrase(value, valueFont));
        v.setBorder(Rectangle.NO_BORDER);
        v.setPaddingBottom(2f);
        t.addCell(l);
        t.addCell(v);
    }

    private void addBillingRow(PdfPTable t, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell l = new PdfPCell(new Phrase(label, labelFont));
        l.setBorder(Rectangle.NO_BORDER);
        l.setPaddingBottom(2f);
        PdfPCell v = new PdfPCell(new Phrase(value, valueFont));
        v.setBorder(Rectangle.NO_BORDER);
        v.setHorizontalAlignment(Element.ALIGN_RIGHT);
        v.setPaddingBottom(2f);
        t.addCell(l);
        t.addCell(v);
    }

    private Font loadFont(float size, int style) {
        try (InputStream is = PdfGenerationService.class.getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (is != null) {
                byte[] fontBytes = is.readAllBytes();
                BaseFont bf = BaseFont.createFont("DejaVuSans.ttf",
                        BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, fontBytes, null);
                return new Font(bf, size, style);
            }
        } catch (Exception e) {
            log.debug("DejaVuSans.ttf not found on classpath, using Helvetica");
        }
        return new Font(Font.HELVETICA, size, style, Color.BLACK);
    }

    private String formatVnd(BigDecimal amount) {
        return VND_FMT.format(amount.longValue());
    }
}
