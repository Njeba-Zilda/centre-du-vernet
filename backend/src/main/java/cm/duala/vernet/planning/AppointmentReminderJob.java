package cm.duala.vernet.planning;

import cm.duala.vernet.notifications.EmailService;
import cm.duala.vernet.notifications.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class AppointmentReminderJob {

    private final AppointmentRepository appts;
    private final NotificationService   notifications;
    private final EmailService          emailService;
    private final boolean               emailEnabled;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm");

    public AppointmentReminderJob(
        AppointmentRepository appts,
        NotificationService notifications,
        EmailService emailService,
        @Value("${app.email.enabled:false}") boolean emailEnabled
    ) {
        this.appts         = appts;
        this.notifications = notifications;
        this.emailService  = emailService;
        this.emailEnabled  = emailEnabled;
    }

    // Tourne chaque jour à 08h00
    @Scheduled(cron = "0 0 8 * * *", zone = "Africa/Douala")
    public void sendReminders() {
        LocalDateTime from = LocalDateTime.now().plusHours(20);
        LocalDateTime to   = LocalDateTime.now().plusHours(28);

        List<Appointment> upcoming = appts.findAllByOrderByScheduledAtAsc().stream()
            .filter(a -> "CONFIRMED".equals(a.getStatus()))
            .filter(a -> a.getScheduledAt() != null
                && a.getScheduledAt().isAfter(from)
                && a.getScheduledAt().isBefore(to))
            .toList();

        for (Appointment a : upcoming) {
            if (a.getClient() == null) continue;
            String dateStr = a.getScheduledAt().format(FMT);
            String type    = a.getType() != null ? a.getType() : "Consultation";

            // Notification in-app
            notifications.notifyInApp(
                a.getClient(), "APPOINTMENT_REMINDER",
                "Rappel de rendez-vous",
                "Votre " + type + " est prévu demain le " + dateStr + ".\nCentre du Vernet — Douala"
            );

            // Email si activé
            if (emailEnabled) {
                try {
                    emailService.send(
                        a.getClient().getEmail(),
                        "Rappel — " + type + " demain",
                        "Bonjour,\n\nCeci est un rappel pour votre rendez-vous de demain :\n\n"
                        + type + " — " + dateStr
                        + (a.getNotes() != null ? "\nNotes : " + a.getNotes() : "")
                        + "\n\nCentre du Vernet\nDouala, Bonapriso, Rue 1.042, Villa 162"
                    );
                } catch (Exception ignored) {}
            }
        }
    }
}
