package com.surgealert.service;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

@Component
public class CameraImageCache {

    private final AtomicReference<String> latest = new AtomicReference<>("");

    public void setLatestBase64(String base64) {
        latest.set(base64 != null ? base64 : "");
    }

    public String getLatestBase64() {
        return latest.get();
    }
}
