package com.surgealert.service;

import com.surgealert.util.PhoneNormalizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@Service
public class PhoneSearchHashService {

    private final byte[] macKey;

    public PhoneSearchHashService(
            @Value("${surgealert.phone-hash.secret:}") String dedicatedSecret,
            @Value("${surgealert.encryption.secret:SurgeAlertSecret}") String fallbackSecret) {
        String src = (dedicatedSecret != null && !dedicatedSecret.isBlank()) ? dedicatedSecret : fallbackSecret;
        this.macKey = src.getBytes(StandardCharsets.UTF_8);
    }

    public String hashNormalized(String normalizedPhone) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(macKey, "HmacSHA256"));
            byte[] out = mac.doFinal(normalizedPhone.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public String hashRaw(String rawPhone) {
        return hashNormalized(PhoneNormalizer.normalize(rawPhone));
    }
}
