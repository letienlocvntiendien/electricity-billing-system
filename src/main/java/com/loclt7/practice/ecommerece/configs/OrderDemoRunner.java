package com.loclt7.practice.ecommerece.configs;

import com.loclt7.practice.ecommerece.services.OrderService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class OrderDemoRunner implements ApplicationRunner {

    private final OrderService orderService;

    public OrderDemoRunner(OrderService orderService) {
        this.orderService = orderService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        System.out.println("=== DEMO N+1 START ===");
        orderService.demoNPlusOne();
        System.out.println("=== DEMO N+1 END ===");
    }
}
