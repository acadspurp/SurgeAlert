package com.surgealert.security;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class SurgeUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public SurgeUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User u = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        String role = u.getRole() == null ? "USER" : u.getRole().toUpperCase();
        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }
        return org.springframework.security.core.userdetails.User.builder()
                .username(u.getUsername())
                .password(u.getPassword())
                .roles(role)
                .build();
    }
}
