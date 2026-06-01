package cm.duala.vernet.notifications;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class WhatsAppService {

	private final String fromNumber;

	public WhatsAppService(
		@Value("${app.twilio.account-sid}") String accountSid,
		@Value("${app.twilio.auth-token}") String authToken,
		@Value("${app.twilio.whatsapp-from}") String fromNumber
	) {
		Twilio.init(accountSid, authToken);
		this.fromNumber = fromNumber;
	}

	public void send(String toPhone, String body) {
		Message.creator(
			new PhoneNumber("whatsapp:" + toPhone),
			new PhoneNumber("whatsapp:" + fromNumber),
			body
		).create();
	}
}
