package cm.duala.vernet.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {
	public record RegisterRequest(
		@Email @NotBlank String email,
		@NotBlank String password,
		@NotBlank String role
	) {}

	public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

	public record LoginResponse(
		boolean needs2fa,
		String pendingToken
	) {}

	public record Verify2faRequest(@NotBlank String pendingToken, @NotBlank String code) {}

	public record TokenResponse(String accessToken) {}
}

