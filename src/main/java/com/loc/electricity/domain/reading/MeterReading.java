package com.loc.electricity.domain.reading;

import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "meter_reading",
        uniqueConstraints = @UniqueConstraint(columnNames = {"period_id", "customer_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeterReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private BillingPeriod period;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "previous_index", nullable = false)
    private int previousIndex;

    @Column(name = "current_index", nullable = false)
    private int currentIndex;

    // STORED GENERATED column in MySQL — JPA never writes this; DB computes it.
    // In H2 tests this is a plain INT column updated manually.
    @Column(insertable = false, updatable = false)
    private Integer consumption;

    @Column(name = "reading_photo_url", length = 500)
    private String readingPhotoUrl;

    // NULL means this reading has not yet been submitted by METER_READER.
    @Column(name = "read_at")
    private LocalDateTime readAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "read_by")
    private User readBy;

    @Column(name = "warning", length = 500)
    private String warning;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Computes consumption from the submitted meter indices.
     * <p>
     * Note: the {@code consumption} column is a STORED GENERATED column in MySQL
     * (computed by the DB as {@code current_index - previous_index}).
     * This method provides the same calculation in-memory for use before the entity
     * is persisted or when running against H2 in tests.
     *
     * @return {@code currentIndex - previousIndex}
     */
    public int computedConsumption() {
        return currentIndex - previousIndex;
    }
}
