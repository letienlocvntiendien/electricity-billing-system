package com.loclt7.practice.ecommerece.repositories;

import com.loclt7.practice.ecommerece.entities.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    
}
