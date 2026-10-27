import React from 'react';
import { Database, Cookie, Lock, HardDrive, ShieldCheck, CheckCircle2 } from 'lucide-react';
import LegalDocumentPage, { LegalSection } from '../../components/legal/LegalDocumentPage';

const DonneesCookiesPage: React.FC = () => {
  const sections: LegalSection[] = [
    {
      id: 'resume',
      title: '01. En résumé',
      icon: ShieldCheck,
      paragraphs: [
        'Dawger est conçu avec une approche locale et respectueuse de la vie privée (Local-First). Nous n’installons aucun tracker publicitaire, aucun cookie tiers de retargeting, et nous ne vendons aucune de vos informations.',
        'Les seules données utilisées servent exclusivement à mémoriser votre progression de lecture, vos favoris et à vous maintenir connecté si vous le souhaitez.'
      ],
      bullets: [
        'Zéro cookie publicitaire ou régie de tracking déposé par Dawger.',
        'Stockage local prioritaire sur votre appareil pour votre confort de lecture.',
        'Synchronisation chiffrée optionnelle pour retrouver vos listes entre appareils.'
      ]
    },
    {
      id: 'cookies',
      title: '02. Les cookies techniques',
      icon: Cookie,
      paragraphs: [
        'Nous n’utilisons que des cookies strictement nécessaires au fonctionnement technique du service, exemptés de consentement selon la réglementation CNIL/RGPD :'
      ],
      bullets: [
        'dawger_auth / token : Maintient votre session ouverte de manière sécurisée (chiffré, HttpOnly). Durée : 30 jours renouvelés.',
        'dawger_pref : Mémorise vos choix d’interface (mode sombre, langue des sous-titres, lecteur par défaut).',
        'oauth_state : Jeton temporaire (10 minutes) utilisé uniquement lors de la connexion Google ou Discord.'
      ],
      note: 'Ces cookies sont indispensables au service que vous demandez : c’est pour cette raison que Dawger n’a pas besoin de vous importuner avec un bandeau de cookies intempestif.'
    },
    {
      id: 'local-storage',
      title: '03. Le stockage local de votre navigateur',
      icon: HardDrive,
      paragraphs: [
        'La grande majorité de vos données de visionnage reste confinée dans votre navigateur via le LocalStorage et IndexedDB :',
        '– Votre historique de lecture et minutage de reprise de film.\n– Votre liste de films et séries à voir.\n– Vos préférences de volume, ratio d’écran et serveur vidéo favori.',
        'Ces données ne quittent pas votre machine, à moins que vous n’activiez expressément la synchronisation de profil multi-appareils.'
      ]
    },
    {
      id: 'serveurs',
      title: '04. Ce que nous stockons sur nos serveurs',
      icon: Database,
      paragraphs: [
        'Si vous créez un compte ou synchronisez votre bibliothèque, nous stockons de manière minimale et anonymisée :',
        '– Votre identifiant unique (ou hash OAuth).\n– Vos codes de listes partagées et vos souhaits de films sur le Wishboard.\n– Les messages postés dans les salons publics et commentaires.'
      ]
    },
    {
      id: 'ce-que-nous-ne-faisons-pas',
      title: '05. Ce que nous ne faisons jamais',
      icon: Lock,
      paragraphs: [
        'Nous ne collectons aucune coordonnée bancaire, aucune géolocalisation précise, et nous ne vendons absolument aucune donnée à des courtiers d’informations ou à des publicitaires tiers.'
      ]
    },
    {
      id: 'tes-droits',
      title: '06. Vos choix & Suppression totale en 1 clic',
      icon: CheckCircle2,
      paragraphs: [
        'Vous restez le maître absolu de vos données. Dans la page Paramètres de Dawger, vous pouvez à tout moment exporter l’intégralité de votre historique en fichier JSON ou vider l’ensemble des caches et données locales en un clic.'
      ]
    }
  ];

  return (
    <LegalDocumentPage
      title="Données & cookies"
      eyebrow="Transparence & Vie Privée"
      lastUpdated="27 octobre 2026"
      seoTitle="Données & Cookies · DAWGER"
      seoDescription="Transparence totale sur les données, cookies et stockages locaux utilisés par le lecteur Dawger."
      canonicalPath="/donnees"
      heroIcon={Cookie}
      intro={[
        'Un cookie technique, du stockage local et zéro régie publicitaire intrusive.',
        'Découvrez en toute clarté ce que Dawger stocke, où, et pour quelles raisons.'
      ]}
      summaryItems={[
        'Zéro régie publicitaire ni traceur commercial',
        'Stockage local prioritaire pour l’historique',
        'Aucun bandeau cookie intrusif requis',
        'Effacement total possible en 1 clic dans les réglages'
      ]}
      sections={sections}
      supportCard={{
        title: 'Gérer vos données dès maintenant',
        paragraphs: [
          'Vous pouvez consulter et effacer vos données locales à tout moment dans la section Paramètres de votre profil.'
        ],
        actions: [
          { label: 'Ouvrir les Paramètres', to: '/settings', variant: 'primary' },
          { label: 'Centre d’aide', to: '/help', variant: 'secondary' }
        ]
      }}
    />
  );
};

export default DonneesCookiesPage;
