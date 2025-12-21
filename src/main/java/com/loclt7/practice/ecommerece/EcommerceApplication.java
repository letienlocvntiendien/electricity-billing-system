package com.loclt7.practice.ecommerece;

import com.loclt7.practice.ecommerece.repositories.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@SpringBootApplication
public class EcommerceApplication implements CommandLineRunner {

    private final ProductRepository productRepository;

    public EcommerceApplication(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }


    public static void main(String[] args) {
        SpringApplication.run(EcommerceApplication.class, args);
    }


    @Override
    public void run(String... args) throws Exception {
    }
}
