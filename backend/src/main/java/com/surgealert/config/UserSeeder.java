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
        User headAdmin = userRepository.findByUsername("head_admin").orElse(new User());
        if (headAdmin.getId() == null) {
            headAdmin.setUsername("head_admin");
            headAdmin.setRole("HEAD_ADMIN");
            headAdmin.setFullName("Head Administrator");
        }
        
        // Always reset password in demo/seeding mode to ensure accessibility
        headAdmin.setPassword(passwordEncoder.encode("headadmin"));
        userRepository.save(headAdmin);
        System.out.println("SUCCESS: head_admin User (re)seeded into Database with password 'headadmin'.");
    }
}
