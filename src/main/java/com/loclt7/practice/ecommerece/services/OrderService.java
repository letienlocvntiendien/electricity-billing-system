package com.loclt7.practice.ecommerece.services;

import com.loclt7.practice.ecommerece.entities.Order;
import com.loclt7.practice.ecommerece.repositories.OrderRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository, EntityManager em) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public void demoNPlusOne() {
        List<Order> orders = orderRepository.findAllWithUsers();
        for (Order order : orders) {
            System.out.println(order.getUser().getFullName());
        }
    }
}
