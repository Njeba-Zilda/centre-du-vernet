package cm.duala.vernet.auth.totp;

import org.apache.commons.codec.binary.Base32;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.time.Instant;

@Service
public class TotpService {
	private static final int TIME_STEP_SECONDS = 30;
	private static final int DIGITS = 6;
	private static final String HMAC_ALG = "HmacSHA1";
	private final SecureRandom secureRandom = new SecureRandom();
	private final Base32 base32 = new Base32();

	public String generateBase32Secret() {
		byte[] buffer = new byte[20];
		secureRandom.nextBytes(buffer);
		return base32.encodeToString(buffer).replace("=", "");
	}

	public boolean verifyCode(String base32Secret, String code) {
		if (base32Secret == null || base32Secret.isBlank() || code == null) return false;
		String normalized = code.replace(" ", "").trim();
		if (!normalized.matches("\\d{6}")) return false;

		long timeWindow = Instant.now().getEpochSecond() / TIME_STEP_SECONDS;
		// allow small clock drift: -1,0,+1 windows
		for (long w = timeWindow - 1; w <= timeWindow + 1; w++) {
			String expected = generateCode(base32Secret, w);
			if (expected.equals(normalized)) return true;
		}
		return false;
	}

	private String generateCode(String base32Secret, long timeWindow) {
		try {
			byte[] key = base32.decode(base32Secret);
			byte[] data = ByteBuffer.allocate(8).putLong(timeWindow).array();

			Mac mac = Mac.getInstance(HMAC_ALG);
			mac.init(new SecretKeySpec(key, HMAC_ALG));
			byte[] hash = mac.doFinal(data);

			int offset = hash[hash.length - 1] & 0x0F;
			int binary =
				((hash[offset] & 0x7f) << 24) |
				((hash[offset + 1] & 0xff) << 16) |
				((hash[offset + 2] & 0xff) << 8) |
				(hash[offset + 3] & 0xff);

			int otp = binary % (int) Math.pow(10, DIGITS);
			return String.format("%0" + DIGITS + "d", otp);
		} catch (Exception e) {
			return "";
		}
	}
}

