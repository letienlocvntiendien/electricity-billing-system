package com.loc.electricity.application.dto.response;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        String username,
        String role
) {
    public LoginResponse(String accessToken, String refreshToken, String username, String role) {
        this(accessToken, refreshToken, "Bearer", username, role);
    }
}
