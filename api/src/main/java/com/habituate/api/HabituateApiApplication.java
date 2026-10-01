package com.habituate.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HabituateApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(HabituateApiApplication.class, args);
    }
}
