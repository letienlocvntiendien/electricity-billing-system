package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.LoginRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.LoginResponse;
import com.loc.electricity.application.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for authentication. Endpoints are publicly accessible (no role required).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * {@code POST /api/auth/login} — Authenticates a user and returns a JWT access token.
     *
     * @param request username and password credentials
     * @return login response containing the access token and user details
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    /**
     * {@code POST /api/auth/logout} — No-op endpoint for client-side token invalidation.
     * Tokens are stateless (8-hour JWT) and expire naturally; this endpoint exists for UX symmetry.
     *
     * @return empty 200 response
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
