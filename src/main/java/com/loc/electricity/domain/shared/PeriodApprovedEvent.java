package com.loc.electricity.domain.shared;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PeriodApprovedEvent extends ApplicationEvent {

    private final Long periodId;

    public PeriodApprovedEvent(Object source, Long periodId) {
        super(source);
        this.periodId = periodId;
    }
}
