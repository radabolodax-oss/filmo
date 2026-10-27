import React from 'react';
import { ShieldCheck, Monitor, Smartphone, Tv, ExternalLink, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import LegalDocumentPage, { LegalSection } from '../../components/legal/LegalDocumentPage';

const BloquerPubsPage: React.FC = () => {
  const sections: LegalSection[] = [
    {
      id: 'pourquoi-cette-page',
      title: '01. Pourquoi cette page ?',
      icon: AlertTriangle,
      paragraphs: [
        'Dawger est 100% sans publicité native : nous ne plaçons aucune bannière, aucun pop-up et aucune vidéo sponsorisée sur notre site ou nos applications.',
        'Cependant, certains lecteurs tiers et hébergeurs vidéo externes injectent leurs propres publicités ou redirections pop-under lorsque vous cliquez sur lecture.',
        'Heureusement, vous pouvez neutraliser complètement ces désagréments en installant un bloqueur réputé sur votre appareil. Voici la marche à suivre pour chaque écran.'
      ]
    },
    {
      id: 'ordinateur',
      title: '02. Sur Ordinateur (Windows, Mac, Linux)',
      icon: Monitor,
      paragraphs: [
        'Sur PC et Mac, la solution la plus efficace et gratuite est l’extension open-source uBlock Origin ou l’utilisation d’un navigateur sécurisé.'
      ],
      bullets: [
        'uBlock Origin : L’extension de référence mondiale, légère et gratuite (compatible Chrome, Firefox, Edge, Brave, Opera).',
        'Navigateur Brave : Intègre un bloqueur de publicité natif ultra-performant sans configuration nécessaire.',
        'L’application PC Dawger : Notre application autonome téléchargeable intègre ses propres mécanismes de filtrage.'
      ]
    },
    {
      id: 'android',
      title: '03. Sur Android (Smartphones & Tablettes)',
      icon: Smartphone,
      paragraphs: [
        'Sur mobile Android, plusieurs méthodes garantissent un visionnage sans la moindre interruption :'
      ],
      bullets: [
        'Application Dawger Android : Téléchargeable depuis la page Applications, elle optimise la lecture avec son moteur Python embarqué.',
        'DNS Privé AdGuard : Allez dans Paramètres Android > Connexions > Plus de paramètres > DNS Privé, et entrez : dns.adguard-dns.com (bloque les pubs dans tout le téléphone !)',
        'Navigateur Brave ou Firefox Android : Firefox permet d’installer uBlock Origin directement sur mobile.'
      ]
    },
    {
      id: 'ios',
      title: '04. Sur iPhone et iPad (iOS)',
      icon: Smartphone,
      paragraphs: [
        'Sur iOS, Safari permet d’activer des bloqueurs de contenu très performants :'
      ],
      bullets: [
        'AdGuard pour Safari : Disponible gratuitement sur l’App Store pour filtrer les pop-ups dans Safari.',
        'Profil DNS AdGuard : Installez le profil de configuration DNS d’AdGuard pour bloquer les régies au niveau du réseau.',
        'Navigateur Brave iOS : Téléchargeable sur l’App Store avec bouclier anti-pubs activé par défaut.'
      ]
    },
    {
      id: 'tv-box',
      title: '05. Sur Smart TV, Android TV, Fire TV & Box',
      icon: Tv,
      paragraphs: [
        'Sur téléviseur connecté, il est difficile d’installer des extensions, mais le filtrage par DNS fonctionne à merveille :'
      ],
      bullets: [
        'Configuration DNS de la box : Dans les réglages Wi-Fi / Ethernet de votre TV, configurez les serveurs DNS suivants : 94.140.14.14 et 94.140.15.15 (AdGuard DNS public).',
        'Navigateur TV recommandé : TV Bro ou JioPages, qui intègrent un bloqueur de pop-ups natif.'
      ]
    },
    {
      id: 'sans-bloqueur',
      title: '06. Les réflexes essentiels si vous n’avez pas de bloqueur',
      icon: CheckCircle,
      paragraphs: [
        'Si un nouvel onglet publicitaire s’ouvre lorsque vous cliquez sur Play :',
        '1. Fermez immédiatement cet onglet tiers sans cliquer à l’intérieur.\n2. Revenez sur l’onglet Dawger et recliquez sur le lecteur.\n3. N’autorisez JAMAIS les notifications lorsqu’un site inconnu vous le demande.'
      ]
    }
  ];

  return (
    <LegalDocumentPage
      title="Bloquer les pubs"
      eyebrow="Tutoriels & Confort de Visionnage"
      lastUpdated="27 octobre 2026"
      seoTitle="Bloquer les Publicités · DAWGER"
      seoDescription="Guide complet pour bloquer les fenêtres et publicités intempestives sur PC, Android, iPhone et Smart TV."
      canonicalPath="/bloquer-les-pubs"
      heroIcon={ShieldCheck}
      intro={[
        'Dawger est garanti sans publicité native.',
        'Voici les meilleurs outils recommandés pour masquer les fenêtres intempestives des hébergeurs tiers sur tous vos appareils.'
      ]}
      summaryItems={[
        'uBlock Origin pour les navigateurs PC/Mac',
        'DNS Privé gratuit pour Android & iOS',
        'Configuration rapide pour Smart TV et Box',
        'Conseils de sécurité pour un streaming serein'
      ]}
      sections={sections}
      supportCard={{
        title: 'Découvrir nos applications dédiées',
        paragraphs: [
          'Nos versions PC et Android intègrent des optimisations de lecture exclusives pour vous éviter les tracas.'
        ],
        actions: [
          { label: 'Télécharger les Apps Dawger', to: '/app', variant: 'primary' },
          { label: 'Tuto DNS anti-blocage', to: '/help/dns', variant: 'secondary' }
        ]
      }}
    />
  );
};

export default BloquerPubsPage;
