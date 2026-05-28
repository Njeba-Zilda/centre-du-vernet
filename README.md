# Centre du Vernet — Agree Méthode Laurand

Application web de **suivi et maintien d’amaigrissement** (Centre du Vernet, Douala — Cameroun).

## Modules (cahier des charges)
- **Comptes & rôles**: super-admin, secrétaire, coach, nutritionniste, client
- **Authentification sécurisée + 2FA (TOTP)**
- **Dossier client / dossier médical**
- **RDV & consultations** + rappels
- **Programmes alimentaires & sportifs**
- **Messagerie coach↔client** + envoi de documents
- **Notifications**: in-app + email
- **Rapports & statistiques** + export PDF
- **Catalogue** (uploads) + **templates A4** pré-design (style “gai”)

## Structure
- `backend/` — API Java Spring Boot
- `frontend/` — React (Vite)
- `toutes_les_photos_et_logos/` — médias (logos, etc.)

## Démarrage (dev)

### Back
```bash
cd backend
.\gradlew bootRun
```

### Front
```bash
cd frontend
npm install
npm run dev
```

## Notes
- Horaires Centre du Vernet: **07:00–17:00**
- Localisation: **Douala (Cameroun)**

