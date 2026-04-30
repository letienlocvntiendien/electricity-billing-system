package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.LoginRequest;
import com.loc.electricity.application.dto.request.RefreshTokenRequest;
import com.loc.electricity.application.dto.response.LoginResponse;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.RefreshToken;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.RefreshTokenRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import com.loc.electricity.interfaces.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${app.jwt.refresh-token-expiration-ms}")
    private long refreshTokenExpirationMs;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        UserDetails userDetails = (UserDetails) auth.getPrincipal();
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow();

        String accessToken = jwtTokenProvider.generateAccessToken(userDetails);
        String rawRefreshToken = jwtTokenProvider.generateRefreshToken(userDetails);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(rawRefreshToken)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpirationMs / 1000))
                .build();
        refreshTokenRepository.save(refreshToken);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.LOGIN,
                "User", user.getId(), null, null, user));

        return new LoginResponse(accessToken, rawRefreshToken, user.getUsername(), user.getRole().name());
    }

    @Transactional
    public String refresh(RefreshTokenRequest request) {
        RefreshToken stored = refreshTokenRepository.findByToken(request.refreshToken())
                .orElseThrow(() -> new BusinessException("INVALID_REFRESH_TOKEN",
                        "Refresh token not found", HttpStatus.UNAUTHORIZED));

        if (stored.isRevoked()) {
            throw new BusinessException("REVOKED_REFRESH_TOKEN",
                    "Refresh token has been revoked", HttpStatus.UNAUTHORIZED);
        }
        if (stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("EXPIRED_REFRESH_TOKEN",
                    "Refresh token has expired", HttpStatus.UNAUTHORIZED);
        }

        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(stored.getUser().getUsername())
                .password(stored.getUser().getPasswordHash())
                .roles(stored.getUser().getRole().name())
                .build();

        return jwtTokenProvider.generateAccessToken(userDetails);
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        refreshTokenRepository.findByToken(request.refreshToken())
                .ifPresent(t -> {
                    t.setRevoked(true);
                    refreshTokenRepository.save(t);
                    eventPublisher.publishEvent(new AuditEvent(this, AuditAction.LOGOUT,
                            "User", t.getUser().getId(), null, null, t.getUser()));
                });
    }
}
