package com.loc.electricity.infrastructure.pdf;

import com.lowagie.text.Document;
import com.lowagie.text.pdf.PdfCopy;
import com.lowagie.text.pdf.PdfReader;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrintPackService {

    private final BillRepository billRepository;
    private final FileStorageService fileStorageService;

    /** Merges all bill PDFs for a period into a single PDF byte array. */
    public byte[] generatePrintPack(Long periodId) {
        List<Bill> bills = billRepository.findAllByPeriodId(periodId)
                .stream()
                .filter(b -> b.getPdfUrl() != null)
                .sorted((a, b) -> a.getCustomer().getCode().compareTo(b.getCustomer().getCode()))
                .toList();

        if (bills.isEmpty()) {
            throw new IllegalStateException("No generated PDFs found for period " + periodId);
        }

        Document merged = new Document();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            PdfCopy copy = new PdfCopy(merged, baos);
            merged.open();

            for (Bill bill : bills) {
                try {
                    byte[] pdfBytes = fileStorageService.load(bill.getPdfUrl());
                    PdfReader reader = new PdfReader(pdfBytes);
                    for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                        copy.addPage(copy.getImportedPage(reader, page));
                    }
                    reader.close();
                } catch (Exception e) {
                    log.warn("Skipping bill {} in print-pack: {}", bill.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Print-pack generation failed for period " + periodId, e);
        } finally {
            if (merged.isOpen()) merged.close();
        }
        return baos.toByteArray();
    }
}
