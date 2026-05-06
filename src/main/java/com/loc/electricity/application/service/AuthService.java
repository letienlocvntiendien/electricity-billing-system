package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.request.LoginRequest;
import com.loc.electricity.application.dto.response.LoginResponse;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import com.loc.electricity.interfaces.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        UserDetails userDetails = (UserDetails) auth.getPrincipal();
        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();

        String accessToken = jwtTokenProvider.generateAccessToken(userDetails);

        eventPublisher.publishEvent(new AuditEvent(this, AuditAction.LOGIN,
                "User", user.getId(), null, null, user));

        return new LoginResponse(accessToken, user.getUsername(), user.getFullName(), user.getRole().name());
    }
}
