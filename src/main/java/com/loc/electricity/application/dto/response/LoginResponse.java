package com.loc.electricity.application.dto.response;

public record LoginResponse(
        String accessToken,
        String tokenType,
        String username,
        String fullName,
        String role
) {
    public LoginResponse(String accessToken, String username, String fullName, String role) {
        this(accessToken, "Bearer", username, fullName, role);
    }
}