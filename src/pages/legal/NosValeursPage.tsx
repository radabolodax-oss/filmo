import React from 'react';
import { Heart, ShieldAlert, Ban, Flag, Sparkles, MessageSquare } from 'lucide-react';
import LegalDocumentPage, { LegalSection } from '../../components/legal/LegalDocumentPage';

const NosValeursPage: React.FC = () => {
  const sections: LegalSection[] = [
    {
      id: 'engagement',
      title: '01. Notre engagement pour la culture libre',
      icon: Heart,
      paragraphs: [
        'Dawger est un espace ouvert à toutes et à tous, guidé par la conviction que l’accès à la culture, au cinéma et aux récits du monde entier doit être libre, fluide et universel.',
        'Nous combattons toutes les formes d’inégalités et de discriminations, et nous garantissons un respect absolu de chaque membre de la communauté, quelles que soient ses origines, ses croyances, son identité ou son parcours.',
        'Le cinéma raconte toutes les vies, humaines et imaginaires. Celles et ceux qui le regardent ici méritent la même dignité et la même bienveillance.'
      ],
      bullets: [
        'Accès libre, local-first et sans barrière financière.',
        'Respect total de la vie privée : aucun traçage commercial invasif.',
        'Diversité des catalogues : films d’auteur, sagas populaires, cinéma du monde et indépendants.'
      ]
    },
    {
      id: 'ce-que-nous-refusons',
      title: '02. Ce que nous refusons fermement',
      icon: Ban,
      paragraphs: [
        'La liberté d’échange au sein de la communauté (commentaires, salles Watch Party, avis) s’arrête là où commence l’atteinte à autrui.',
        'Nous proscrivons sans équivoque :'
      ],
      bullets: [
        'Les insultes, propos haineux, diffamatoires ou dégradants visant une personne ou un groupe.',
        'Le harcèlement, les intimidations, le doxxing ou l’acharnement en ligne.',
        'L’apologie de la violence, du racisme, de l’antisémitisme, de l’islamophobie, de l’homophobie, de la transphobie ou du sexisme.',
        'La diffusion de contenus malveillants, arnaques ou spams dans les espaces d’interaction.'
      ]
    },
    {
      id: 'tolerance-zero',
      title: '03. Tolérance zéro & Modération',
      icon: ShieldAlert,
      paragraphs: [
        'Toute personne adoptant un comportement nuisible, haineux ou malveillant s’expose à la révocation immédiate de son compte et au bannissement irréversible de ses accès.',
        'Nos modérateurs et nos filtres automatiques veillent activement au maintien d’un environnement sain et bienveillant pour tous les passionnés de streaming.'
      ],
      note: 'Ces mesures sont appliquées avec rigueur pour protéger la communauté. En cas de contestation, notre équipe support reste joignable.'
    },
    {
      id: 'signaler',
      title: '04. Signaler un comportement ou un abus',
      icon: Flag,
      paragraphs: [
        'Tu es victime ou témoin d’un comportement déplacé dans un espace Dawger ? Tu peux nous le signaler en quelques clics via nos canaux directs avec une capture d’écran ou le lien de la publication.',
        'Chaque signalement est examiné avec attention et traité dans les plus brefs délais.'
      ]
    }
  ];

  return (
    <LegalDocumentPage
      title="Nos valeurs"
      eyebrow="Charte Communautaire & Éthique"
      lastUpdated="27 octobre 2026"
      seoTitle="Nos valeurs · DAWGER"
      seoDescription="Découvrez les engagements, les principes éthiques et la charte de respect de la communauté Dawger."
      canonicalPath="/valeurs"
      heroIcon={Sparkles}
      intro={[
        'Ce en quoi Dawger croit, et ce que nous ne laisserons jamais passer.',
        'Une plateforme libre, conviviale, conçue par et pour les amoureux du 7ème art, dans le respect de chacun.'
      ]}
      summaryItems={[
        'Accès libre et respectueux pour tout le monde',
        'Zéro tolérance pour la haine et le harcèlement',
        'Protection de la vie privée et transparence',
        'Signalement réactif et modération active'
      ]}
      sections={sections}
      supportCard={{
        title: 'Un doute ou un signalement ?',
        paragraphs: [
          'Notre équipe est à ton écoute sur Telegram, Discord ou par ticket support pour préserver la qualité de la plateforme.'
        ],
        actions: [
          { label: 'Support Telegram', href: 'https://t.me/movix_site', external: true, variant: 'primary' },
          { label: 'Centre d’aide', to: '/help', variant: 'secondary' }
        ]
      }}
    />
  );
};

export default NosValeursPage;
