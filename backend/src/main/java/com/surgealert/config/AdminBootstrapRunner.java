package com.surgealert.config;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${surgealert.bootstrap.admin-username:headadmin}")
    private String bootstrapUsername;

    @Value("${surgealert.bootstrap.admin-password:}")
    private String bootstrapPassword;

    public AdminBootstrapRunner(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        if (bootstrapPassword == null || bootstrapPassword.isBlank()) {
            log.warn("No users in database and surgealert.bootstrap.admin-password is empty — set SURGE_BOOTSTRAP_ADMIN_PASSWORD to create the first HEAD_ADMIN.");
            return;
        }
        User u = new User();
        u.setUsername(bootstrapUsername);
        u.setPassword(passwordEncoder.encode(bootstrapPassword));
        u.setFullName("System Head Administrator");
        u.setRole("HEAD_ADMIN");
        userRepository.save(u);
        log.warn("Created initial HEAD_ADMIN user '{}' from bootstrap properties. Change the password immediately.", bootstrapUsername);
    }
}
