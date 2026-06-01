package cm.duala.vernet.notifications;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
	private final ObjectProvider<JavaMailSender> mailSenderProvider;
	private final String from;

	public EmailService(
		ObjectProvider<JavaMailSender> mailSenderProvider,
		@Value("${app.mail.from:${spring.mail.username}}") String from
	) {
		this.mailSenderProvider = mailSenderProvider;
		this.from = from;
	}

	public void send(String to, String subject, String body) {
		JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
		if (mailSender == null) throw new IllegalStateException("Mail sender not configured");

		SimpleMailMessage msg = new SimpleMailMessage();
		msg.setFrom("Centre du Vernet <" + from + ">");
		msg.setTo(to);
		msg.setSubject(subject);
		msg.setText(body);
		mailSender.send(msg);
	}
}

