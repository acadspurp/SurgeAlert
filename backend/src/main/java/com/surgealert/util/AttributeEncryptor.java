package com.surgealert.util;

import com.surgealert.config.SurgeEncryptionEnvironmentPostProcessor;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-128 encryption at rest for sensitive string columns (e.g. phone numbers).
 * Secret resolution: {@link SurgeEncryptionEnvironmentPostProcessor}, env, or default.
 * If decryption fails (legacy plaintext in DB), the stored value is returned as-is.
 * A new {@link Cipher} is used per conversion ({@link Cipher} is not thread-safe).
 */
@Component
@Converter(autoApply = false)
public class AttributeEncryptor implements AttributeConverter<String, String> {

    private static final String AES = "AES";

    private final Key key;

    public AttributeEncryptor() {
        this.key = new SecretKeySpec(normalizeKey(resolveSecretRaw()), AES);
    }

    private static String resolveSecretRaw() {
        String p = System.getProperty(SurgeEncryptionEnvironmentPostProcessor.PROPERTY);
        if (p != null && !p.isBlank()) {
            return p;
        }
        String e = System.getenv("SURGE_ENCRYPTION_SECRET");
        if (e != null && !e.isBlank()) {
            return e;
        }
        return "SurgeAlertSecret";
    }

    private static byte[] normalizeKey(String raw) {
        String s = (raw != null && !raw.isBlank()) ? raw : "SurgeAlertSecret";
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[16];
        System.arraycopy(b, 0, out, 0, Math.min(b.length, 16));
        if (b.length < 16) {
            Arrays.fill(out, b.length, 16, (byte) 0);
        }
        return out;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(AES);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            return Base64.getEncoder().encodeToString(
                    cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(AES);
            cipher.init(Cipher.DECRYPT_MODE, key);
            return new String(cipher.doFinal(Base64.getDecoder().decode(dbData)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Not valid Base64 / AES payload (e.g. old plaintext phone before encryption)
            return dbData;
        }
    }
}
