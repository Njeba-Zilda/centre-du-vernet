package cm.duala.vernet.user.api;

import cm.duala.vernet.auth.security.SecurityUtil;
import cm.duala.vernet.planning.AppointmentRepository;
import cm.duala.vernet.user.AppUser;
import cm.duala.vernet.user.AppUserRepository;
import cm.duala.vernet.user.UserRole;
import cm.duala.vernet.weight.WeightEntryRepository;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/users")
public class DossierPdfController {

    private final AppUserRepository      users;
    private final WeightEntryRepository  weights;
    private final AppointmentRepository  appts;

    private static final DeviceRgb ACCENT = new DeviceRgb(200, 0, 94);

    public DossierPdfController(AppUserRepository users, WeightEntryRepository weights,
                                AppointmentRepository appts) {
        this.users   = users;
        this.weights = weights;
        this.appts   = appts;
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','SECRETARY','COACH','NUTRITIONIST') or hasRole('CLIENT')")
    @GetMapping("/{id}/dossier/pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id) throws Exception {
        AppUser me = SecurityUtil.requireUser();
        if (me.getRole() == UserRole.CLIENT && !me.getId().equals(id))
            return ResponseEntity.status(403).build();

        AppUser client = users.findById(id).orElse(null);
        if (client == null) return ResponseEntity.notFound().build();

        var weightList = weights.findByClientOrderByDateAsc(client);
        var apptList   = appts.findByClientOrderByScheduledAtAsc(client);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(out);
        PdfDocument pdf  = new PdfDocument(writer);
        Document doc     = new Document(pdf);

        // ── En-tête ──
        doc.add(new Paragraph("Centre du Vernet — Dossier client")
            .setFontSize(18).setBold().setFontColor(ACCENT).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Agréé Méthode Laurand — Douala, Cameroun")
            .setFontSize(10).setFontColor(ColorConstants.GRAY).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph(" "));

        // ── Identité ──
        String name = ((client.getFirstName() != null ? client.getFirstName() : "") + " "
            + (client.getLastName() != null ? client.getLastName() : "")).trim();
        doc.add(section("Informations personnelles"));
        Table infoTable = new Table(UnitValue.createPercentArray(new float[]{3, 5})).useAllAvailableWidth();
        addRow(infoTable, "Nom complet", name.isEmpty() ? client.getEmail() : name);
        addRow(infoTable, "Email", client.getEmail());
        addRow(infoTable, "Téléphone", client.getPhone() != null ? client.getPhone() : "—");
        addRow(infoTable, "Sexe", "F".equals(client.getGender()) ? "Femme" : "M".equals(client.getGender()) ? "Homme" : "—");
        if (client.getDateOfBirth() != null) {
            int age = java.time.Period.between(client.getDateOfBirth(), java.time.LocalDate.now()).getYears();
            addRow(infoTable, "Date de naissance", client.getDateOfBirth().toString());
            addRow(infoTable, "Âge", age + " ans");
        }
        addRow(infoTable, "Membre depuis", client.getCreatedAt() != null ? client.getCreatedAt().toString().substring(0, 10) : "—");
        if (client.getTargetWeightKg() != null) addRow(infoTable, "Objectif", client.getTargetWeightKg() + " kg"
            + (client.getTargetDate() != null ? " avant le " + client.getTargetDate() : ""));
        doc.add(infoTable);
        doc.add(new Paragraph(" "));

        // ── Suivi poids ──
        doc.add(section("Suivi poids & mesures (" + weightList.size() + " mesures)"));
        if (!weightList.isEmpty()) {
            Table wt = new Table(UnitValue.createPercentArray(new float[]{2,2,2,2,2,2,3})).useAllAvailableWidth();
            for (String h : new String[]{"Date","Poids (kg)","Taille (cm)","IMC","Tour taille","Tour hanches","Notes"})
                wt.addHeaderCell(new Cell().add(new Paragraph(h).setBold().setFontSize(9)).setBackgroundColor(ACCENT).setFontColor(ColorConstants.WHITE));
            DateTimeFormatter df = DateTimeFormatter.ofPattern("dd/MM/yyyy");
            for (var e : weightList) {
                Double bmi = null;
                if (e.getHeightCm() != null && e.getHeightCm() > 0) {
                    double h = e.getHeightCm() / 100.0;
                    bmi = Math.round((e.getWeightKg() / (h * h)) * 10.0) / 10.0;
                }
                wt.addCell(cell(e.getDate().format(df)));
                wt.addCell(cell(String.valueOf(e.getWeightKg())));
                wt.addCell(cell(e.getHeightCm() != null ? String.valueOf(e.getHeightCm()) : "—"));
                wt.addCell(cell(bmi != null ? String.valueOf(bmi) : "—"));
                wt.addCell(cell(e.getWaistCm()  != null ? e.getWaistCm() + " cm" : "—"));
                wt.addCell(cell(e.getHipsCm()   != null ? e.getHipsCm()  + " cm" : "—"));
                wt.addCell(cell(e.getNotes() != null ? e.getNotes() : ""));
            }
            doc.add(wt);
        } else {
            doc.add(new Paragraph("Aucune mesure enregistrée.").setFontColor(ColorConstants.GRAY));
        }
        doc.add(new Paragraph(" "));

        // ── Rendez-vous ──
        doc.add(section("Rendez-vous (" + apptList.size() + ")"));
        if (!apptList.isEmpty()) {
            Table at = new Table(UnitValue.createPercentArray(new float[]{3,2,2,4})).useAllAvailableWidth();
            for (String h : new String[]{"Date","Type","Statut","Notes"})
                at.addHeaderCell(new Cell().add(new Paragraph(h).setBold().setFontSize(9)).setBackgroundColor(ACCENT).setFontColor(ColorConstants.WHITE));
            for (var a : apptList) {
                at.addCell(cell(a.getScheduledAt() != null ? a.getScheduledAt().toString().replace("T", " ").substring(0, 16) : "—"));
                at.addCell(cell(a.getType() != null ? a.getType() : "—"));
                at.addCell(cell(a.getStatus() != null ? a.getStatus() : "—"));
                at.addCell(cell(a.getNotes() != null ? a.getNotes() : ""));
            }
            doc.add(at);
        } else {
            doc.add(new Paragraph("Aucun rendez-vous.").setFontColor(ColorConstants.GRAY));
        }

        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Document généré le " + java.time.LocalDate.now())
            .setFontSize(9).setFontColor(ColorConstants.GRAY).setTextAlignment(TextAlignment.RIGHT));

        doc.close();

        String filename = "dossier-" + (name.isEmpty() ? client.getEmail().split("@")[0] : name.replace(" ", "-")) + ".pdf";
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(out.toByteArray());
    }

    private Paragraph section(String title) {
        return new Paragraph(title).setFontSize(13).setBold().setFontColor(ACCENT)
            .setMarginTop(8).setMarginBottom(4);
    }

    private Cell cell(String text) {
        return new Cell().add(new Paragraph(text != null ? text : "").setFontSize(9)).setPadding(4);
    }

    private void addRow(Table t, String label, String value) {
        t.addCell(new Cell().add(new Paragraph(label).setBold().setFontSize(10)).setBackgroundColor(new DeviceRgb(245, 245, 250)));
        t.addCell(new Cell().add(new Paragraph(value).setFontSize(10)));
    }
}
