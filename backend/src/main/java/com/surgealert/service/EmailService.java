package com.surgealert.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // THIS IS THE UPDATED METHOD THAT ACCEPTS 4 ARGUMENTS
    @Async 
    public void sendAlertEmail(String to, String subject, String body, String base64Image) {
        if (to == null || to.trim().isEmpty()) {
            return; // Skip if email is empty
        }

        try {
            // We use MimeMessage instead of SimpleMailMessage to support HTML and Images
            MimeMessage message = mailSender.createMimeMessage();
            
            // 'true' means multipart (allows attachments/images)
            MimeMessageHelper helper = new MimeMessageHelper(message, true); 
            
            helper.setFrom("surgealert.system@gmail.com"); // Make sure this matches application.properties
            helper.setTo(to);
            helper.setSubject(subject);

            // Create HTML body. If image exists, embed it.
            String htmlBody = "<html><body>"
                    + "<h2>" + subject + "</h2>"
                    + "<p style='font-size: 14px;'>" + body + "</p>";
            
            if (base64Image != null && !base64Image.isEmpty()) {
                htmlBody += "<br><p><b>Live Surveillance Snapshot:</b></p>";
                htmlBody += "<img src='data:image/jpeg;base64," + base64Image + "' style='width:100%; max-width:600px; border: 2px solid #d9534f;'/>";
            }
            
            htmlBody += "</body></html>";
            
            helper.setText(htmlBody, true); // 'true' indicates this is HTML

            mailSender.send(message);
            System.out.println("HTML Email sent successfully to: " + to);

        } catch (Exception e) {
            System.err.println("Failed to send email to " + to + ": " + e.getMessage());
        }
    }
}