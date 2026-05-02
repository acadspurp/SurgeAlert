package com.surgealert.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async // Runs in background
    public void sendAlertEmail(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) {
            return; // Skip if email is empty
        }
        
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("surgealert.system@gmail.com"); // Your email
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            
            mailSender.send(message);
            System.out.println("Email sent successfully to: " + to);
        } catch (Exception e) {
            System.err.println("Failed to send email to " + to + ": " + e.getMessage());
        }
    }
}