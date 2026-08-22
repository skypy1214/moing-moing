package com.moingmoing.coupon.application;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class CouponQrTokenCipher {
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int INITIALIZATION_VECTOR_LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final String encodedKey;

    CouponQrTokenCipher(@Value("${app.coupon.qr-token-encryption-key:}") String encodedKey) {
        this.encodedKey = encodedKey;
    }

    String encrypt(String rawToken) {
        try {
            byte[] initializationVector = new byte[INITIALIZATION_VECTOR_LENGTH];
            RANDOM.nextBytes(initializationVector);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey(),
                    new GCMParameterSpec(128, initializationVector));
            byte[] encrypted = cipher.doFinal(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    ByteBuffer.allocate(initializationVector.length + encrypted.length)
                            .put(initializationVector)
                            .put(encrypted)
                            .array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Coupon QR token encryption failed.", exception);
        }
    }

    String decrypt(String ciphertext) {
        try {
            byte[] encryptedPayload = Base64.getUrlDecoder().decode(ciphertext);
            if (encryptedPayload.length <= INITIALIZATION_VECTOR_LENGTH) {
                throw new IllegalArgumentException("Coupon QR token is invalid.");
            }
            ByteBuffer buffer = ByteBuffer.wrap(encryptedPayload);
            byte[] initializationVector = new byte[INITIALIZATION_VECTOR_LENGTH];
            buffer.get(initializationVector);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(),
                    new GCMParameterSpec(128, initializationVector));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("Coupon QR token cannot be read.", exception);
        }
    }

    private SecretKey encryptionKey() {
        if (encodedKey.isBlank()) {
            throw new IllegalStateException("QR_TOKEN_ENCRYPTION_KEY is not configured.");
        }
        try {
            byte[] key = Base64.getDecoder().decode(encodedKey);
            if (key.length != 32) {
                throw new IllegalArgumentException("QR token encryption key must be 32 bytes.");
            }
            return new SecretKeySpec(key, "AES");
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("QR_TOKEN_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.",
                    exception);
        }
    }
}
