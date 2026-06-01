package cm.duala.vernet.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "app_user")
public class AppUser {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private String email;

	@Column(nullable = false)
	private String passwordHash;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private UserRole role;

	@Column(nullable = false)
	private boolean enabled = true;

	/**
	 * Base32 secret used for TOTP 2FA.
	 * When null/blank: 2FA not enrolled yet.
	 */
	@Column(length = 128)
	private String totpSecret;

	@Column(length = 100)
	private String firstName;

	@Column(length = 100)
	private String lastName;

	@Column(length = 10)
	private String gender;

	@Column(length = 20)
	private String phone;

	private java.time.LocalDate dateOfBirth;

	private Double targetWeightKg;
	private java.time.LocalDate targetDate;

	private Instant createdAt = Instant.now();
}

