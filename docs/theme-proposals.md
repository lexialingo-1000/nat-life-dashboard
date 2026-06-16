# Nat Life — Propositions de thème (V1.1)

3 directions visuelles à présenter à Natacha. Chacune a une intention différente. Une fois choisie, on ajuste `tailwind.config.ts` + `globals.css` (CSS variables) + types de composants.

---

## Direction A — Patrimoine moderne (Recommandée)

> *SaaS warm, immobilier premium. Inspiration : Linear + Notion + Stripe Atlas.*

| Rôle | Couleur | HSL |
|---|---|---|
| Background | `#f5f1e8` | 41 38% 94% |
| Foreground | `#1a1a1a` | 0 0% 10% |
| Muted | `#ebe6d9` | 41 26% 89% |
| Border | `#d9d2bf` | 42 22% 80% |
| Accent primaire (action / CTA) | `#059669` | 161 94% 30% (émeraude profond) |
| Accent secondaire (highlight, lien) | `#0e7490` | 192 82% 31% (bleu canard) |
| Sidebar | `#1a1a1a` | (charcoal) |
| Sidebar foreground | `#f5f1e8` | |

**Typo** : `Inter` (sans, body) + `Söhne` ou `Geist` (titres). Pas de serif.

**Vibe** : moderne, chaleureux, professionnel. La palette warm sand crée une sensation "documents notariés" + l'émeraude apporte le côté action SaaS. Adapté à un dashboard immo.

---

## Direction B — Studio architecte

> *Éditorial, pro, peu courant. Inspiration : magazines architecture (AD, Wallpaper).*

| Rôle | Couleur | HSL |
|---|---|---|
| Background | `#e8e4dc` | 42 19% 88% (greige) |
| Foreground | `#0a0a0a` | 0 0% 4% |
| Muted | `#d8d3c8` | 42 16% 82% |
| Border | `#bdb6a8` | 42 14% 70% |
| Accent primaire | `#0e7490` | 192 82% 31% (bleu canard profond) |
| Accent secondaire | `#c2410c` | 17 89% 40% (terre cuite) |
| Sidebar | `#1c1c1c` | |

**Typo** : `DM Sans` (titres) + `Geist Mono` (data, chiffres). Tableaux en mono = très lisibles.

**Vibe** : sophistication éditoriale, contraste fort entre le bleu canard et la terre cuite. Très distinctif. Plus risqué.

---

## Direction C — Property tech

> *Direct, moderne, "Linear-like". Pour qui aime les contrastes francs.*

| Rôle | Couleur | HSL |
|---|---|---|
| Background | `#ffffff` | 0 0% 100% |
| Foreground | `#0a0a0a` | 0 0% 4% |
| Muted | `#f4f4f5` | 240 5% 96% |
| Border | `#e4e4e7` | 240 5% 89% |
| Accent primaire | `#ea580c` | 22 91% 49% (orange brûlé) |
| Accent secondaire | `#171717` | (noir) |
| Sidebar | `#0a0a0a` | |

**Typo** : `Inter Tight` (titres + body). Tout en sans-serif.

**Vibe** : minimaliste, tech, contrasts francs. Manque un peu de chaleur pour de l'immo, mais très lisible et moderne.

---

## Comparaison rapide

| Critère | A. Patrimoine | B. Studio archi | C. Property tech |
|---|---|---|---|
| Chaleur | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Lisibilité | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Distinctif | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Risque ("trop loin") | Faible | Moyen | Faible |
| Adapté immobilier | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**Recommandation par défaut** : A (Patrimoine moderne). C'est l'équilibre le plus sûr — chaleur + pro + accent émeraude qui apporte de la vie sans dénoter avec le contexte gestion patrimoniale.

---

## Étape suivante (après validation Nat)

1. Ajuster `dashboard/tailwind.config.ts` (couleur accent dans `theme.extend.colors`)
2. Ajuster `dashboard/src/app/globals.css` (CSS variables `--background`, `--foreground`, `--accent-color`)
3. Si typo change : `dashboard/src/app/layout.tsx` (next/font)
4. Test visuel sur 5 pages : home, sociétés liste, fiche fournisseur, fiche bien, fiche marché
5. Sync mirror `Apps/nat-life/` + déploiement Coolify
