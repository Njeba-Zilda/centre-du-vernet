#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur du rapport de projet tutoré - Centre du Vernet
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch
import matplotlib.lines as mlines
import numpy as np
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

OUTPUT_DIR = r"c:\Users\User\Documents\Cours Keyce\B2\Projet Tuteure"
IMG_DIR = os.path.join(OUTPUT_DIR, "rapport_images")
os.makedirs(IMG_DIR, exist_ok=True)

# ─────────────────────────────────────────────
# COULEURS CHARTE
# ─────────────────────────────────────────────
VIOLET      = "#1565C0"
VIOLET_LIGHT= "#1976D2"
BLANC       = "#FFFFFF"
GRIS_CLAIR  = "#F5F5F5"
GRIS_BORD   = "#CCCCCC"
NOIR        = "#000000"
BLEU_FONCE  = "#0D47A1"

# ─────────────────────────────────────────────
# HELPERS MATPLOTLIB
# ─────────────────────────────────────────────
def box(ax, x, y, w, h, text, fontsize=8, facecolor=BLANC, edgecolor=VIOLET,
        linewidth=1.5, bold=False, text_color=NOIR, header=None):
    """Dessine un rectangle avec texte centré."""
    rect = mpatches.FancyBboxPatch((x - w/2, y - h/2), w, h,
                                   boxstyle="square,pad=0",
                                   facecolor=facecolor, edgecolor=edgecolor,
                                   linewidth=linewidth, zorder=3)
    ax.add_patch(rect)
    if header:
        # Rectangle d'en-tête coloré
        hrect = mpatches.FancyBboxPatch((x - w/2, y + h/2 - 0.3), w, 0.3,
                                        boxstyle="square,pad=0",
                                        facecolor=VIOLET, edgecolor=edgecolor,
                                        linewidth=linewidth, zorder=4)
        ax.add_patch(hrect)
        ax.text(x, y + h/2 - 0.15, header, ha='center', va='center',
                fontsize=fontsize, fontweight='bold', color=BLANC, zorder=5)
        ax.text(x, y - 0.05, text, ha='center', va='center',
                fontsize=fontsize-1, color=text_color, zorder=5,
                multialignment='center')
    else:
        weight = 'bold' if bold else 'normal'
        ax.text(x, y, text, ha='center', va='center',
                fontsize=fontsize, fontweight=weight, color=text_color, zorder=5,
                multialignment='center')

def arrow(ax, x1, y1, x2, y2, label='', color=NOIR, style='->', lw=1.5, dashed=False):
    """Flèche droite (orthogonale si possible)."""
    ls = '--' if dashed else '-'
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color,
                                lw=lw, linestyle=ls), zorder=4)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx+0.05, my+0.05, label, fontsize=7, color=color, zorder=5)

def line(ax, x1, y1, x2, y2, color=NOIR, lw=1.2, dashed=False):
    ls = '--' if dashed else '-'
    ax.plot([x1, x2], [y1, y2], color=color, lw=lw, linestyle=ls, zorder=3)

def actor(ax, x, y, label, fontsize=8):
    """Acteur UML (bonhomme) sans courbes."""
    # Tête = carré
    rect = mpatches.Rectangle((x-0.15, y+0.15), 0.3, 0.3,
                               facecolor=BLANC, edgecolor=VIOLET, linewidth=1.5, zorder=3)
    ax.add_patch(rect)
    # Corps
    ax.plot([x, x], [y-0.3, y+0.15], color=VIOLET, lw=1.5, zorder=3)
    # Bras
    ax.plot([x-0.3, x+0.3], [y, y], color=VIOLET, lw=1.5, zorder=3)
    # Jambes
    ax.plot([x, x-0.25], [y-0.3, y-0.65], color=VIOLET, lw=1.5, zorder=3)
    ax.plot([x, x+0.25], [y-0.3, y-0.65], color=VIOLET, lw=1.5, zorder=3)
    ax.text(x, y-0.85, label, ha='center', va='top', fontsize=fontsize,
            fontweight='bold', color=VIOLET, zorder=5)

def save_fig(fig, name):
    path = os.path.join(IMG_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print(f"  Généré: {name}")
    return path

# ─────────────────────────────────────────────
# DIAGRAMME DE CAS D'UTILISATION
# ─────────────────────────────────────────────
def gen_use_case():
    fig, ax = plt.subplots(figsize=(24, 17))
    ax.set_xlim(0, 24); ax.set_ylim(0, 17)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(12, 16.5, "Diagramme de Cas d'Utilisation — Système Centre du Vernet",
            ha='center', va='center', fontsize=14, fontweight='bold', color=VIOLET)

    # ── Frontière système principale ──────────────────────────────────────
    ax.add_patch(mpatches.Rectangle((3.0, 0.4), 17.5, 15.5,
                 facecolor='#FAFAFA', edgecolor=VIOLET, linewidth=2, zorder=1))
    ax.text(11.75, 15.6, "<<Système>>  Plateforme Centre du Vernet",
            ha='center', va='center', fontsize=10, fontstyle='italic', color=VIOLET)

    # ── Helper : flèche en tirets (include / extend) ───────────────────────
    def dash_arrow(x1, y1, x2, y2, stereotype, col='#555555'):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color=col, lw=1.2,
                                   linestyle='dashed'), zorder=5)
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.18, stereotype,
                ha='center', va='bottom', fontsize=7, color=col, style='italic', zorder=6,
                bbox=dict(facecolor='white', edgecolor='none', alpha=0.85, pad=1))

    # ── Helper : triangle généralisation (héritage acteur) ────────────────
    def generalization(xchild, ychild_top, xparent, yparent_bot):
        """Ligne + triangle ouvert pointant vers le parent."""
        ax.plot([xchild, xparent], [ychild_top, yparent_bot],
                color=VIOLET, lw=1.4, zorder=3)
        # triangle ouvert
        dx = xparent - xchild; dy = yparent_bot - ychild_top
        L  = (dx**2 + dy**2) ** 0.5
        ux, uy = dx/L, dy/L
        px, py = -uy, ux
        sz = 0.22
        tip = np.array([xparent, yparent_bot])
        b1  = tip - sz*np.array([ux,uy]) + sz*0.6*np.array([px,py])
        b2  = tip - sz*np.array([ux,uy]) - sz*0.6*np.array([px,py])
        ax.add_patch(plt.Polygon([tip, b1, b2],
                                 closed=True, facecolor=BLANC,
                                 edgecolor=VIOLET, lw=1.4, zorder=4))

    uc_w, uc_h = 3.4, 0.52

    # ════════════════════════════════════════════════════════════
    # ACTEURS — gauche
    # ════════════════════════════════════════════════════════════
    # Utilisateur (abstrait) au sommet
    actor(ax, 1.4, 14.5, "«Utilisateur»\n(abstrait)", fontsize=7.5)

    actor(ax, 1.4, 11.0, "Client /\nPatient")
    actor(ax, 1.4,  7.2, "Coach /\nNutritionniste")
    actor(ax, 1.4,  3.5, "Administrateur")

    # Héritage : chaque acteur concret → Utilisateur abstrait
    generalization(1.4, 11.65, 1.4, 13.85)   # Client → Utilisateur
    generalization(1.4,  7.85, 1.4, 13.85)   # Coach  → Utilisateur
    generalization(1.4,  4.15, 1.4, 13.85)   # Admin  → Utilisateur

    # Acteurs externes — droite
    actor(ax, 22.0, 12.5, "Service Email\n(Brevo)",     fontsize=7.5)
    actor(ax, 22.0,  5.5, "Service\nWhatsApp\n(Twilio)", fontsize=7.5)

    # ════════════════════════════════════════════════════════════
    # COLONNE 1 — UC Client  (x = 7.0)
    # ════════════════════════════════════════════════════════════
    col1 = [
        (7.0, 14.5, "S'inscrire sur la plateforme",    '#E3F2FD', VIOLET),
        (7.0, 13.3, "Se connecter (2FA email)",         '#E3F2FD', VIOLET),
        (7.0, 12.1, "Gérer son profil",                 '#E3F2FD', VIOLET),
        (7.0, 10.9, "Saisir son poids / IMC",           '#E3F2FD', VIOLET),
        (7.0,  9.7, "Consulter son programme",          '#E3F2FD', VIOLET),
        (7.0,  8.5, "Prendre un rendez-vous",           '#E3F2FD', VIOLET),
        (7.0,  7.3, "Envoyer un message",               '#E3F2FD', VIOLET),
        (7.0,  6.1, "Consulter le catalogue",           '#E3F2FD', VIOLET),
        (7.0,  4.9, "Recevoir des notifications",       '#E3F2FD', VIOLET),
    ]
    for (x, y, t, fc, ec) in col1:
        box(ax, x, y, uc_w, uc_h, t, fontsize=7.5, facecolor=fc, edgecolor=ec)

    # ════════════════════════════════════════════════════════════
    # COLONNE 2 — UC Coach / Admin  (x = 12.0)
    # ════════════════════════════════════════════════════════════
    col2 = [
        (12.0, 14.5, "Gérer les utilisateurs",          '#BBDEFB', BLEU_FONCE),
        (12.0, 13.3, "Créer / modifier un programme",   '#BBDEFB', BLEU_FONCE),
        (12.0, 12.1, "Valider un rendez-vous",          '#BBDEFB', BLEU_FONCE),
        (12.0, 10.9, "Gérer le catalogue",              '#BBDEFB', BLEU_FONCE),
        (12.0,  9.7, "Consulter les statistiques",      '#BBDEFB', BLEU_FONCE),
        (12.0,  8.5, "Envoyer une notification",        '#BBDEFB', BLEU_FONCE),
        (12.0,  7.3, "Générer un rapport PDF",          '#BBDEFB', BLEU_FONCE),
        (12.0,  6.1, "Gérer les messages",              '#BBDEFB', BLEU_FONCE),
        (12.0,  4.9, "Configurer les paramètres",       '#BBDEFB', BLEU_FONCE),
    ]
    for (x, y, t, fc, ec) in col2:
        box(ax, x, y, uc_w, uc_h, t, fontsize=7.5, facecolor=fc, edgecolor=ec)

    # ════════════════════════════════════════════════════════════
    # COLONNE 3 — UC inclus / étendus  (x = 17.5)
    # Séparés par une sous-frontière en tirets
    # ════════════════════════════════════════════════════════════
    ax.add_patch(mpatches.Rectangle((15.2, 0.8), 5.0, 14.0,
                 facecolor='#F0F4FF', edgecolor='#90A4AE',
                 linewidth=1.2, linestyle='--', zorder=1))
    ax.text(17.7, 14.6, "UC inclus / étendus",
            ha='center', va='center', fontsize=8, color='#546E7A', style='italic')

    inc_col = 17.7
    # <<include>> targets
    inc_ucs = [
        (inc_col, 13.5, "Vérifier code 2FA"),
        (inc_col, 12.0, "Confirmer l'email"),
        (inc_col, 10.5, "Calculer l'IMC"),
        (inc_col,  9.0, "Notifier le client"),
    ]
    for (x, y, t) in inc_ucs:
        box(ax, x, y, 3.2, uc_h, t, fontsize=7.5,
            facecolor='#E8F5E9', edgecolor='#388E3C')

    # <<extend>> targets
    ext_ucs = [
        (inc_col, 7.2, "Envoyer rappel\nWhatsApp"),
        (inc_col, 5.8, "Récupérer\nmot de passe"),
        (inc_col, 4.2, "Bloquer compte\n(sécurité)"),
    ]
    for (x, y, t) in ext_ucs:
        box(ax, x, y, 3.2, 0.72, t, fontsize=7.5,
            facecolor='#FFF8E1', edgecolor='#F57F17')

    # ════════════════════════════════════════════════════════════
    # RELATIONS acteurs → UC principaux
    # ════════════════════════════════════════════════════════════
    # Client → col1
    for (x, y, t, fc, ec) in col1:
        line(ax, 1.75, 11.0, x - uc_w/2, y, VIOLET, 0.9)

    # Coach → col1 (partagés) + col2
    coach_col1_idx = [6, 7, 8]   # Envoyer message, catalogue, notifs
    for i, (x, y, t, fc, ec) in enumerate(col1):
        if i in coach_col1_idx:
            line(ax, 1.75, 7.2, x - uc_w/2, y, '#1976D2', 0.9)
    for (x, y, t, fc, ec) in col2[1:]:   # coach n'a pas "Gérer utilisateurs"
        line(ax, 1.75, 7.2, x - uc_w/2, y, '#1976D2', 0.9)

    # Admin → col2 (tout)
    for (x, y, t, fc, ec) in col2:
        line(ax, 1.75, 3.5, x - uc_w/2, y, '#0D47A1', 0.9)

    # ════════════════════════════════════════════════════════════
    # RELATIONS <<include>>  (tirets, flèche vers UC inclus)
    # ════════════════════════════════════════════════════════════
    # Se connecter →<<include>>→ Vérifier code 2FA
    dash_arrow(7.0 + uc_w/2, 13.3, inc_col - 1.6, 13.5, '<<include>>', '#2E7D32')
    # S'inscrire →<<include>>→ Confirmer l'email
    dash_arrow(7.0 + uc_w/2, 14.5, inc_col - 1.6, 12.0, '<<include>>', '#2E7D32')
    # Saisir poids →<<include>>→ Calculer IMC
    dash_arrow(7.0 + uc_w/2, 10.9, inc_col - 1.6, 10.5, '<<include>>', '#2E7D32')
    # Valider RDV →<<include>>→ Notifier le client
    dash_arrow(12.0 + uc_w/2, 12.1, inc_col - 1.6, 9.0, '<<include>>', '#2E7D32')

    # ════════════════════════════════════════════════════════════
    # RELATIONS <<extend>>  (tirets, flèche vers UC de base)
    # ════════════════════════════════════════════════════════════
    # Envoyer rappel WhatsApp →<<extend>>→ Prendre un RDV
    dash_arrow(inc_col - 1.6, 7.2, 7.0 + uc_w/2, 8.5, '<<extend>>', '#E65100')
    # Récupérer MDP →<<extend>>→ Se connecter
    dash_arrow(inc_col - 1.6, 5.8, 7.0 + uc_w/2, 13.3, '<<extend>>', '#E65100')
    # Bloquer compte →<<extend>>→ Se connecter
    dash_arrow(inc_col - 1.6, 4.2, 7.0 + uc_w/2, 13.3, '<<extend>>', '#E65100')

    # ════════════════════════════════════════════════════════════
    # RELATIONS vers services externes
    # ════════════════════════════════════════════════════════════
    # Confirmer email → Service Email
    line(ax, inc_col + 1.6, 12.0, 21.2, 12.5, '#27AE60', 1.1, dashed=True)
    # Rappel WhatsApp → Service WhatsApp
    line(ax, inc_col + 1.6, 7.2, 21.2, 5.8, '#27AE60', 1.1, dashed=True)

    # ════════════════════════════════════════════════════════════
    # LÉGENDE
    # ════════════════════════════════════════════════════════════
    legend_items = [
        mpatches.Patch(facecolor='#E3F2FD', edgecolor=VIOLET,     label='UC Client / Partagé'),
        mpatches.Patch(facecolor='#BBDEFB', edgecolor=BLEU_FONCE, label='UC Coach / Admin'),
        mpatches.Patch(facecolor='#E8F5E9', edgecolor='#388E3C',  label='UC inclus (<<include>>)'),
        mpatches.Patch(facecolor='#FFF8E1', edgecolor='#F57F17',  label='UC étendu (<<extend>>)'),
        mlines.Line2D([], [], color=VIOLET,     lw=1.5, label='Association acteur'),
        mlines.Line2D([], [], color=VIOLET,     lw=1.5,
                      marker='^', markersize=7, markerfacecolor=BLANC,
                      label='Généralisation (héritage)'),
        mlines.Line2D([], [], color='#2E7D32', lw=1.2, linestyle='--', label='<<include>>'),
        mlines.Line2D([], [], color='#E65100', lw=1.2, linestyle='--', label='<<extend>>'),
    ]
    ax.legend(handles=legend_items, loc='lower left', fontsize=7.5,
              ncol=2, framealpha=0.9)

    return save_fig(fig, "diag_cas_utilisation.png")

# ─────────────────────────────────────────────
# DIAGRAMME DE CLASSES
# ─────────────────────────────────────────────
def gen_class_diagram():
    """
    Layout 3 colonnes strictes — les flèches passent dans les couloirs entre colonnes.
    Col A (x=2.8): AppUser, Client, WeightEntry, ActivityLog  (de haut en bas)
    Col B (x=9.2): Appointment, MessageThread, Message        (de haut en bas)
    Col C (x=15.6): Notification, CatalogAsset, ClientProgram, WeeklyPlan
    UserRole enum : à droite de AppUser (x=6.2, haut)
    Couloir AB : x ∈ [5.4 ; 6.8]   Couloir BC : x ∈ [11.8 ; 13.0]
    """
    fig, ax = plt.subplots(figsize=(20, 15))
    ax.set_xlim(0, 20); ax.set_ylim(0, 15)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(10, 14.6, "Diagramme de Classes — Système Centre du Vernet",
            ha='center', va='center', fontsize=13, fontweight='bold', color=VIOLET)

    W  = 3.6   # largeur standard
    AH = 0.27  # hauteur par ligne d'attribut
    XCOL = {'A': 2.8, 'B': 9.2, 'C': 15.6}

    # ── helper : dessine une classe, retourne le y du bas ──────────────────
    def classe(col, y_top, name, attrs, methods=None):
        x = XCOL[col]
        n = len(attrs) + (len(methods) if methods else 0)
        h = 0.42 + n * AH + (0.08 if methods else 0)
        y_bot = y_top - h

        # boîte blanche
        ax.add_patch(mpatches.Rectangle(
            (x - W/2, y_bot), W, h,
            facecolor=BLANC, edgecolor=VIOLET, linewidth=1.8, zorder=3))
        # en-tête bleue
        ax.add_patch(mpatches.Rectangle(
            (x - W/2, y_top - 0.42), W, 0.42,
            facecolor=VIOLET, edgecolor=VIOLET, linewidth=1.8, zorder=4))
        ax.text(x, y_top - 0.21, name,
                ha='center', va='center', fontsize=9,
                fontweight='bold', color=BLANC, zorder=5)

        cy = y_top - 0.42
        for a in attrs:
            cy -= AH
            ax.text(x - W/2 + 0.1, cy + AH/2, a,
                    ha='left', va='center', fontsize=7, color=NOIR, zorder=5)
        if methods:
            ax.plot([x - W/2, x + W/2], [cy, cy], color=GRIS_BORD, lw=0.8, zorder=4)
            for m in methods:
                cy -= AH
                ax.text(x - W/2 + 0.1, cy + AH/2, m,
                        ha='left', va='center', fontsize=7,
                        color='#0D47A1', zorder=5, fontstyle='italic')
        return y_bot   # y du bas de la boîte

    # ── helper : flèche orthogonale (L-shape ou droite) ───────────────────
    def ortho(x1, y1, x2, y2, label='', via_x=None, via_y=None, col=NOIR):
        """
        Trace un chemin en L.
        via_x : passer par ce x (couloir vertical)
        via_y : passer par ce y (couloir horizontal)
        """
        pts_x, pts_y = [x1], [y1]
        if via_x is not None:
            pts_x += [via_x, via_x]; pts_y += [y1, y2]
        elif via_y is not None:
            pts_x += [x1, x2]; pts_y += [via_y, via_y]
        else:
            pts_x += [x1, x2]; pts_y += [y2, y2]
        pts_x.append(x2); pts_y.append(y2)
        ax.plot(pts_x, pts_y, color=col, lw=1.4, zorder=2)
        # pointe de flèche
        dx = pts_x[-1] - pts_x[-2]
        dy = pts_y[-1] - pts_y[-2]
        ax.annotate('', xy=(x2, y2),
                    xytext=(x2 - 0.001*dx/(abs(dx)+1e-9),
                            y2 - 0.001*dy/(abs(dy)+1e-9)),
                    arrowprops=dict(arrowstyle='->', color=col, lw=1.4), zorder=3)
        if label:
            mx = (pts_x[-2] + pts_x[-1]) / 2
            my = (pts_y[-2] + pts_y[-1]) / 2
            ax.text(mx + 0.12, my + 0.12, label,
                    fontsize=7.5, color=col, zorder=5,
                    bbox=dict(facecolor='white', edgecolor='none', alpha=0.8, pad=1))

    # ════════════════════════════════════════════════════════════
    # COLONNE A
    # ════════════════════════════════════════════════════════════
    # AppUser  y_top = 14.0
    bot_appuser = classe('A', 14.0, "AppUser",
        ["+ id : Long", "+ email : String", "+ password : String",
         "+ role : UserRole", "+ nom : String", "+ prenom : String",
         "+ telephone : String", "+ dateInscription : LocalDateTime"],
        ["+ getAuthorities()", "+ isEnabled()"])

    # UserRole enum — à droite de AppUser, même niveau
    enum_x, enum_y = 6.9, 13.6
    enum_h = 1.1
    ax.add_patch(mpatches.Rectangle(
        (enum_x - 1.3, enum_y - enum_h), 2.6, enum_h,
        facecolor='#FFF9C4', edgecolor='#F9A825', linewidth=1.6, zorder=3))
    ax.text(enum_x, enum_y - 0.22, "<<énumération>>",
            ha='center', va='center', fontsize=7.5, color='#795500', zorder=5)
    ax.text(enum_x, enum_y - 0.52, "UserRole",
            ha='center', va='center', fontsize=8.5, fontweight='bold', color='#795500', zorder=5)
    ax.text(enum_x, enum_y - 0.78, "CLIENT | COACH",
            ha='center', va='center', fontsize=7, color=NOIR, zorder=5)
    ax.text(enum_x, enum_y - 0.98, "NUTRITIONNISTE | ADMIN",
            ha='center', va='center', fontsize=7, color=NOIR, zorder=5)

    # AppUser -use-> UserRole  (flèche horizontale courte)
    ortho(XCOL['A'] + W/2, 13.45, enum_x - 1.3, 13.45, label='utilise', col='#795500')

    # gap puis Client
    bot_client = classe('A', bot_appuser - 0.55, "Client",
        ["+ id : Long", "+ poids : Double", "+ taille : Double",
         "+ objectifPoids : Double", "+ dateNaissance : LocalDate"],
        ["+ calculerIMC() : Double"])

    # AppUser -> Client (1:1) — ligne verticale dans col A
    ortho(XCOL['A'], bot_appuser, XCOL['A'], bot_appuser - 0.55, label='1:1', col=VIOLET)

    # gap puis WeightEntry
    bot_we = classe('A', bot_client - 0.55, "WeightEntry",
        ["+ id : Long", "+ date : LocalDate",
         "+ poids : Double", "+ imc : Double",
         "+ client : Client"])

    # Client -> WeightEntry (1:N)
    ortho(XCOL['A'], bot_client, XCOL['A'], bot_client - 0.55, label='1:N', col=VIOLET)

    # gap puis ActivityLog
    bot_al = classe('A', bot_we - 0.55, "ActivityLog",
        ["+ id : Long", "+ action : String",
         "+ details : String", "+ date : LocalDateTime",
         "+ utilisateur : AppUser"])

    # AppUser -> ActivityLog  — passe par la gauche (x=0.5) pour éviter les autres boîtes
    ax.plot([XCOL['A'] - W/2, 0.5, 0.5, XCOL['A'] - W/2],
            [bot_appuser, bot_appuser, bot_we - 0.55 - 0.21, bot_we - 0.55 - 0.21],
            color='#546E7A', lw=1.3, zorder=2)
    ax.annotate('', xy=(XCOL['A'] - W/2, bot_we - 0.55 - 0.21),
                xytext=(XCOL['A'] - W/2 - 0.01, bot_we - 0.55 - 0.21),
                arrowprops=dict(arrowstyle='->', color='#546E7A', lw=1.3), zorder=3)
    ax.text(0.55, (bot_appuser + bot_we - 0.55)/2, '1:N',
            fontsize=7, color='#546E7A', va='center')

    # ════════════════════════════════════════════════════════════
    # COLONNE B
    # ════════════════════════════════════════════════════════════
    bot_appt = classe('B', 14.0, "Appointment",
        ["+ id : Long", "+ dateHeure : LocalDateTime",
         "+ type : String", "+ statut : String",
         "+ client : Client", "+ coach : AppUser"],
        ["+ envoyer_rappel()"])

    bot_mt = classe('B', bot_appt - 0.6, "MessageThread",
        ["+ id : Long", "+ sujet : String",
         "+ createdAt : LocalDateTime",
         "+ participant1 : AppUser",
         "+ participant2 : AppUser"])

    bot_msg = classe('B', bot_mt - 0.6, "Message",
        ["+ id : Long", "+ contenu : String",
         "+ dateEnvoi : LocalDateTime",
         "+ lu : Boolean",
         "+ expediteur : AppUser",
         "+ thread : MessageThread"])

    # MessageThread -> Message (1:N) — verticale dans col B
    ortho(XCOL['B'], bot_mt, XCOL['B'], bot_mt - 0.6, label='1:N', col=VIOLET)

    # Couloir AB = x = 6.0  (entre col A bord droit 4.6 et col B bord gauche 7.4)
    COR_AB = 6.0

    # AppUser -> Appointment : sort droite AppUser, descend dans couloir, rentre dans Appointment
    y_appt_mid = 14.0 - 0.21   # milieu en-tête Appointment
    ortho(XCOL['A'] + W/2, 13.65, XCOL['B'] - W/2, y_appt_mid,
          via_x=COR_AB, label='1:N', col='#1565C0')

    # AppUser -> MessageThread
    y_mt_mid = bot_appt - 0.6 - 0.21
    ortho(XCOL['A'] + W/2, 13.1, XCOL['B'] - W/2, y_mt_mid,
          via_x=COR_AB, label='1:N', col='#1565C0')

    # Client -> Appointment (client FK) — sort de client côté droit au milieu
    y_cl_mid = bot_appuser - 0.55 - 0.21
    y_appt_bot_quarter = bot_appt - (bot_appt - (bot_appt - 0.9)) * 0.7
    ortho(XCOL['A'] + W/2, y_cl_mid, XCOL['B'] - W/2, bot_appt - 0.65,
          via_x=COR_AB, col='#1976D2')

    # ════════════════════════════════════════════════════════════
    # COLONNE C
    # ════════════════════════════════════════════════════════════
    bot_notif = classe('C', 14.0, "Notification",
        ["+ id : Long", "+ titre : String",
         "+ message : String", "+ type : String",
         "+ lu : Boolean", "+ createdAt : LocalDateTime",
         "+ destinataire : AppUser"])

    bot_cat = classe('C', bot_notif - 0.6, "CatalogAsset",
        ["+ id : Long", "+ nom : String",
         "+ description : String",
         "+ cheminFichier : String",
         "+ categorie : String",
         "+ dateAjout : LocalDateTime",
         "+ ajoutePar : AppUser"])

    bot_cp = classe('C', bot_cat - 0.6, "ClientProgram",
        ["+ id : Long", "+ dateDebut : LocalDate",
         "+ dateFin : LocalDate",
         "+ notes : String",
         "+ client : Client",
         "+ creePar : AppUser"],
        ["+ estActif() : Boolean"])

    bot_wp = classe('C', bot_cp - 0.6, "WeeklyPlan",
        ["+ id : Long", "+ numeroSemaine : Integer",
         "+ contenu : String (JSON)",
         "+ program : ClientProgram"])

    # ClientProgram -> WeeklyPlan (1:N) — verticale col C
    ortho(XCOL['C'], bot_cp, XCOL['C'], bot_cp - 0.6, label='1:N', col=VIOLET)

    # Couloir BC = x = 12.6
    COR_BC = 12.6

    # AppUser -> Notification : sort droite AppUser, passe dessus Appointment, rentre Notification
    ortho(XCOL['A'] + W/2, 14.0 - 0.21, XCOL['C'] - W/2, 14.0 - 0.21,
          via_y=14.35, col='#1565C0')
    ax.text(10.0, 14.42, '1:N', fontsize=7, color='#1565C0')

    # AppUser -> CatalogAsset — sort col A par la droite, via couloir BC
    ortho(XCOL['A'] + W/2, 13.2, XCOL['C'] - W/2, bot_notif - 0.6 - 0.21,
          via_x=COR_BC, label='1:N', col='#1565C0')

    # Client -> ClientProgram — sort de Client à droite, via couloir BC
    ortho(XCOL['A'] + W/2, bot_appuser - 0.55 - 0.55,
          XCOL['C'] - W/2, bot_cat - 0.6 - 0.21,
          via_x=COR_BC, label='1:N', col=VIOLET)

    # ── Légende ──────────────────────────────────────────────────
    legend_items = [
        mpatches.Patch(facecolor=VIOLET, edgecolor=VIOLET, label='Classe entité'),
        mpatches.Patch(facecolor='#FFF9C4', edgecolor='#F9A825', label='Énumération'),
        mlines.Line2D([], [], color=VIOLET, marker='>', markersize=6,
                      label='Association / Composition'),
        mlines.Line2D([], [], color='#1565C0', marker='>', markersize=6,
                      label='Dépendance AppUser'),
    ]
    ax.legend(handles=legend_items, loc='lower right', fontsize=8)
    ax.text(1, 0.3, "Classe entité", fontsize=7.5, color='#546E7A', style='italic')

    return save_fig(fig, "diag_classes.png")

# ─────────────────────────────────────────────
# DIAGRAMME DE SEQUENCE — Connexion avec 2FA
# ─────────────────────────────────────────────
def gen_sequence_login():
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 14); ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(7, 9.6, "Diagramme de Séquence — Connexion avec Authentification 2FA",
            ha='center', va='center', fontsize=12, fontweight='bold', color=VIOLET)

    # Participants (rectangles au sommet)
    participants = [
        (1.2,  "Client"),
        (3.5,  "Frontend\n(React)"),
        (6.0,  "Backend\n(Spring Boot)"),
        (9.0,  "Base de données\n(PostgreSQL)"),
        (12.0, "Service Email\n(Brevo SMTP)"),
    ]
    y_top = 9.0
    lifeline_bot = 0.5

    for x, name in participants:
        box(ax, x, y_top, 2.0, 0.55, name, fontsize=8, bold=True,
            facecolor=VIOLET, edgecolor=VIOLET, text_color=BLANC)
        line(ax, x, y_top - 0.275, x, lifeline_bot, GRIS_BORD, 1, dashed=True)

    def msg(y, x1, x2, label, ret=False, note=None):
        col = "#1565C0" if not ret else "#6A1B9A"
        sty = '->' if not ret else '->'
        ls = '--' if ret else '-'
        ax.annotate('', xy=(x2, y), xytext=(x1, y),
                   arrowprops=dict(arrowstyle='->', color=col, lw=1.5,
                                  linestyle=ls), zorder=4)
        direction = 1 if x2 > x1 else -1
        ax.text((x1+x2)/2, y + 0.12, label, ha='center', va='bottom',
                fontsize=7.5, color=col, zorder=5,
                bbox=dict(boxstyle='square,pad=0.1', facecolor='white', alpha=0.8, edgecolor='none'))
        if note:
            ax.text(max(x1, x2) + 0.15, y, note, ha='left', va='center',
                   fontsize=7, color='#37474F', style='italic', zorder=5)

    def activation(x, y_start, y_end):
        rect = mpatches.Rectangle((x - 0.1, y_end), 0.2, y_start - y_end,
                                  facecolor='#BBDEFB', edgecolor=VIOLET, linewidth=1.2, zorder=3)
        ax.add_patch(rect)

    def sep(y, label):
        ax.plot([0.1, 13.9], [y, y], color=GRIS_BORD, lw=1, linestyle=':', zorder=2)
        ax.text(0.15, y + 0.08, label, fontsize=7, color='#546E7A', zorder=5)

    # Séquence
    sep(8.55, "① Saisie des identifiants")
    msg(8.4, 1.2, 3.5, "Saisir email + mot de passe")
    msg(8.1, 3.5, 6.0, "POST /api/auth/login {email, password}")

    sep(7.75, "② Vérification en base")
    activation(6.0, 8.1, 7.5)
    msg(7.6, 6.0, 9.0, "SELECT * FROM app_user WHERE email=?")
    msg(7.3, 9.0, 6.0, "Retourne: Utilisateur trouvé", ret=True)
    msg(7.0, 6.0, 9.0, "Vérifier hash(password) == password_hash")
    msg(6.7, 9.0, 6.0, "OK: credentials valides", ret=True)

    sep(6.4, "③ Envoi du code 2FA par email")
    msg(6.25, 6.0, 9.0, "INSERT INTO otp_codes (code, expiry)")
    msg(5.95, 6.0, 12.0, "Envoyer email: code OTP (valide 5 min)")
    msg(5.65, 12.0, 6.0, "Email envoyé (SMTP 587)", ret=True)
    msg(5.35, 6.0, 3.5, "Réponse: 200 {message: code envoyé}", ret=True)
    msg(5.05, 3.5, 1.2, "Afficher écran saisie du code", ret=True)

    sep(4.75, "④ Vérification du code OTP")
    msg(4.6, 1.2, 3.5, "Saisir le code reçu par email")
    msg(4.3, 3.5, 6.0, "POST /api/auth/verify-otp {code}")
    activation(6.0, 4.3, 3.7)
    msg(4.0, 6.0, 9.0, "SELECT * FROM otp_codes WHERE code=? AND expiry > NOW()")
    msg(3.7, 9.0, 6.0, "Code valide (non expiré)", ret=True)

    sep(3.4, "⑤ Génération du JWT et accès")
    msg(3.25, 6.0, 9.0, "UPDATE otp: marquer comme utilisé")
    msg(2.95, 6.0, 3.5, "Réponse: 200 {accessToken: JWT}", ret=True)
    msg(2.65, 3.5, 1.2, "Stocker JWT, rediriger vers dashboard", ret=True)

    ax.text(7, 0.25, "Note : Le JWT est signé avec JWT_SECRET (HS256) et expire après 24h.",
            ha='center', va='center', fontsize=8, color='#546E7A', style='italic')

    return save_fig(fig, "diag_sequence_login.png")

# ─────────────────────────────────────────────
# DIAGRAMME DE SEQUENCE — Prise de RDV
# ─────────────────────────────────────────────
def gen_sequence_rdv():
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 14); ax.set_ylim(0, 9)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(7, 8.6, "Diagramme de Séquence — Prise de Rendez-vous",
            ha='center', va='center', fontsize=12, fontweight='bold', color=VIOLET)

    participants = [
        (1.5,  "Client"),
        (4.0,  "Frontend\n(React)"),
        (7.0,  "Backend\n(Spring Boot)"),
        (10.0, "PostgreSQL\n(Supabase)"),
        (12.5, "Service Email\n(Brevo)"),
    ]
    y_top = 8.1
    for x, name in participants:
        box(ax, x, y_top, 2.2, 0.55, name, fontsize=8, bold=True,
            facecolor=VIOLET, edgecolor=VIOLET, text_color=BLANC)
        line(ax, x, y_top - 0.275, x, 0.3, GRIS_BORD, 1, dashed=True)

    def msg(y, x1, x2, label, ret=False):
        col = "#1565C0" if not ret else "#6A1B9A"
        ls = '--' if ret else '-'
        ax.annotate('', xy=(x2, y), xytext=(x1, y),
                   arrowprops=dict(arrowstyle='->', color=col, lw=1.5, linestyle=ls), zorder=4)
        ax.text((x1+x2)/2, y+0.12, label, ha='center', va='bottom', fontsize=7.5, color=col,
                bbox=dict(boxstyle='square,pad=0.1', facecolor='white', alpha=0.8, edgecolor='none'), zorder=5)

    def sep(y, label):
        ax.plot([0.1, 13.9], [y, y], color=GRIS_BORD, lw=1, linestyle=':', zorder=2)
        ax.text(0.15, y + 0.08, label, fontsize=7, color='#546E7A', zorder=5)

    sep(7.7, "① Sélection du créneau")
    msg(7.55, 1.5, 4.0, "Choisir date, heure, type de séance")
    msg(7.25, 4.0, 7.0, "GET /api/appointments/disponibilites?date=")
    msg(6.95, 7.0, 10.0, "SELECT * FROM appointments WHERE date=? AND statut='LIBRE'")
    msg(6.65, 10.0, 7.0, "Liste des créneaux disponibles", ret=True)
    msg(6.35, 7.0, 4.0, "200: [{id, dateHeure, type}]", ret=True)
    msg(6.05, 4.0, 1.5, "Afficher calendrier interactif", ret=True)

    sep(5.75, "② Confirmation de la réservation")
    msg(5.60, 1.5, 4.0, "Confirmer le créneau sélectionné")
    msg(5.30, 4.0, 7.0, "POST /api/appointments {clientId, dateHeure, type}")
    msg(5.00, 7.0, 10.0, "Vérifier: pas de conflit (SELECT COUNT) = 0")
    msg(4.70, 10.0, 7.0, "Aucun conflit", ret=True)
    msg(4.40, 7.0, 10.0, "INSERT INTO appointments (...) VALUES (...)")
    msg(4.10, 10.0, 7.0, "OK — appointment_id = 42", ret=True)

    sep(3.80, "③ Notifications automatiques")
    msg(3.65, 7.0, 12.5, "Envoyer email de confirmation au Client")
    msg(3.35, 7.0, 12.5, "Envoyer email de rappel au Coach")
    msg(3.05, 12.5, 7.0, "Emails envoyés avec succès", ret=True)
    msg(2.75, 7.0, 4.0, "201 Created: {appointment}", ret=True)
    msg(2.45, 4.0, 1.5, "Afficher confirmation + détails RDV", ret=True)

    ax.text(7, 0.2, "Le rappel automatique est envoyé 24h avant le rendez-vous via un job planifié (Spring Scheduler).",
            ha='center', va='center', fontsize=8, color='#546E7A', style='italic')

    return save_fig(fig, "diag_sequence_rdv.png")

# ─────────────────────────────────────────────
# DIAGRAMME DE GANTT
# ─────────────────────────────────────────────
def gen_gantt():
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    tasks = [
        ("Analyse des besoins & Étude de l'existant",   1, 2),
        ("Modélisation UML (UC, Classes, Séquences)",    2, 3),
        ("Conception de la base de données (Supabase)",  2, 3),
        ("Développement Backend (Spring Boot + API REST)", 3, 6),
        ("Développement Frontend (React + TypeScript)",  3, 6),
        ("Intégration Backend ↔ Frontend",              5, 7),
        ("Tests unitaires & tests d'intégration",       6, 8),
        ("Déploiement (Vercel + HuggingFace Spaces)",   7, 9),
        ("Rédaction du rapport & documentation",         1, 9),
    ]

    colors = [VIOLET, "#1976D2", "#0288D1", "#1565C0", "#1976D2",
              "#0097A7", "#2E7D32", "#F57F17", "#546E7A"]

    days = list(range(1, 10))
    ax.set_xlim(0.5, 9.5)
    ax.set_ylim(-0.5, len(tasks) - 0.5)
    ax.set_xticks(days)
    ax.set_xticklabels([f"Jour {d}\n(22-31 Mai)" if d in [1, 5, 9]
                        else f"Jour {d}" for d in days], fontsize=8)
    ax.set_yticks(range(len(tasks)))
    ax.set_yticklabels([t[0] for t in tasks], fontsize=8.5)
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.4, linewidth=0.8)
    ax.set_title("Diagramme de Gantt — Projet Centre du Vernet (22–31 Mai 2026)",
                 fontsize=12, fontweight='bold', color=VIOLET, pad=12)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    for i, (name, start, end) in enumerate(tasks):
        ax.barh(i, end - start, left=start, color=colors[i], alpha=0.85,
                edgecolor='white', linewidth=1.5, height=0.6)
        dur = end - start
        ax.text(start + dur/2, i, f"{dur} j", ha='center', va='center',
                fontsize=7.5, color=BLANC, fontweight='bold')

    ax.text(0.98, -0.02, "Période: 22–31 Mai 2026 | Équipe: 6 membres",
            transform=ax.transAxes, ha='right', va='bottom',
            fontsize=8, color='#546E7A', style='italic')

    plt.tight_layout()
    return save_fig(fig, "diag_gantt.png")

# ─────────────────────────────────────────────
# DIAGRAMME D'ACTIVITE (BONUS)
# ─────────────────────────────────────────────
def gen_activity():
    fig, ax = plt.subplots(figsize=(8, 12))
    ax.set_xlim(0, 8); ax.set_ylim(0, 12)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(4, 11.6, "Diagramme d'Activité — Suivi du Poids",
            ha='center', va='center', fontsize=11, fontweight='bold', color=VIOLET)

    def node(x, y, text, w=3.0, h=0.5, diamond=False, start=False, end=False):
        if start or end:
            col = NOIR if start else VIOLET
            circ = mpatches.Circle((x, y), 0.22, facecolor=col, edgecolor=col, zorder=4)
            ax.add_patch(circ)
            if end:
                circ2 = mpatches.Circle((x, y), 0.32, facecolor='none', edgecolor=VIOLET, linewidth=2, zorder=3)
                ax.add_patch(circ2)
        elif diamond:
            pts = np.array([[x, y+0.32], [x+0.45, y], [x, y-0.32], [x-0.45, y]])
            d = mpatches.Polygon(pts, facecolor='#FFF9C4', edgecolor='#F9A825', linewidth=1.8, zorder=4)
            ax.add_patch(d)
            ax.text(x, y, text, ha='center', va='center', fontsize=7.5, fontweight='bold', color=NOIR, zorder=5)
        else:
            r = mpatches.Rectangle((x - w/2, y - h/2), w, h,
                                   facecolor='#E3F2FD', edgecolor=VIOLET, linewidth=1.5, zorder=4)
            ax.add_patch(r)
            ax.text(x, y, text, ha='center', va='center', fontsize=8, color=NOIR, zorder=5)

    def arr(y1, y2, x=4.0, label='', side=''):
        ax.annotate('', xy=(x, y2), xytext=(x, y1),
                   arrowprops=dict(arrowstyle='->', color=VIOLET, lw=1.5), zorder=5)
        if label:
            ax.text(x + 0.1, (y1+y2)/2, label, ha='left', va='center',
                   fontsize=7.5, color='#1565C0')

    node(4, 11.1, '', start=True)
    arr(10.88, 10.55)
    node(4, 10.3, "Client authentifié accède au tableau de bord")
    arr(10.05, 9.45)
    node(4, 9.2, "Cliquer sur 'Ajouter une mesure de poids'")
    arr(8.95, 8.35)
    node(4, 8.1, "Saisir le poids (en kg) et la date")
    arr(7.85, 7.25)
    node(4, 7.0, "Valider le formulaire")
    arr(6.75, 6.35)
    node(4, 6.1, "Vérification?", diamond=True)

    # Branche OK
    ax.annotate('', xy=(4.0, 5.55), xytext=(4.0, 5.78),
               arrowprops=dict(arrowstyle='->', color='#2E7D32', lw=1.5), zorder=5)
    ax.text(4.15, 5.67, 'Valide', fontsize=7.5, color='#2E7D32')
    node(4, 5.3, "Calculer l'IMC (poids / taille²)")
    arr(5.05, 4.45)
    node(4, 4.2, "Enregistrer mesure en base de données")
    arr(3.95, 3.35)
    node(4, 3.1, "Mettre à jour le graphique d'évolution")
    arr(2.85, 2.25)
    node(4, 2.0, "Envoyer notification si objectif atteint")
    arr(1.75, 1.15)
    node(4, 0.9, '', end=True)

    # Branche Erreur
    ax.plot([4.45, 6.5, 6.5], [6.1, 6.1, 8.1], color='#C62828', lw=1.5, zorder=4)
    ax.annotate('', xy=(4 + 3.0/2, 8.1), xytext=(6.5, 8.1),
               arrowprops=dict(arrowstyle='->', color='#C62828', lw=1.5), zorder=5)
    ax.text(5.5, 6.2, 'Invalide', fontsize=7.5, color='#C62828')
    node(7.3, 7.2, "Afficher\nmessage d'erreur", w=1.8, h=0.7)

    return save_fig(fig, "diag_activite.png")

# ─────────────────────────────────────────────
# ARCHITECTURE TECHNIQUE
# ─────────────────────────────────────────────
def gen_architecture():
    fig, ax = plt.subplots(figsize=(14, 8))
    ax.set_xlim(0, 14); ax.set_ylim(0, 8)
    ax.axis('off')
    ax.set_facecolor(GRIS_CLAIR)
    fig.patch.set_facecolor(GRIS_CLAIR)

    ax.text(7, 7.6, "Architecture Technique — Système Centre du Vernet",
            ha='center', va='center', fontsize=13, fontweight='bold', color=VIOLET)

    def layer(x, y, w, h, title, items, bg, fg=BLANC):
        r = mpatches.Rectangle((x, y), w, h, facecolor=bg, edgecolor=VIOLET,
                               linewidth=2, zorder=3)
        ax.add_patch(r)
        ax.text(x + w/2, y + h - 0.28, title, ha='center', va='center',
               fontsize=10, fontweight='bold', color=fg, zorder=5)
        for i, item in enumerate(items):
            ax.text(x + w/2, y + h - 0.65 - i*0.45, item, ha='center', va='center',
                   fontsize=8.5, color=fg, zorder=5)

    # Couche Client
    layer(0.3, 5.5, 3.8, 1.8, "COUCHE PRÉSENTATION (Client)",
          ["Navigateur Web / Smartphone",
           "React 19 + TypeScript + Vite",
           "Hébergement: Vercel"],
          "#1565C0")

    # Couche Serveur
    layer(5.1, 5.5, 3.8, 1.8, "COUCHE MÉTIER (Serveur)",
          ["Spring Boot 3.4.5 + Java 17",
           "REST API / JWT / 2FA",
           "HuggingFace Spaces (Docker)"],
          VIOLET)

    # Couche Données
    layer(9.9, 5.5, 3.8, 1.8, "COUCHE DONNÉES",
          ["PostgreSQL (Supabase)",
           "Session Pooler (IPv4)",
           "Stockage fichiers /app/storage"],
          "#2E7D32")

    # Services externes
    layer(0.3, 2.8, 3.8, 2.1, "SERVICES EXTERNES",
          ["Brevo SMTP — Emails 2FA",
           "Twilio — Notifications WhatsApp",
           "GitHub — Contrôle de version"],
          "#F57F17", NOIR)

    # Sécurité
    layer(5.1, 2.8, 3.8, 2.1, "SÉCURITÉ",
          ["JWT (HS256, TTL 24h)",
           "2FA obligatoire à la connexion",
           "HTTPS / CORS sécurisé",
           "BCrypt (hash mots de passe)"],
          "#B71C1C")

    # DevOps
    layer(9.9, 2.8, 3.8, 2.1, "DÉPLOIEMENT (CI/CD)",
          ["Docker (image alpine JRE 17)",
           "Git Push → build automatique",
           "Vercel (frontend auto-deploy)"],
          "#546E7A")

    # Flèches entre couches
    arrow(ax, 4.1, 6.4, 5.1, 6.4, color=BLANC, style='<->')
    ax.text(4.6, 6.55, "HTTPS\nREST", ha='center', fontsize=7, color=NOIR)
    arrow(ax, 8.9, 6.4, 9.9, 6.4, color=BLANC, style='<->')
    ax.text(9.4, 6.55, "JDBC/\nSQL", ha='center', fontsize=7, color=NOIR)

    # Ligne séparation
    ax.plot([0.3, 13.7], [5.4, 5.4], color=GRIS_BORD, lw=1.5, linestyle='--', zorder=2)
    ax.text(7, 5.3, "─── Infrastructure & Services ───",
            ha='center', va='center', fontsize=8, color='#546E7A', style='italic')

    ax.text(7, 0.25, "Architecture 3-Tiers — MVC — Stateless (REST + JWT)",
            ha='center', va='center', fontsize=9, color=VIOLET, style='italic', fontweight='bold')

    return save_fig(fig, "diag_architecture.png")

# ─────────────────────────────────────────────
# GÉNÉRATION DU RAPPORT WORD
# ─────────────────────────────────────────────
def set_font(run, name='Calibri', size=11, bold=False, italic=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)

def add_heading(doc, text, level=1, color=(21, 101, 192)):
    p = doc.add_heading('', level=level)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.color.rgb = RGBColor(*color)
    if level == 1:
        run.font.size = Pt(16)
    elif level == 2:
        run.font.size = Pt(13)
    else:
        run.font.size = Pt(11)
    run.font.bold = True
    return p

def add_para(doc, text, size=11, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY,
             color=None, indent=False, space_before=0, space_after=6):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    if indent:
        p.paragraph_format.left_indent = Cm(0.7)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)
    return p

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.5 + level * 0.5)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(11)
    return p

def add_image(doc, img_path, caption, width=Cm(15)):
    if not os.path.exists(img_path):
        doc.add_paragraph(f"[Image non trouvée: {img_path}]")
        return
    doc.add_picture(img_path, width=width)
    last_para = doc.paragraphs[-1]
    last_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap = doc.add_paragraph(caption)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = cap.runs[0]
    run.font.name = 'Calibri'
    run.font.size = Pt(9)
    run.font.italic = True
    run.font.color.rgb = RGBColor(21, 101, 192)

def add_db_table(doc, title, columns, rows):
    add_para(doc, title, size=10, bold=True, color=(21, 101, 192), space_before=8)
    table = doc.add_table(rows=1 + len(rows), cols=len(columns))
    table.style = 'Table Grid'
    # En-tête
    hdr = table.rows[0].cells
    for i, col in enumerate(columns):
        hdr[i].text = col
        hdr[i].paragraphs[0].runs[0].font.bold = True
        hdr[i].paragraphs[0].runs[0].font.size = Pt(9)
        hdr[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        tc = hdr[i]._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '1565C0')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:val'), 'clear')
        tcPr.append(shd)
    # Données
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1].cells
        for c_idx, val in enumerate(row_data):
            row[c_idx].text = str(val)
            row[c_idx].paragraphs[0].runs[0].font.size = Pt(9)
    doc.add_paragraph()

def generate_rapport(paths):
    doc = Document()

    # ── Marges
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.5)

    # ══════════════════════════════════════════
    # PAGE DE COUVERTURE
    # ══════════════════════════════════════════
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("KEYCE INFORMATIQUE & IA")
    run.font.name = 'Calibri'
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = RGBColor(21, 101, 192)

    add_para(doc, "Sous le label Collège de Paris Supérieur", 10, italic=True,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2)
    add_para(doc, "Année Académique 2025 – 2026", 10,
             align=WD_ALIGN_PARAGRAPH.CENTER)

    doc.add_paragraph("\n\n")

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("PROJET TUTORÉ — RAPPORT FINAL")
    run.font.name = 'Calibri'
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor(13, 71, 161)

    doc.add_paragraph("\n")

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(
        "CONCEPTION ET MISE EN PLACE D'UN SYSTÈME INTELLIGENT\n"
        "DE SUIVI ET DE MAINTIEN D'AMAIGRISSEMENT\n"
        "POUR LES PERSONNES OBÈSES"
    )
    run.font.name = 'Calibri'
    run.font.size = Pt(18)
    run.font.bold = True
    run.font.color.rgb = RGBColor(21, 101, 192)

    doc.add_paragraph("\n\n")

    add_para(doc, "Travail effectué du 22 au 31 Mai 2026 dans le cadre du Projet Tutoré",
             11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    doc.add_paragraph()
    add_para(doc, "Rédigé et présenté par :", 11, bold=True,
             align=WD_ALIGN_PARAGRAPH.CENTER)

    members = [
        "NFORMI GRACE DZELAMUNYUI",
        "NJEBA ZILDA BERI",
        "NANDA TATMBA WILFRIED",
        "MOUAFONDOUN MBALA BALKIS",
        "NOUEBISSI TAGNE GREGORY MATHIEU",
        "NASSRINE HAMADOU",
    ]
    for m in members:
        add_para(doc, f"- {m}", 11, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    doc.add_paragraph("\n")
    add_para(doc, "Sous l'encadrement académique de :", 11, italic=True,
             align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, "Monsieur FONKOUA", 12, bold=True,
             align=WD_ALIGN_PARAGRAPH.CENTER, color=(21, 101, 192))

    doc.add_page_break()

    # ══════════════════════════════════════════
    # DEDICACE
    # ══════════════════════════════════════════
    add_heading(doc, "DÉDICACE", 1)
    add_para(doc, (
        "Nous dédions ce projet à nos chers parents, source inépuisable d'amour et de soutien. "
        "Leur confiance indéfectible, leur soutien financier, moral et émotionnel tout au long de "
        "notre parcours scolaire ont été le moteur de notre persévérance et le fondement de notre "
        "réussite. Que ce travail soit l'expression de notre profonde gratitude."
    ))
    doc.add_page_break()

    # ══════════════════════════════════════════
    # REMERCIEMENTS
    # ══════════════════════════════════════════
    add_heading(doc, "REMERCIEMENTS", 1)
    add_para(doc, (
        "La réalisation de ce projet n'aurait pas été possible sans le concours de nombreuses "
        "personnes à qui nous souhaitons exprimer notre sincère reconnaissance."
    ))
    add_para(doc, (
        "Nous adressons nos plus vifs remerciements à Monsieur FONKOUA, notre encadreur académique, "
        "pour sa disponibilité, ses conseils avisés et son soutien constant tout au long de ce projet. "
        "Sa rigueur et son expertise nous ont guidés avec bienveillance."
    ))
    add_para(doc, (
        "Nos remerciements vont également à l'ensemble du corps enseignant de KEYCE INFORMATIQUE & IA "
        "pour la qualité des enseignements dispensés, qui ont constitué le socle de nos compétences "
        "techniques et méthodologiques."
    ))
    add_para(doc, (
        "Nous tenons à remercier la Direction du Centre du Vernet pour nous avoir accordé sa confiance "
        "et fourni les informations nécessaires à la bonne compréhension de ses besoins opérationnels."
    ))
    add_para(doc, "Enfin, nous remercions nos familles pour leur soutien moral et affectif sans faille.")
    doc.add_page_break()

    # ══════════════════════════════════════════
    # AVANT-PROPOS
    # ══════════════════════════════════════════
    add_heading(doc, "AVANT-PROPOS", 1)
    add_para(doc, (
        "Sous le label du Collège de Paris Supérieur, KEYCE INFORMATIQUE & IA est une école supérieure "
        "française fondée avec pour vocation d'offrir des formations d'excellence dans les secteurs clés "
        "des technologies de l'information et de la communication. Présente au Cameroun, l'école forme "
        "des ingénieurs et techniciens capables de répondre aux défis du numérique en Afrique et dans le monde."
    ))
    add_para(doc, "Les filières proposées par KEYCE INFORMATIQUE & IA incluent notamment :")
    filières = [
        "Intelligence Artificielle et Big Data",
        "Administration des Systèmes d'Information",
        "Génie Logiciel et Développement de Solutions Technologiques",
        "Réseaux et Sécurité Informatique",
        "Cybersécurité et Blockchain",
    ]
    for f in filières:
        add_bullet(doc, f)
    add_para(doc, (
        "Dans le cadre de notre formation en Génie Logiciel (niveau B2), nous avons réalisé ce projet "
        "tutoré en partenariat avec le Centre du Vernet, structure spécialisée dans l'accompagnement "
        "des personnes en surpoids à Douala, Cameroun. Ce projet nous a permis d'appliquer concrètement "
        "les compétences acquises en développement web full-stack, en modélisation logicielle et en "
        "déploiement d'applications en production."
    ), space_before=6)
    doc.add_page_break()

    # ══════════════════════════════════════════
    # LISTE DES ABREVIATIONS
    # ══════════════════════════════════════════
    add_heading(doc, "LISTE DES ABRÉVIATIONS", 1)
    abbrevs = [
        ("API",      "Application Programming Interface — Interface de Programmation d'Application"),
        ("CSS",      "Cascading Style Sheets — Feuilles de Style en Cascade"),
        ("CORS",     "Cross-Origin Resource Sharing — Partage des Ressources entre Origines"),
        ("CRUD",     "Create, Read, Update, Delete — Opérations de base sur les données"),
        ("Docker",   "Plateforme de conteneurisation pour le déploiement d'applications"),
        ("HF",       "Hugging Face — Plateforme d'hébergement de modèles et d'applications"),
        ("HTML",     "HyperText Markup Language — Langage de Balisage d'Hypertexte"),
        ("HTTP",     "HyperText Transfer Protocol — Protocole de Communication Web"),
        ("HTTPS",    "HTTP Secure — Version sécurisée du protocole HTTP"),
        ("IMC",      "Indice de Masse Corporelle (kg/m²)"),
        ("JAR",      "Java ARchive — Format de distribution d'applications Java"),
        ("JPA",      "Java Persistence API — Interface de persistance Java"),
        ("JSON",     "JavaScript Object Notation — Format d'échange de données"),
        ("JWT",      "JSON Web Token — Jeton d'authentification sécurisé"),
        ("JRE/JDK",  "Java Runtime/Development Kit — Environnement d'exécution Java"),
        ("MVC",      "Model-View-Controller — Patron de conception logiciel"),
        ("ORM",      "Object-Relational Mapping — Correspondance Objet-Relationnel"),
        ("OTP",      "One-Time Password — Mot de passe à usage unique (code 2FA)"),
        ("REST",     "Representational State Transfer — Architecture de services web"),
        ("SMTP",     "Simple Mail Transfer Protocol — Protocole d'envoi d'emails"),
        ("SQL",      "Structured Query Language — Langage de Requêtes Structurées"),
        ("SPA",      "Single Page Application — Application Web Monopage"),
        ("2FA",      "Two-Factor Authentication — Authentification à Deux Facteurs"),
        ("UML",      "Unified Modeling Language — Langage de Modélisation Unifié"),
        ("URI/URL",  "Uniform Resource Identifier/Locator — Identifiant de Ressource Web"),
        ("VS Code",  "Visual Studio Code — Éditeur de code source"),
    ]
    table = doc.add_table(rows=len(abbrevs), cols=2)
    table.style = 'Table Grid'
    for i, (abbr, desc) in enumerate(abbrevs):
        row = table.rows[i].cells
        row[0].text = abbr
        row[0].paragraphs[0].runs[0].font.bold = True
        row[0].paragraphs[0].runs[0].font.color.rgb = RGBColor(21, 101, 192)
        row[0].paragraphs[0].runs[0].font.size = Pt(10)
        row[1].text = desc
        row[1].paragraphs[0].runs[0].font.size = Pt(10)
    doc.add_page_break()

    # ══════════════════════════════════════════
    # RÉSUMÉ
    # ══════════════════════════════════════════
    add_heading(doc, "RÉSUMÉ", 1)
    add_para(doc, (
        "Le surpoids représente aujourd'hui un enjeu majeur de santé publique à l'échelle mondiale, "
        "touchant des millions de personnes et nécessitant un accompagnement rigoureux et pluridisciplinaire "
        "pour garantir des résultats durables. Ce projet répond à la problématique de la modernisation et "
        "de la digitalisation du Centre du Vernet, une structure spécialisée de Douala souffrant d'une "
        "absence totale d'outils numériques, d'une communication reposant sur le bouche-à-oreille et "
        "d'une gestion entièrement manuelle de ses patients."
    ))
    add_para(doc, (
        "L'objectif principal est de concevoir, développer et déployer une application web full-stack "
        "centralisant la gestion des données clients, la planification des consultations, l'élaboration "
        "de programmes personnalisés (nutrition et sport) et le suivi de l'évolution du poids et de l'IMC."
    ))
    add_para(doc, (
        "Sur le plan technique, la solution s'appuie sur une architecture 3-tiers moderne : un frontend "
        "développé avec React 19 et TypeScript (déployé sur Vercel), un backend REST sécurisé avec "
        "Spring Boot 3.4.5 et Java 17 (déployé sur Hugging Face Spaces via Docker), et une base de "
        "données PostgreSQL hébergée sur Supabase. La sécurité est assurée par une authentification JWT "
        "couplée à une vérification en deux facteurs (2FA) par email. Les notifications automatiques "
        "sont gérées via les services Brevo (email) et Twilio (WhatsApp)."
    ))
    add_para(doc, (
        "La modélisation du système a été conduite rigoureusement à travers les diagrammes UML : "
        "diagramme de cas d'utilisation, de classes, de séquence et d'activité. En automatisant les "
        "processus clés, cette plateforme améliore significativement la visibilité et la productivité "
        "du Centre du Vernet tout en offrant aux patients un outil interactif et motivant."
    ))
    add_para(doc, (
        "Mots-clés : Surpoids, Obésité, Suivi d'amaigrissement, Centre du Vernet, Application Web, "
        "Spring Boot, React, PostgreSQL, JWT, 2FA, UML, Déploiement Cloud."
    ), italic=True, color=(21, 101, 192))
    doc.add_page_break()

    # ══════════════════════════════════════════
    # ABSTRACT
    # ══════════════════════════════════════════
    add_heading(doc, "ABSTRACT", 1)
    add_para(doc, (
        "Overweight has become a major global public health challenge, affecting millions of people "
        "and requiring rigorous, multidisciplinary support to ensure long-term sustainable results. "
        "This project addresses the need to modernize and digitalize the Centre du Vernet, a specialized "
        "wellness and weight management facility in Douala, Cameroon, which currently operates without "
        "any digital tools, relies on word-of-mouth communication, and manages all patient records manually."
    ))
    add_para(doc, (
        "The primary objective is to design, develop, and deploy a full-stack web application that "
        "centralizes patient data management, appointment scheduling, personalized program creation "
        "(nutrition and fitness), and weight/BMI progression tracking."
    ))
    add_para(doc, (
        "From a technical standpoint, the solution leverages a modern 3-tier architecture: a frontend "
        "built with React 19 and TypeScript (deployed on Vercel), a secured REST backend using "
        "Spring Boot 3.4.5 with Java 17 (deployed on Hugging Face Spaces via Docker), and a PostgreSQL "
        "database hosted on Supabase. Security is ensured through JWT authentication combined with "
        "email-based two-factor authentication (2FA). Automated notifications are handled via Brevo "
        "(email) and Twilio (WhatsApp) services."
    ))
    add_para(doc, (
        "The system design was rigorously modeled using UML diagrams (Use Case, Class, Sequence, and "
        "Activity). By automating key processes, this platform significantly enhances the operational "
        "efficiency of Centre du Vernet staff while providing patients with an interactive, ergonomic, "
        "and motivating tool to sustain healthier lifestyle habits over the long term."
    ))
    add_para(doc, (
        "Keywords: Overweight, Obesity, Weight Loss Tracking, Centre du Vernet, Web Application, "
        "Spring Boot, React, PostgreSQL, JWT, 2FA, UML, Cloud Deployment."
    ), italic=True, color=(21, 101, 192))
    doc.add_page_break()

    # ══════════════════════════════════════════
    # INTRODUCTION GÉNÉRALE
    # ══════════════════════════════════════════
    add_heading(doc, "INTRODUCTION GÉNÉRALE", 1)

    add_heading(doc, "1. Contexte et Problématique", 2)

    add_heading(doc, "1.1 Le contexte général du surpoids et de l'obésité", 3)
    add_para(doc, (
        "Le surpoids et l'obésité constituent aujourd'hui des problèmes de santé majeurs à l'échelle "
        "mondiale. Selon l'Organisation Mondiale de la Santé (OMS), plus d'un milliard de personnes "
        "dans le monde sont en situation d'obésité. En Afrique subsaharienne, et particulièrement au "
        "Cameroun, cette tendance est en forte progression, alimentée par l'évolution des modes de vie, "
        "la sédentarité et les changements alimentaires."
    ))
    add_para(doc, (
        "Si la perte de poids initiale constitue un premier défi pour les personnes concernées, le "
        "maintien durable de cet amaigrissement s'avère encore plus complexe. Il nécessite un "
        "accompagnement pluridisciplinaire strict et continu, combinant suivi nutritionnel, coaching "
        "sportif, soutien psychologique et mesures anthropométriques régulières."
    ))

    add_heading(doc, "1.2 Situation actuelle du Centre du Vernet", 3)
    add_para(doc, (
        "Le Centre du Vernet est une structure existante basée à Douala-Bonapriso, spécialisée dans "
        "l'accompagnement des personnes en situation de surpoids souhaitant perdre du poids et "
        "stabiliser leurs résultats de manière durable, selon la Méthode Laurand. Malgré l'expertise "
        "de ses intervenants (nutritionnistes, coachs), le centre se heurte aujourd'hui à des limites "
        "organisationnelles et structurelles majeures :"
    ))
    problemes = [
        ("Déficit de visibilité", (
            "Le centre n'est pas doté d'outils numériques modernes ni d'une présence en ligne "
            "optimisée. Il peine à se faire connaître auprès d'un plus large public et à valoriser "
            "la qualité de ses services."
        )),
        ("Absence totale d'automatisation", (
            "La gestion globale de la structure s'effectue sans système d'information. Les inscriptions, "
            "le suivi des mesures corporelles (poids, IMC), l'historique médical et l'attribution des "
            "programmes se font de manière entièrement manuelle ou artisanale, engendrant des risques de "
            "perte de données et une perte de temps considérable."
        )),
        ("Communication informelle et fragile", (
            "La transmission des informations entre les professionnels du centre et vers les clients "
            "repose exclusivement sur le bouche-à-oreille. Ce manque de formalisation entraîne des "
            "oublis de rendez-vous, des incompréhensions dans le suivi des régimes ou des exercices, "
            "et empêche un accompagnement fluide et rigoureux."
        )),
    ]
    for titre, desc in problemes:
        p = doc.add_paragraph(style='List Bullet')
        run1 = p.add_run(f"{titre} : ")
        run1.font.bold = True
        run1.font.size = Pt(11)
        run1.font.color.rgb = RGBColor(21, 101, 192)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(6)

    add_heading(doc, "1.3 Opportunité et objectifs de la transformation digitale", 3)
    add_para(doc, (
        "Face à ce constat, la modernisation des processus du Centre du Vernet est indispensable. "
        "Le présent projet s'inscrit précisément dans cette démarche de transformation digitale. "
        "L'introduction d'un système d'information centralisé permettra d'automatiser la gestion "
        "des dossiers, de sécuriser la communication entre coachs et clients, et d'offrir une "
        "plateforme moderne capable de booster la visibilité et l'image de marque du centre."
    ))

    add_heading(doc, "2. Annonce du Plan", 2)
    add_para(doc, "Ce rapport est structuré en trois chapitres :")
    chapitres = [
        ("Chapitre 1", "Présentation du cadre d'étude et étude de l'existant",
         "Ce chapitre présente l'environnement du projet, le Centre du Vernet, ses domaines "
         "d'activité et ses services. Une analyse approfondie de l'existant met en lumière les "
         "processus actuels et leurs limites, permettant de poser formellement la problématique."),
        ("Chapitre 2", "Méthodologie de résolution des problèmes",
         "Ce chapitre détaille la démarche scientifique et technique adoptée, incluant "
         "l'ingénierie des exigences, la spécification des besoins fonctionnels et non "
         "fonctionnels, la modélisation UML complète et l'architecture technique choisie."),
        ("Chapitre 3", "Résultats et Discussion",
         "Ce chapitre présente les technologies utilisées, les interfaces de l'application "
         "développée, la structure de la base de données, et évalue l'impact de la solution "
         "sur les problèmes identifiés."),
    ]
    for num, titre, desc in chapitres:
        p = doc.add_paragraph(style='List Bullet')
        run1 = p.add_run(f"{num} — {titre} : ")
        run1.font.bold = True
        run1.font.size = Pt(11)
        run1.font.color.rgb = RGBColor(26, 35, 126)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(6)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # CHAPITRE 1
    # ══════════════════════════════════════════
    add_heading(doc, "CHAPITRE 1 : PRÉSENTATION DU CADRE D'ÉTUDE ET ÉTUDE DE L'EXISTANT", 1)

    add_heading(doc, "1. Présentation du cadre d'étude : Le Centre du Vernet", 2)
    add_para(doc, (
        "Le Centre du Vernet est une structure privée spécialisée dans l'accompagnement personnalisé "
        "des personnes en situation de surpoids, implantée dans le quartier Bonapriso à Douala, "
        "Cameroun. Sa mission centrale est d'aider ses clients à perdre du poids et à maintenir "
        "durablement leur amaigrissement grâce à une prise en charge pluridisciplinaire s'appuyant "
        "sur la Méthode Laurand, une approche certifiée combinant nutrition, sport et hygiène de vie."
    ))

    add_heading(doc, "1.1 Domaines d'activité et services", 3)
    services = [
        "Suivi nutritionnel personnalisé : élaboration de plans alimentaires adaptés à chaque client",
        "Coaching sportif : programmes d'activités physiques calibrés selon l'état de santé",
        "Accompagnement psychologique : soutien motivationnel et gestion du comportement alimentaire",
        "Stabilisation du poids : protocoles de maintien après la phase d'amaigrissement",
        "Conseil en hygiène de vie : alimentation, sommeil, hydratation et gestion du stress",
        "Mesures anthropométriques régulières : suivi du poids, de l'IMC, tour de taille",
    ]
    for s in services:
        add_bullet(doc, s)

    add_heading(doc, "2. Étude et Diagnostic de l'Existant", 2)
    add_para(doc, (
        "L'analyse du fonctionnement actuel du Centre du Vernet révèle un modèle de gestion "
        "purement traditionnel qui repose sur des processus manuels et artisanaux, insuffisants "
        "pour répondre aux exigences modernes de qualité de service."
    ))

    add_heading(doc, "2.1 Analyse des processus actuels", 3)
    processus = [
        ("Gestion des dossiers clients",
         "Les informations des clients (mesures, historique médical, programmes) sont consignées "
         "sur des fiches papier. Il n'existe aucune base de données centralisée, rendant la "
         "recherche et la mise à jour des dossiers très fastidieuses."),
        ("Planification des rendez-vous",
         "Les rendez-vous sont gérés via un agenda papier ou un simple tableau mural. "
         "Il n'existe pas de système de rappel automatique, ce qui génère de nombreux oublis."),
        ("Communication avec les clients",
         "Les échanges entre les professionnels du centre et les clients s'effectuent "
         "exclusivement par téléphone ou en face à face. Il n'existe aucun canal numérique "
         "sécurisé pour le suivi entre les séances."),
        ("Suivi de l'évolution",
         "Le suivi du poids et de l'IMC est effectué manuellement lors des séances, sans "
         "outil de visualisation de l'évolution dans le temps. Les clients ne peuvent pas "
         "consulter leur progression entre deux visites."),
    ]
    for titre, desc in processus:
        p = doc.add_paragraph(style='List Bullet')
        run1 = p.add_run(f"{titre} : ")
        run1.font.bold = True
        run1.font.size = Pt(11)
        run1.font.color.rgb = RGBColor(21, 101, 192)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(6)

    add_heading(doc, "2.2 Tableau de synthèse des dysfonctionnements", 3)
    table = doc.add_table(rows=4, cols=3)
    table.style = 'Table Grid'
    headers = ["Dysfonctionnement", "Impact", "Besoin identifié"]
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.size = Pt(10)
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '1565C0')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:val'), 'clear')
        tcPr.append(shd)
    dysfuncts = [
        ("Gestion manuelle des dossiers", "Perte de données, erreurs, perte de temps", "Base de données centralisée"),
        ("Absence de rappel automatique", "Oubli de rendez-vous, absentéisme", "Système de notifications automatiques"),
        ("Communication informelle", "Malentendus, isolation du client", "Messagerie sécurisée et notifications"),
    ]
    for i, (d, imp, need) in enumerate(dysfuncts):
        row = table.rows[i+1].cells
        for j, val in enumerate([d, imp, need]):
            row[j].text = val
            row[j].paragraphs[0].runs[0].font.size = Pt(9)
    doc.add_paragraph()

    add_heading(doc, "3. Problématique et Solution Proposée", 2)
    add_para(doc, (
        "Face à ce constat, la problématique centrale de ce projet est la suivante :"
    ))
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.left_indent = Cm(1)
    p.paragraph_format.right_indent = Cm(1)
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(
        "« Comment concevoir un système d'information permettant d'automatiser la gestion "
        "du Centre du Vernet, de fiabiliser la communication entre professionnels et clients, "
        "et d'optimiser le suivi du surpoids pour garantir un amaigrissement durable ? »"
    )
    run.font.name = 'Calibri'
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.italic = True
    run.font.color.rgb = RGBColor(21, 101, 192)

    add_para(doc, (
        "Pour répondre à cette problématique, nous proposons la conception et le développement "
        "d'une application informatique centralisée (Web). Cette solution permettra de :"
    ), space_before=6)
    solutions = [
        "Numériser et centraliser les dossiers clients dans une base de données sécurisée",
        "Automatiser la planification des rendez-vous et l'envoi de rappels",
        "Remplacer le bouche-à-oreille par une messagerie sécurisée et des notifications automatiques",
        "Offrir un suivi graphique de l'évolution du poids et de l'IMC en temps réel",
        "Moderniser la visibilité du centre via une vitrine numérique",
        "Générer des rapports et statistiques de progression pour les professionnels",
    ]
    for s in solutions:
        add_bullet(doc, s)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # CHAPITRE 2
    # ══════════════════════════════════════════
    add_heading(doc, "CHAPITRE 2 : MÉTHODOLOGIE DE RÉSOLUTION DES PROBLÈMES", 1)

    add_heading(doc, "1. Démarche et Étapes de Résolution", 2)
    add_para(doc, (
        "Pour moderniser la gestion du Centre du Vernet, le projet suit un cycle de développement "
        "logiciel structuré inspiré du modèle en cascade adapté, organisé en cinq phases principales :"
    ))
    etapes = [
        ("Phase 1 — Analyse", "Recueil et formalisation des besoins auprès du personnel du centre et des clients. Étude de l'existant et identification des contraintes."),
        ("Phase 2 — Conception", "Modélisation technique du système via UML (diagrammes de cas d'utilisation, de classes, de séquence et d'activité). Conception de la base de données."),
        ("Phase 3 — Développement", "Programmation de l'application : développement du backend (API REST avec Spring Boot), du frontend (React + TypeScript) et intégration des services tiers."),
        ("Phase 4 — Tests", "Validation fonctionnelle (tests manuels des interfaces), tests d'intégration de l'API (Postman), et vérification de la sécurité (JWT, CORS, HTTPS)."),
        ("Phase 5 — Déploiement", "Conteneurisation via Docker, mise en ligne sur Vercel (frontend) et Hugging Face Spaces (backend), et formation des utilisateurs."),
    ]
    table = doc.add_table(rows=len(etapes)+1, cols=2)
    table.style = 'Table Grid'
    for i, h in enumerate(["Phase", "Description"]):
        cell = table.rows[0].cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.size = Pt(10)
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '1565C0')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:val'), 'clear')
        tcPr.append(shd)
    for i, (num, desc) in enumerate(etapes):
        row = table.rows[i+1].cells
        row[0].text = num
        row[0].paragraphs[0].runs[0].font.bold = True
        row[0].paragraphs[0].runs[0].font.size = Pt(9)
        row[0].paragraphs[0].runs[0].font.color.rgb = RGBColor(21, 101, 192)
        row[1].text = desc
        row[1].paragraphs[0].runs[0].font.size = Pt(9)
    doc.add_paragraph()

    add_heading(doc, "2. Spécification des Besoins", 2)

    add_heading(doc, "2.1 Besoins fonctionnels", 3)
    bf = [
        "Gestion des utilisateurs : inscription, connexion sécurisée (JWT + 2FA email), gestion des rôles (CLIENT, COACH, NUTRITIONNISTE, ADMIN)",
        "Suivi du poids et de l'IMC : saisie, historique, graphique d'évolution avec calcul automatique de l'IMC",
        "Gestion des programmes : création de programmes alimentaires et sportifs personnalisés, plans hebdomadaires",
        "Planification des rendez-vous : calendrier interactif, confirmation, rappel automatique 24h avant",
        "Messagerie sécurisée : échanges en temps réel entre clients et professionnels",
        "Catalogue de ressources : documents nutritionnels, vidéos d'exercices, images catégorisées",
        "Système de notifications : alertes en temps réel (email, WhatsApp) et dans l'application",
        "Génération de dossiers PDF : rapport complet du suivi client exportable",
        "Journal d'activité : traçabilité complète des actions utilisateurs (audit log)",
        "Dashboard Admin : statistiques globales, gestion des utilisateurs et paramètres",
    ]
    for b in bf:
        add_bullet(doc, b)

    add_heading(doc, "2.2 Besoins non fonctionnels", 3)
    bnf = [
        "Sécurité : authentification JWT (HS256, TTL 24h), 2FA obligatoire, HTTPS, BCrypt pour les mots de passe, CORS sécurisé",
        "Performance : temps de réponse de l'API < 500ms pour les requêtes courantes, interface fluide",
        "Disponibilité : application accessible 24h/24, 7j/7 via le déploiement cloud (uptime > 99%)",
        "Scalabilité : architecture stateless permettant une montée en charge horizontale",
        "Maintenabilité : code structuré en couches (Controller, Service, Repository), documenté",
        "Ergonomie : interface responsive adaptée à tous les écrans (PC, tablette, smartphone)",
        "Portabilité : déploiement via Docker, indépendant de l'infrastructure sous-jacente",
    ]
    for b in bnf:
        add_bullet(doc, b)

    add_heading(doc, "3. Modélisation UML", 2)
    add_para(doc, (
        "La modélisation UML (Unified Modeling Language) est utilisée pour structurer formellement "
        "l'architecture logicielle avant le développement. Quatre types de diagrammes ont été produits."
    ))

    add_heading(doc, "3.1 Diagramme de Cas d'Utilisation", 3)
    add_para(doc, (
        "Le diagramme de cas d'utilisation modélise les interactions entre les acteurs du système "
        "et les fonctionnalités disponibles. Trois acteurs principaux ont été identifiés : "
        "le Client (patient), le Coach/Nutritionniste, et l'Administrateur. Des acteurs "
        "secondaires représentent les services externes (Brevo, Twilio)."
    ))
    add_image(doc, paths['uc'], "Figure 1 : Diagramme de Cas d'Utilisation — Système Centre du Vernet", Cm(16))

    add_heading(doc, "3.2 Diagramme de Classes", 3)
    add_para(doc, (
        "Le diagramme de classes représente la structure statique du système : les entités "
        "du domaine métier, leurs attributs, leurs méthodes et les associations qui les relient. "
        "Il constitue la base de la conception de la base de données relationnelle."
    ))
    add_para(doc, "Les principales classes identifiées sont :")
    classes_desc = [
        ("AppUser", "Entité centrale représentant tout utilisateur du système. Contient les informations d'authentification et le rôle (CLIENT, COACH, NUTRITIONNISTE, ADMIN)."),
        ("Client", "Extension de AppUser spécifique aux patients, contenant les données anthropométriques (poids, taille, objectif)."),
        ("WeightEntry", "Enregistrement d'une mesure de poids à une date donnée. Permet de tracer la courbe d'évolution."),
        ("Appointment", "Représente un rendez-vous entre un client et un professionnel du centre."),
        ("MessageThread / Message", "Gestion de la messagerie interne sécurisée entre utilisateurs."),
        ("Notification", "Alertes générées par le système pour informer les utilisateurs."),
        ("CatalogAsset", "Ressources du catalogue (documents, images, vidéos) du centre."),
        ("ClientProgram / WeeklyPlan", "Programme personnalisé et ses plans hebdomadaires associés."),
        ("ActivityLog", "Journal d'audit traçant toutes les actions importantes."),
    ]
    for nom, desc in classes_desc:
        p = doc.add_paragraph(style='List Bullet')
        run1 = p.add_run(f"{nom} : ")
        run1.font.bold = True
        run1.font.size = Pt(11)
        run1.font.color.rgb = RGBColor(21, 101, 192)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(4)
    add_image(doc, paths['class'], "Figure 2 : Diagramme de Classes — Système Centre du Vernet", Cm(16))

    add_heading(doc, "3.3 Diagramme de Séquence — Connexion avec 2FA", 3)
    add_para(doc, (
        "Ce diagramme illustre la dynamique des échanges lors du processus de connexion "
        "sécurisé avec authentification à deux facteurs (2FA). Cinq participants "
        "interviennent : le Client, le Frontend (React), le Backend (Spring Boot), "
        "la Base de données (PostgreSQL) et le Service Email (Brevo SMTP)."
    ))
    add_image(doc, paths['seq_login'], "Figure 3 : Diagramme de Séquence — Connexion avec Authentification 2FA", Cm(16))

    add_heading(doc, "3.4 Diagramme de Séquence — Prise de Rendez-vous", 3)
    add_para(doc, (
        "Ce diagramme décrit le flux complet de la prise de rendez-vous en ligne, "
        "depuis la consultation des créneaux disponibles jusqu'à l'envoi des "
        "confirmations automatiques par email au client et au coach."
    ))
    add_image(doc, paths['seq_rdv'], "Figure 4 : Diagramme de Séquence — Prise de Rendez-vous", Cm(16))

    add_heading(doc, "3.5 Diagramme d'Activité — Suivi du Poids", 3)
    add_para(doc, (
        "Ce diagramme représente le flux d'activités lors de l'ajout d'une mesure "
        "de poids par un client, incluant la validation des données et le calcul "
        "automatique de l'IMC."
    ))
    add_image(doc, paths['activity'], "Figure 5 : Diagramme d'Activité — Saisie d'une Mesure de Poids", Cm(10))

    add_heading(doc, "4. Architecture Technique et Planification", 2)

    add_heading(doc, "4.1 Architecture technique retenue", 3)
    add_para(doc, (
        "La solution repose sur une architecture 3-tiers (Présentation — Métier — Données), "
        "conforme au patron MVC (Model-View-Controller) :"
    ))
    add_image(doc, paths['arch'], "Figure 6 : Architecture Technique — Système Centre du Vernet", Cm(16))

    tech_rows = [
        ("Frontend", "React 19 + TypeScript + Vite", "Vercel (CDN global)"),
        ("Backend", "Spring Boot 3.4.5 + Java 17", "Hugging Face Spaces (Docker)"),
        ("Base de données", "PostgreSQL 15", "Supabase (Session Pooler)"),
        ("Authentification", "JWT (HS256) + 2FA email", "—"),
        ("Emails", "Brevo SMTP (port 587)", "Cloud Brevo"),
        ("WhatsApp", "Twilio API", "Cloud Twilio"),
        ("Conteneurisation", "Docker (eclipse-temurin:17-alpine)", "—"),
        ("Contrôle de version", "Git + GitHub", "github.com"),
    ]
    add_db_table(doc, "Tableau 1 : Environnement technologique",
                 ["Couche / Service", "Technologie", "Hébergement"],
                 tech_rows)

    add_heading(doc, "4.2 Diagramme de Gantt — Planification du projet", 3)
    add_para(doc, (
        "Le projet a été réalisé sur une période de 9 jours (22 au 31 Mai 2026), "
        "répartis selon le calendrier suivant :"
    ))
    add_image(doc, paths['gantt'], "Figure 7 : Diagramme de Gantt — Planification du Projet", Cm(16))

    doc.add_page_break()

    # ══════════════════════════════════════════
    # CHAPITRE 3
    # ══════════════════════════════════════════
    add_heading(doc, "CHAPITRE 3 : RÉSULTATS ET DISCUSSION", 1)

    add_heading(doc, "1. Environnement de Réalisation", 2)
    add_para(doc, (
        "Le système a été développé en utilisant des technologies modernes assurant performance, "
        "sécurité et maintenabilité. Voici le détail de l'environnement de développement :"
    ))
    env_rows = [
        ("Langages", "Java 17 (backend), TypeScript / JavaScript (frontend)"),
        ("Framework backend", "Spring Boot 3.4.5 avec Spring Security, Spring Data JPA, Spring Mail"),
        ("Framework frontend", "React 19, React Router DOM 7, Vite 8"),
        ("Base de données", "PostgreSQL (Supabase) avec Hibernate ORM"),
        ("Sécurité", "JWT (HS256), BCrypt, 2FA, CORS, HTTPS"),
        ("Outils IDE", "IntelliJ IDEA (backend), Visual Studio Code (frontend)"),
        ("Tests API", "Postman"),
        ("Gestion de build", "Gradle (backend), npm + Vite (frontend)"),
        ("Conteneurisation", "Docker avec image eclipse-temurin:17-jre-alpine"),
        ("CI/CD", "Git Push déclenche le build automatique (HF Spaces + Vercel)"),
        ("Contrôle de version", "Git + GitHub (github.com/Njeba-Zilda/centre-du-vernet)"),
    ]
    add_db_table(doc, "", ["Composant", "Détail"], env_rows)

    add_heading(doc, "2. Présentation des Résultats", 2)

    add_heading(doc, "2.1 Page d'accueil et Vitrine", 3)
    add_para(doc, (
        "L'application est accessible via l'URL : https://centre-du-vernet.vercel.app. "
        "La page d'accueil (vitrine) présente le Centre du Vernet, ses services, "
        "son approche (Méthode Laurand) et les boutons d'appel à l'action pour "
        "l'inscription et la connexion."
    ))

    add_heading(doc, "2.2 Interface de Connexion avec 2FA", 3)
    add_para(doc, (
        "L'accès à l'application est sécurisé par une connexion en deux étapes : "
        "saisie de l'email et du mot de passe, puis vérification d'un code OTP "
        "envoyé automatiquement par email (service Brevo). Cette double vérification "
        "garantit la protection des données de santé des patients."
    ))

    add_heading(doc, "2.3 Tableau de Bord (Dashboard)", 3)
    add_para(doc, (
        "Le tableau de bord offre une vue synthétique personnalisée selon le rôle "
        "de l'utilisateur connecté : statistiques clients pour l'administrateur, "
        "planning des rendez-vous pour le coach, évolution du poids pour le client. "
        "Il centralise les informations essentielles en temps réel."
    ))

    add_heading(doc, "2.4 Suivi du Poids et de l'IMC", 3)
    add_para(doc, (
        "Le module de suivi permet aux clients de saisir leurs mesures de poids "
        "régulièrement. L'application calcule automatiquement l'IMC (poids / taille²) "
        "et affiche un graphique d'évolution dans le temps, permettant de visualiser "
        "clairement la progression vers l'objectif fixé."
    ))

    add_heading(doc, "2.5 Gestion des Rendez-vous", 3)
    add_para(doc, (
        "Le module de rendez-vous propose un calendrier interactif permettant aux "
        "clients de sélectionner un créneau disponible. Une confirmation automatique "
        "est envoyée par email, et un rappel est programmé 24 heures avant le "
        "rendez-vous via Spring Scheduler."
    ))

    add_heading(doc, "2.6 Messagerie Sécurisée", 3)
    add_para(doc, (
        "La messagerie interne permet des échanges sécurisés entre clients et "
        "professionnels du centre, remplaçant définitivement le bouche-à-oreille "
        "et les échanges informels. Chaque message est lié à un fil de discussion "
        "(thread) identifié par son sujet."
    ))

    add_heading(doc, "2.7 Catalogue de Ressources", 3)
    add_para(doc, (
        "Le catalogue permet à l'équipe du centre de mettre à disposition des "
        "clients des ressources multimédias (documents PDF, images, vidéos) "
        "organisées par catégorie (nutrition, exercices, régimes)."
    ))

    add_heading(doc, "3. Structure de la Base de Données", 2)
    add_para(doc, (
        "La fiabilité du système repose sur une base de données relationnelle PostgreSQL "
        "hébergée sur Supabase. Voici les principales tables et leurs structures :"
    ))

    # Tables
    add_db_table(doc, "Table APP_USER — Utilisateurs du système",
                 ["Colonne", "Type", "Contrainte", "Description"],
                 [
                     ("id", "BIGINT", "PK, AUTO_INC", "Identifiant unique"),
                     ("email", "VARCHAR(255)", "UNIQUE, NOT NULL", "Adresse email (login)"),
                     ("password", "VARCHAR(255)", "NOT NULL", "Mot de passe hashé (BCrypt)"),
                     ("role", "VARCHAR(20)", "NOT NULL", "ADMIN / COACH / NUTRITIONNISTE / CLIENT"),
                     ("nom", "VARCHAR(100)", "NOT NULL", "Nom de famille"),
                     ("prenom", "VARCHAR(100)", "NOT NULL", "Prénom"),
                     ("telephone", "VARCHAR(20)", "", "Numéro de téléphone"),
                     ("date_inscription", "TIMESTAMP", "DEFAULT NOW()", "Date de création du compte"),
                 ])

    add_db_table(doc, "Table CLIENT — Données anthropométriques",
                 ["Colonne", "Type", "Contrainte", "Description"],
                 [
                     ("id", "BIGINT", "PK, AUTO_INC", "Identifiant unique"),
                     ("user_id", "BIGINT", "FK → APP_USER", "Référence utilisateur (1:1)"),
                     ("poids", "DECIMAL(5,2)", "", "Poids actuel en kg"),
                     ("taille", "DECIMAL(5,2)", "", "Taille en cm"),
                     ("objectif_poids", "DECIMAL(5,2)", "", "Poids cible en kg"),
                     ("date_naissance", "DATE", "", "Date de naissance"),
                 ])

    add_db_table(doc, "Table WEIGHT_ENTRY — Historique du poids",
                 ["Colonne", "Type", "Contrainte", "Description"],
                 [
                     ("id", "BIGINT", "PK, AUTO_INC", "Identifiant unique"),
                     ("client_id", "BIGINT", "FK → CLIENT", "Référence client"),
                     ("date", "DATE", "NOT NULL", "Date de la mesure"),
                     ("poids", "DECIMAL(5,2)", "NOT NULL", "Poids mesuré en kg"),
                     ("imc", "DECIMAL(4,2)", "", "IMC calculé (poids/taille²)"),
                 ])

    add_db_table(doc, "Table APPOINTMENT — Rendez-vous",
                 ["Colonne", "Type", "Contrainte", "Description"],
                 [
                     ("id", "BIGINT", "PK, AUTO_INC", "Identifiant unique"),
                     ("client_id", "BIGINT", "FK → CLIENT", "Référence client"),
                     ("coach_id", "BIGINT", "FK → APP_USER", "Référence coach"),
                     ("date_heure", "TIMESTAMP", "NOT NULL", "Date et heure du RDV"),
                     ("type", "VARCHAR(50)", "", "Type de séance"),
                     ("statut", "VARCHAR(20)", "", "LIBRE / CONFIRME / ANNULE"),
                 ])

    add_db_table(doc, "Table CLIENT_PROGRAM — Programmes personnalisés",
                 ["Colonne", "Type", "Contrainte", "Description"],
                 [
                     ("id", "BIGINT", "PK, AUTO_INC", "Identifiant unique"),
                     ("client_id", "BIGINT", "FK → CLIENT", "Référence client"),
                     ("cree_par_id", "BIGINT", "FK → APP_USER", "Professionnel créateur"),
                     ("date_debut", "DATE", "NOT NULL", "Début du programme"),
                     ("date_fin", "DATE", "", "Fin prévue du programme"),
                     ("notes", "TEXT", "", "Notes et observations"),
                 ])

    # Relations
    add_para(doc, "Relations entre les tables :", bold=True, color=(21, 101, 192), space_before=8)
    relations = [
        "Un APP_USER de type CLIENT possède un et un seul enregistrement CLIENT (Relation 1:1)",
        "Un CLIENT peut avoir plusieurs WEIGHT_ENTRY pour tracer sa courbe d'évolution (Relation 1:N)",
        "Un CLIENT peut avoir plusieurs APPOINTMENT sur la durée de son suivi (Relation 1:N)",
        "Un CLIENT peut être associé à plusieurs CLIENT_PROGRAM successifs (Relation 1:N)",
        "Un CLIENT_PROGRAM est composé de plusieurs WEEKLY_PLAN (plans hebdomadaires) (Relation 1:N)",
        "Un APP_USER peut envoyer et recevoir plusieurs NOTIFICATION (Relation 1:N)",
    ]
    for r in relations:
        add_bullet(doc, r)

    add_heading(doc, "4. Discussion et Impact du Système", 2)
    add_para(doc, (
        "L'implémentation de cette solution apporte des changements concrets et mesurables "
        "au Centre du Vernet :"
    ))
    impacts = [
        ("Éradication du 'Bouche-à-oreille'",
         "Le système de notifications automatiques (email via Brevo, WhatsApp via Twilio) "
         "et la messagerie sécurisée garantissent une transmission fiable et instantanée "
         "de l'information. Les oublis de rendez-vous sont éliminés grâce aux rappels automatiques."),
        ("Automatisation intégrale",
         "Le calcul automatique de l'IMC, la génération de rapports PDF et les alertes "
         "automatiques suppriment les erreurs manuelles et libèrent du temps pour "
         "l'accompagnement humain."),
        ("Amélioration de la visibilité",
         "La plateforme digitale (https://centre-du-vernet.vercel.app) modernise l'image du "
         "centre et facilite l'acquisition de nouveaux clients grâce à une présence numérique "
         "structurée et professionnelle."),
        ("Sécurité des données de santé",
         "L'authentification JWT avec 2FA, HTTPS obligatoire et le chiffrement BCrypt des "
         "mots de passe garantissent la confidentialité des données de santé des patients, "
         "conformément aux bonnes pratiques de sécurité."),
        ("Pérennisation des résultats",
         "Le suivi continu entre les consultations (graphiques d'évolution, notifications "
         "de motivation, programmes accessibles) renforce l'engagement des clients et "
         "favorise un maintien durable de l'amaigrissement."),
        ("Scalabilité et pérennité",
         "L'architecture containerisée (Docker) et le déploiement cloud permettent une "
         "montée en charge facilement et garantissent la continuité de service sans "
         "investissement matériel pour le centre."),
    ]
    for titre, desc in impacts:
        p = doc.add_paragraph(style='List Bullet')
        run1 = p.add_run(f"{titre} : ")
        run1.font.bold = True
        run1.font.size = Pt(11)
        run1.font.color.rgb = RGBColor(21, 101, 192)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(6)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # CONCLUSION GÉNÉRALE
    # ══════════════════════════════════════════
    add_heading(doc, "CONCLUSION GÉNÉRALE", 1)
    add_para(doc, (
        "Ce projet de transformation digitale a permis de moderniser en profondeur la gestion "
        "du Centre du Vernet en substituant un fonctionnement traditionnel et précaire, basé sur "
        "le bouche-à-oreille et les processus manuels, par un système d'information centralisé, "
        "performant et sécurisé."
    ))
    add_para(doc, (
        "Grâce à une méthodologie rigoureuse (cycle de développement en cascade adapté, "
        "modélisation UML complète) et une architecture technique moderne (React 19, "
        "Spring Boot 3.4.5, PostgreSQL/Supabase, Docker), l'application développée "
        "répond intégralement aux besoins identifiés :"
    ))
    resultats = [
        "La gestion numérique et centralisée des dossiers clients élimine les risques de perte de données",
        "L'authentification sécurisée (JWT + 2FA) protège les données de santé sensibles",
        "Les notifications automatiques (email et WhatsApp) remplacent définitivement le bouche-à-oreille",
        "Le suivi graphique de l'évolution du poids et de l'IMC motive les patients",
        "La messagerie sécurisée fluidifie la communication entre professionnels et clients",
        "Le déploiement cloud (Vercel + Hugging Face Spaces) assure une disponibilité 24h/24",
    ]
    for r in resultats:
        add_bullet(doc, r)

    add_para(doc, (
        "Ce travail pose des fondations solides pour l'avenir du centre, ouvrant la voie à "
        "des évolutions technologiques majeures telles que l'intégration de l'Intelligence "
        "Artificielle pour des recommandations alimentaires et sportives prédictives et "
        "ultra-personnalisées, le développement d'une application mobile native (iOS/Android), "
        "ou encore l'intégration de capteurs connectés (balances, tensiomètres) pour un "
        "suivi automatisé des mesures."
    ), space_before=8)
    add_para(doc, (
        "En définitive, ce projet illustre parfaitement la valeur ajoutée du Génie Logiciel "
        "dans la transformation des structures de santé africaines, et constitue une "
        "démonstration concrète des compétences acquises au sein de KEYCE INFORMATIQUE & IA."
    ))

    doc.add_page_break()

    # ══════════════════════════════════════════
    # RÉFÉRENCES BIBLIOGRAPHIQUES
    # ══════════════════════════════════════════
    add_heading(doc, "RÉFÉRENCES BIBLIOGRAPHIQUES", 1)
    refs = [
        "[1] Spring Framework. (2024). Spring Boot Reference Documentation 3.4.x. https://docs.spring.io/spring-boot/docs/3.4.x/reference/html/",
        "[2] React Team. (2024). React 19 Release Notes. https://react.dev/blog/2024/12/05/react-19",
        "[3] Supabase Documentation. (2024). Supabase PostgreSQL — Connection Pooler. https://supabase.com/docs",
        "[4] Hugging Face. (2024). Docker Spaces Documentation. https://huggingface.co/docs/hub/spaces-sdks-docker",
        "[5] Vercel. (2024). Vercel Deployment Documentation. https://vercel.com/docs",
        "[6] Fowler, M. (2004). UML Distilled: A Brief Guide to the Standard Object Modeling Language (3rd ed.). Addison-Wesley.",
        "[7] Organisation Mondiale de la Santé (OMS). (2024). Obésité et surpoids — Principaux faits. https://www.who.int/fr/news-room/fact-sheets/detail/obesity-and-overweight",
        "[8] Brevo. (2024). SMTP Relay Documentation. https://help.brevo.com/hc/en-us/articles/209462765",
        "[9] Twilio. (2024). WhatsApp Business API Documentation. https://www.twilio.com/docs/whatsapp",
        "[10] JSON Web Token Introduction. (2024). JWT.io — JSON Web Tokens. https://jwt.io/introduction",
    ]
    for ref in refs:
        add_para(doc, ref, size=10, indent=False, space_after=4)

    # ── Sauvegarde
    out_path = os.path.join(OUTPUT_DIR, "PROJET TUTEURE RAPPORT.docx")
    doc.save(out_path)
    print(f"\nRapport sauvegardé : {out_path}")
    return out_path


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("=== Génération des diagrammes ===")
    paths = {
        'uc':        gen_use_case(),
        'class':     gen_class_diagram(),
        'seq_login': gen_sequence_login(),
        'seq_rdv':   gen_sequence_rdv(),
        'activity':  gen_activity(),
        'arch':      gen_architecture(),
        'gantt':     gen_gantt(),
    }
    print("\n=== Génération du rapport Word ===")
    out = generate_rapport(paths)
    print(f"\n✓ Rapport complet généré : {out}")
