package com.surgealert.config;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class UserSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        if (!userRepository.existsByUsername("head_admin")) {
            User headAdmin = new User();
            headAdmin.setUsername("head_admin");
            headAdmin.setPassword(passwordEncoder.encode("headadmin"));
            headAdmin.setRole("HEAD_ADMIN");
            headAdmin.setFullName("Head Administrator");
            userRepository.save(headAdmin);
            System.out.println("SUCCESS: head_admin User seeded into Database.");
        }
    }
}
