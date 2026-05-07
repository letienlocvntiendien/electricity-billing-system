# Add Feature — Architecture Guide

Khi thêm một feature mới vào hệ thống, tuân theo layered architecture sau.

## Backend: thứ tự tạo file

```
1. Domain entity (nếu cần bảng mới)
   → src/main/java/com/loc/electricity/domain/{module}/

2. Flyway migration (nếu có schema change)
   → src/main/resources/db/migration/V{n}__{description}.sql

3. Repository interface
   → src/main/java/com/loc/electricity/infrastructure/persistence/{Entity}Repository.java
   extends JpaRepository<Entity, Long>

4. DTO records
   → application/dto/request/{Action}Request.java   (record, @Valid fields)
   → application/dto/response/{Entity}Response.java (record với static from() method)

5. Service method
   → application/service/{Module}Service.java
   - @Transactional cho write operations
   - Inject User từ SecurityContext qua controller parameter
   - Publish AuditEvent nếu là financial operation

6. Controller endpoint
   → interfaces/web/{Module}Controller.java
   - @PreAuthorize("hasRole('...')") trên method
   - Trả về ResponseEntity<ApiResponse<T>>
   - Lấy current user: @AuthenticationPrincipal UserDetails ud → userRepository.findByUsername(ud.getUsername())
```

## Pattern lấy current user trong controller

```java
@PostMapping("/{id}/some-action")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<ApiResponse<MyResponse>> doSomething(
        @PathVariable Long id,
        @AuthenticationPrincipal UserDetails userDetails) {
    User actor = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
    return ResponseEntity.ok(ApiResponse.ok(MyResponse.from(service.doSomething(id, actor))));
}
```

## Pattern ApiResponse

```java
// Success
ResponseEntity.ok(ApiResponse.ok(data))

// Error (thrown từ service, caught bởi GlobalExceptionHandler)
throw new BusinessException("ERROR_CODE", "message", HttpStatus.BAD_REQUEST);
throw new ResourceNotFoundException("Entity", id);
```

## Frontend: thứ tự cập nhật

```
1. types/api.ts        — thêm interface mới
2. api/{module}.ts     — thêm API call
3. pages/{Module}Page.tsx hoặc components/ — UI
4. AppLayout.tsx       — thêm menu item nếu là trang mới
```

## Pattern API call (frontend)

```typescript
// api/myModule.ts
export const myApi = {
  list: () =>
    client.get<ApiResponse<MyResponse[]>>('/my-endpoint')
      .then(r => r.data.data!),

  create: (data: CreateRequest) =>
    client.post<ApiResponse<MyResponse>>('/my-endpoint', data)
      .then(r => r.data.data!),
}
```

## Conventions

- **Không sửa file entity trực tiếp** nếu cần schema change → luôn tạo Flyway migration mới
- **Không gọi service từ DataInitializer** — save trực tiếp qua repository
- **Luôn publish AuditEvent** cho mọi thao tác tài chính (tạo/sửa bill, payment, period)
- **PeriodWriteGuard.assertWritable(period)** trước mọi write khi period có thể APPROVED/CLOSED
- **@Transactional** cho tất cả service methods có write DB
