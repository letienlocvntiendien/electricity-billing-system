package com.loclt7.practice.ecommerece.repositories;

import com.loclt7.practice.ecommerece.entities.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("SELECT o FROM Order o JOIN FETCH o.user")
    List<Order> findAllWithUsers();
}