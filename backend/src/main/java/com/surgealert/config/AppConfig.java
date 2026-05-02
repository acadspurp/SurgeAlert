package com.surgealert.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
public class AppConfig {

    private static final String USER_AGENT = "SurgeAlert/1.0 (+https://github.com/acadspurp/SurgeAlert)";

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        ClientHttpRequestInterceptor ua = (request, body, execution) -> {
            if (!request.getHeaders().containsKey(HttpHeaders.USER_AGENT)) {
                request.getHeaders().set(HttpHeaders.USER_AGENT, USER_AGENT);
            }
            return execution.execute(request, body);
        };
        restTemplate.setInterceptors(List.of(ua));
        return restTemplate;
    }
}