package com.loc.electricity.interfaces.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.loc.electricity.TestFixtures;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Permission matrix tests: verifies that each role gets the correct HTTP status
 * for representative endpoints. Focus is on 401 (unauthenticated) vs 403 (wrong role)
 * vs 2xx/4xx (correct role, may fail on business logic but not authorization).
 *
 * Uses @Transactional so all DB state is rolled back after each test (no manual teardown).
 * MockMvc requests share the test's thread-local transaction, so users saved in @BeforeEach
 * are visible to Spring Security's UserDetailsService during authentication.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SecurityPermissionTest {

    @Autowired MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Autowired UserRepository userRepository;
    @Autowired BillingPeriodRepository billingPeriodRepository;
    @Autowired CustomerRepository customerRepository;

    private String adminToken;
    private String accountantToken;
    private String meterReaderToken;
    private Long periodId;

    @BeforeEach
    void setUp() throws Exception {
        userRepository.save(TestFixtures.admin());
        userRepository.save(TestFixtures.accountant());
        userRepository.save(TestFixtures.meterReader());


        BillingPeriod period = billingPeriodRepository.save(
                TestFixtures.openPeriod("2026-05", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)));
        period.setStatus(PeriodStatus.CALCULATED);
        billingPeriodRepository.save(period);
        periodId = period.getId();

        adminToken = obtainToken(TestFixtures.admin().getUsername());
        accountantToken = obtainToken(TestFixtures.accountant().getUsername());
        meterReaderToken = obtainToken(TestFixtures.meterReader().getUsername());
    }

    // ── Unauthenticated ───────────────────────────────────────────────────────

    @Test
    void shouldReturn401WhenNoTokenOnProtectedEndpoint() throws Exception {
        mockMvc.perform(get("/api/periods")).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturn200ForLoginWithoutToken() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(TestFixtures.admin().getUsername(), TestFixtures.RAW_PASSWORD)))
                .andExpect(status().isOk());
    }

    // ── GET /api/periods — all roles ─────────────────────────────────────────

    @Test
    void shouldReturn200WhenAdminListsPeriods() throws Exception {
        mockMvc.perform(get("/api/periods").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn200WhenAccountantListsPeriods() throws Exception {
        mockMvc.perform(get("/api/periods").header("Authorization", bearer(accountantToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn200WhenMeterReaderListsPeriods() throws Exception {
        mockMvc.perform(get("/api/periods").header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isOk());
    }

    // ── POST /api/periods — ADMIN only ────────────────────────────────────────

    @Test
    void shouldReturn201WhenAdminCreatesPeriod() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "April 2026",
                "startDate", "2026-04-01",
                "endDate", "2026-04-30",
                "serviceFee", 10000));
        mockMvc.perform(post("/api/periods")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void shouldReturn403WhenAccountantCreatesPeriod() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "April 2026",
                "startDate", "2026-04-01",
                "endDate", "2026-04-30",
                "serviceFee", 10000));
        mockMvc.perform(post("/api/periods")
                        .header("Authorization", bearer(accountantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldReturn403WhenMeterReaderCreatesPeriod() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "April 2026",
                "startDate", "2026-04-01",
                "endDate", "2026-04-30",
                "serviceFee", 10000));
        mockMvc.perform(post("/api/periods")
                        .header("Authorization", bearer(meterReaderToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    // ── POST /api/periods/{id}/approve — ADMIN only ───────────────────────────

    @Test
    void shouldReturn403WhenAccountantApprovesPeriod() throws Exception {
        mockMvc.perform(post("/api/periods/{id}/approve", periodId)
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isForbidden());
    }

    // ── POST /api/periods/{id}/revert — ADMIN only ────────────────────────────

    @Test
    void shouldReturn403WhenAccountantRevertsPeriod() throws Exception {
        mockMvc.perform(post("/api/periods/{id}/revert", periodId)
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isForbidden());
    }

    // ── POST /api/periods/{id}/close — ADMIN only ────────────────────────────

    @Test
    void shouldReturn403WhenAccountantClosesPeriod() throws Exception {
        mockMvc.perform(post("/api/periods/{id}/close", periodId)
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isForbidden());
    }

    // ── POST /api/periods/{id}/calculate — ADMIN and ACCOUNTANT ──────────────

    @Test
    void shouldNotReturn403WhenAccountantCallsCalculate() throws Exception {
        // Period is CALCULATED (wrong state), so we expect 422 — but NOT 403 (forbidden)
        int status = mockMvc.perform(post("/api/periods/{id}/calculate", periodId)
                        .header("Authorization", bearer(accountantToken)))
                .andReturn().getResponse().getStatus();
        org.assertj.core.api.Assertions.assertThat(status).isNotEqualTo(403);
    }

    @Test
    void shouldReturn403WhenMeterReaderCallsCalculate() throws Exception {
        mockMvc.perform(post("/api/periods/{id}/calculate", periodId)
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isForbidden());
    }

    // ── POST /api/periods/{id}/submit-readings — METER_READER only ───────────

    @Test
    void shouldReturn403WhenAccountantSubmitsReadings() throws Exception {
        mockMvc.perform(post("/api/periods/{id}/submit-readings", periodId)
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldNotReturn403WhenMeterReaderSubmitsReadings() throws Exception {
        // Period is CALCULATED (wrong state), so we expect 422 — but NOT 403 (forbidden)
        int status = mockMvc.perform(post("/api/periods/{id}/submit-readings", periodId)
                        .header("Authorization", bearer(meterReaderToken)))
                .andReturn().getResponse().getStatus();
        org.assertj.core.api.Assertions.assertThat(status).isNotEqualTo(403);
    }

    // ── GET /api/bills — ADMIN and ACCOUNTANT, not METER_READER ──────────────

    @Test
    void shouldReturn200WhenAdminGetsBills() throws Exception {
        mockMvc.perform(get("/api/bills").param("periodId", periodId.toString())
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn200WhenAccountantGetsBills() throws Exception {
        mockMvc.perform(get("/api/bills").param("periodId", periodId.toString())
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn403WhenMeterReaderGetsBills() throws Exception {
        mockMvc.perform(get("/api/bills").param("periodId", periodId.toString())
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isForbidden());
    }

    // ── GET /api/payments/unmatched — ADMIN and ACCOUNTANT, not METER_READER ─

    @Test
    void shouldReturn200WhenAdminGetsUnmatchedPayments() throws Exception {
        mockMvc.perform(get("/api/payments/unmatched")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn403WhenMeterReaderGetsUnmatchedPayments() throws Exception {
        mockMvc.perform(get("/api/payments/unmatched")
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isForbidden());
    }

    // ── GET /api/reports/debt — ADMIN and ACCOUNTANT, not METER_READER ────────

    @Test
    void shouldReturn200WhenAdminGetsReport() throws Exception {
        mockMvc.perform(get("/api/reports/debt")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn200WhenAccountantGetsReport() throws Exception {
        mockMvc.perform(get("/api/reports/debt")
                        .header("Authorization", bearer(accountantToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn403WhenMeterReaderGetsReports() throws Exception {
        mockMvc.perform(get("/api/reports/debt")
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isForbidden());
    }

    // ── GET /api/settings — ADMIN and ACCOUNTANT, not METER_READER ───────────

    @Test
    void shouldReturn200WhenAdminGetsSettings() throws Exception {
        mockMvc.perform(get("/api/settings")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn403WhenMeterReaderGetsSettings() throws Exception {
        mockMvc.perform(get("/api/settings")
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isForbidden());
    }

    // ── PATCH /api/settings/{key} — ADMIN only ────────────────────────────────

    @Test
    void shouldReturn403WhenAccountantUpdatesSettings() throws Exception {
        mockMvc.perform(patch("/api/settings/{key}", "overdue_days")
                        .header("Authorization", bearer(accountantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"45\"}"))
                .andExpect(status().isForbidden());
    }

    // ── GET /api/customers — all roles ───────────────────────────────────────

    @Test
    void shouldReturn200WhenMeterReaderListsCustomers() throws Exception {
        mockMvc.perform(get("/api/customers")
                        .header("Authorization", bearer(meterReaderToken)))
                .andExpect(status().isOk());
    }

    // ── POST /api/customers — ADMIN only ─────────────────────────────────────

    @Test
    void shouldReturn403WhenAccountantCreatesCustomer() throws Exception {
        mockMvc.perform(post("/api/customers")
                        .header("Authorization", bearer(accountantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"KH999\",\"fullName\":\"Test\"}"))
                .andExpect(status().isForbidden());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String obtainToken(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(username, TestFixtures.RAW_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Response format: {"success":true,"data":{"accessToken":"...", ...}}
        var responseNode = objectMapper.readTree(body);
        return responseNode.path("data").path("accessToken").asText();
    }

    private String loginBody(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
