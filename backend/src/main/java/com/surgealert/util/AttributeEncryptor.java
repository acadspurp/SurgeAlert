package com.surgealert.util;

import com.surgealert.config.SurgeEncryptionEnvironmentPostProcessor;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-128 for phone numbers at rest. New values use CBC with a random IV (prefix {@code v2:}).
 * Legacy ECB ciphertext (no prefix) is still decrypted for backward compatibility.
 */
@Component
@Converter(autoApply = false)
public class AttributeEncryptor implements AttributeConverter<String, String> {

    private static final String PREFIX_V2 = "v2:";
    private static final String CBC = "AES/CBC/PKCS5Padding";
    private static final String ECB = "AES";

    private final Key key;
    private final SecureRandom secureRandom = new SecureRandom();

    public AttributeEncryptor() {
        this.key = new SecretKeySpec(normalizeKey(resolveSecretRaw()), "AES");
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
            byte[] iv = new byte[16];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(CBC);
            cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(iv));
            byte[] ciphertext = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return PREFIX_V2 + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        if (dbData.startsWith(PREFIX_V2)) {
            try {
                byte[] combined = Base64.getDecoder().decode(dbData.substring(PREFIX_V2.length()));
                if (combined.length < 17) {
                    return dbData;
                }
                byte[] iv = Arrays.copyOfRange(combined, 0, 16);
                byte[] ct = Arrays.copyOfRange(combined, 16, combined.length);
                Cipher cipher = Cipher.getInstance(CBC);
                cipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(iv));
                return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
            } catch (Exception e) {
                return dbData;
            }
        }
        try {
            Cipher cipher = Cipher.getInstance(ECB);
            cipher.init(Cipher.DECRYPT_MODE, key);
            return new String(cipher.doFinal(Base64.getDecoder().decode(dbData)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return dbData;
        }
    }
}
