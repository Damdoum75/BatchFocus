# BatchFocus

Un outil de conversion d'images par lot pour convertir vos images au format WebP.

## Pourquoi BatchFocus ?

| Problème | Solution BatchFocus |
| :--- | :--- |
| Sites en ligne (ILoveIMG, CloudConvert) : photos sensibles sur serveur tiers | **Confidentialité Totale** : Vos photos de famille ou documents sensibles ne quittent jamais votre disque dur |
| Services cloud : temps d'attente pour l'upload/download | **Performance Native** : Pas de temps d'attente. Le traitement est limité uniquement par la puissance de votre processeur |
| Abonnements, limites de taille, filigranes | **Zéro Coût** : Pas d'abonnement, pas de limites, pas de filigranes (watermarks) |

## Formats Supportés

| Format Source | Format Sortie | Options Spécifiques |
| :--- | :--- | :--- |
| JPEG, PNG, BMP, TIFF | WebP | Compression ajustable |
| JPEG, WebP, BMP | PNG | Conservation de la transparence |
| PNG, WebP, TIFF | JPEG | Contrôle de la qualité (0-100) |

## Sous le capot

BatchFocus utilise Sharp pour manipuler les données binaires des images. Les transformations sont appliquées via un pipeline asynchrone pour garantir que l'interface reste fluide, même lors du traitement de centaines de fichiers.

## 🚧 Roadmap / À venir

- [ ] Ajout de filigranes (Watermarking) personnalisés
- [ ] Conversion vers le format PDF
- [ ] Filtres de base (Luminosité, Contraste, Noir & Blanc)
- [ ] Version CLI (Ligne de commande) pour les serveurs

## 🤝 Contribuer

Les contributions sont les bienvenues !

1. Forkez le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Commitez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pushez sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
