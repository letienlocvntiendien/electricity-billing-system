package com.loclt7.practice.ecommerece.configs;

import com.loclt7.practice.ecommerece.entities.Order;
import com.loclt7.practice.ecommerece.entities.OrderItem;
import com.loclt7.practice.ecommerece.entities.Product;
import com.loclt7.practice.ecommerece.entities.User;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Component
public class DataInitializer implements ApplicationRunner {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        initData();
    }

    public void initData() {
        User user1 = new User("Nguyen Van A", "a@gmail.com");
        User user2 = new User("Tran Van B", "b@gmail.com");

        em.persist(user1);
        em.persist(user2);

        Product p1 = new Product("iPhone", new BigDecimal("25000"));
        Product p2 = new Product("AirPods", new BigDecimal("5000"));

        em.persist(p1);
        em.persist(p2);

        for (int i = 0; i < 5; i++) {
            Order order = new Order(user1);
            em.persist(order);

            em.persist(new OrderItem(order, p1, 1));
            em.persist(new OrderItem(order, p2, 2));
        }
    }
}