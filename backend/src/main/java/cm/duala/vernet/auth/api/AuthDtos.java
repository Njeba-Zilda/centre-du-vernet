package cm.duala.vernet.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {

	/** Step 1 : envoie un code de vérification sans créer le compte */
	public record PreRegisterRequest(
		@Email @NotBlank String email,
		@NotBlank String password,
		@NotBlank String firstName,
		@NotBlank String lastName,
		@NotBlank String gender,
		@NotBlank String channel,  // "EMAIL" ou "WHATSAPP"
		String phone               // obligatoire si channel == WHATSAPP
	) {}

	public record PreRegisterResponse(String pendingToken, String devCode) {}

	/** Step 2 : valide le code et crée le compte */
	public record RegisterRequest(
		@NotBlank String pendingToken,
		@NotBlank String code
	) {}

	/** Configuration initiale du premier Super Admin (endpoint fermé dès qu'un admin existe) */
	public record SetupRequest(
		@Email @NotBlank String email,
		@NotBlank String password,
		@NotBlank String firstName,
		@NotBlank String lastName,
		@NotBlank String gender
	) {}

	public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

	public record LoginResponse(
		boolean needs2fa,
		String pendingToken,
		String email,
		String devCode
	) {}

	public record Verify2faRequest(@NotBlank String pendingToken, @NotBlank String code) {}

	public record TokenResponse(String accessToken) {}
}
