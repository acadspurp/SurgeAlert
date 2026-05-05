package com.surgealert.security;

public record AuthenticatedUser(Long id, String username, String role) {}
