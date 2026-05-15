package com.loc.electricity.infrastructure.pdf;

import java.time.LocalDate;

public record PdfBillData(
        String companyName,
        String companyAddress,
        int previousIndex,
        int currentIndex,
        LocalDate dueDate,
        String bankAccountNumber,
        String bankAccountHolder,
        String contactPhone
) {}
