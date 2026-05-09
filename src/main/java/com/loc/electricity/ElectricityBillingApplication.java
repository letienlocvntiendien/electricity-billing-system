package com.loc.electricity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class ElectricityBillingApplication {

    public static void main(String[] args) {
        SpringApplication.run(ElectricityBillingApplication.class, args);
    }
}
