package com.surgealert.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final EdgeSyncApiKeyInterceptor edgeSyncApiKeyInterceptor;

    public WebMvcConfig(EdgeSyncApiKeyInterceptor edgeSyncApiKeyInterceptor) {
        this.edgeSyncApiKeyInterceptor = edgeSyncApiKeyInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(edgeSyncApiKeyInterceptor)
                .addPathPatterns("/api/edge/sync/**");
    }
}
