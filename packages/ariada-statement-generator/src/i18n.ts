// SPDX-License-Identifier: EUPL-1.2
/**
 * Locale bundles for accessibility-statement generator.
 *
 * Localised headings, conformance phrasings, and feedback wording for
 * Nordic 4 + English. The DOS-lagen Swedish phrasing follows DIGG
 * guidelines; Norwegian / Danish / Finnish follow Difi / Digst / Avi
 * official templates respectively.
 */

import type { Locale } from './types.js';

/**
 *
 */
export interface StatementMessages {
  pageTitle: string;
  heading: string;
  publicationLabel: string;
  lastRevisionLabel: string;
  scopeLabel: string;
  methodologyLabel: string;
  conformanceFull: string;
  conformancePartial: string;
  conformanceNonConformant: string;
  nonConformanceHeading: string;
  feedbackHeading: string;
  feedbackBody: string;
  enforcementHeading: string;
  enforcementBody: string;
  standardsHeading: string;
  standardsBody: string;
}

export const STATEMENT_MESSAGES: Record<Locale, StatementMessages> = {
  en: {
    pageTitle: 'Accessibility statement',
    heading: 'Accessibility statement',
    publicationLabel: 'Published',
    lastRevisionLabel: 'Last revised',
    scopeLabel: 'Scope',
    methodologyLabel: 'Methodology',
    conformanceFull:
      'This website is fully conformant with WCAG 2.2 Level AA and EN 301 549 v3.2.1.',
    conformancePartial:
      'This website is partially compliant with WCAG 2.2 Level AA due to the non-conformances listed below.',
    conformanceNonConformant:
      'This website is not compliant with WCAG 2.2 Level AA. Known non-conformances are listed below.',
    nonConformanceHeading: 'Non-accessible content',
    feedbackHeading: 'Feedback and contact',
    feedbackBody:
      'We welcome feedback on the accessibility of this website. Please contact us if you find content that is not accessible, or if you would like to request information in an alternative format.',
    enforcementHeading: 'Enforcement procedure',
    enforcementBody:
      'If our response is not satisfactory, you may file a complaint with the national enforcement authority.',
    standardsHeading: 'Applicable standards',
    standardsBody:
      'WCAG 2.2 Level AA (W3C Recommendation) and EN 301 549 v3.2.1 Chapter 9 (Web content).',
  },
  sv: {
    pageTitle: 'Tillgänglighetsredogörelse',
    heading: 'Tillgänglighetsredogörelse',
    publicationLabel: 'Publicerad',
    lastRevisionLabel: 'Senast uppdaterad',
    scopeLabel: 'Omfattning',
    methodologyLabel: 'Bedömningsmetod',
    conformanceFull:
      'Den här webbplatsen är helt förenlig med WCAG 2.2 nivå AA och EN 301 549 v3.2.1.',
    conformancePartial:
      'Den här webbplatsen är delvis förenlig med WCAG 2.2 nivå AA på grund av brister som listas nedan.',
    conformanceNonConformant:
      'Den här webbplatsen är inte förenlig med WCAG 2.2 nivå AA. Kända brister listas nedan.',
    nonConformanceHeading: 'Innehåll som inte är tillgängligt',
    feedbackHeading: 'Synpunkter och kontakt',
    feedbackBody:
      'Vi tar gärna emot synpunkter på vår webbplats tillgänglighet. Kontakta oss om du hittar innehåll som inte är tillgängligt eller om du behöver information i ett alternativt format.',
    enforcementHeading: 'Tillsyn',
    enforcementBody:
      'Myndigheten för digital förvaltning (DIGG) har ansvaret för tillsyn över lagen om tillgänglighet till digital offentlig service. Om du inte är nöjd med vår hantering kan du anmäla det till DIGG.',
    standardsHeading: 'Tillämpliga standarder',
    standardsBody:
      'WCAG 2.2 nivå AA (W3C Recommendation) samt EN 301 549 v3.2.1 kapitel 9 (Webbinnehåll).',
  },
  nb: {
    pageTitle: 'Tilgjengelighetserklæring',
    heading: 'Tilgjengelighetserklæring',
    publicationLabel: 'Publisert',
    lastRevisionLabel: 'Sist oppdatert',
    scopeLabel: 'Omfang',
    methodologyLabel: 'Vurderingsmetode',
    conformanceFull:
      'Dette nettstedet er fullt ut i samsvar med WCAG 2.2 nivå AA og EN 301 549 v3.2.1.',
    conformancePartial:
      'Dette nettstedet er delvis i samsvar med WCAG 2.2 nivå AA på grunn av manglene som er listet opp nedenfor.',
    conformanceNonConformant:
      'Dette nettstedet er ikke i samsvar med WCAG 2.2 nivå AA. Kjente mangler er listet opp nedenfor.',
    nonConformanceHeading: 'Innhold som ikke er tilgjengelig',
    feedbackHeading: 'Tilbakemelding og kontakt',
    feedbackBody:
      'Vi tar gjerne imot tilbakemeldinger om tilgjengeligheten på nettstedet vårt. Kontakt oss hvis du finner innhold som ikke er tilgjengelig, eller hvis du trenger informasjon i et alternativt format.',
    enforcementHeading: 'Tilsyn',
    enforcementBody:
      'Tilsynet for universell utforming av IKT (uutilsynet, Digdir) fører tilsyn med kravene i likestillings- og diskrimineringsloven §17. Klager rettes til Digdir.',
    standardsHeading: 'Gjeldende standarder',
    standardsBody:
      'WCAG 2.2 nivå AA (W3C Recommendation) og EN 301 549 v3.2.1 kapittel 9 (Nettinnhold).',
  },
  da: {
    pageTitle: 'Tilgængelighedserklæring',
    heading: 'Tilgængelighedserklæring',
    publicationLabel: 'Udgivet',
    lastRevisionLabel: 'Senest opdateret',
    scopeLabel: 'Omfang',
    methodologyLabel: 'Vurderingsmetode',
    conformanceFull:
      'Dette website er fuldt ud i overensstemmelse med WCAG 2.2 niveau AA og EN 301 549 v3.2.1.',
    conformancePartial:
      'Dette website er delvis i overensstemmelse med WCAG 2.2 niveau AA på grund af de mangler, der er anført nedenfor.',
    conformanceNonConformant:
      'Dette website er ikke i overensstemmelse med WCAG 2.2 niveau AA. Kendte mangler er anført nedenfor.',
    nonConformanceHeading: 'Indhold der ikke er tilgængeligt',
    feedbackHeading: 'Feedback og kontakt',
    feedbackBody:
      'Vi modtager gerne tilbagemeldinger om tilgængeligheden på vores website. Kontakt os, hvis du finder indhold, der ikke er tilgængeligt, eller hvis du vil bede om information i et alternativt format.',
    enforcementHeading: 'Tilsyn',
    enforcementBody:
      'Digitaliseringsstyrelsen (Digst) fører tilsyn med tilgængelighedskravene. Klager kan indgives via Digst.',
    standardsHeading: 'Gældende standarder',
    standardsBody:
      'WCAG 2.2 niveau AA (W3C Recommendation) og EN 301 549 v3.2.1 kapitel 9 (Webindhold).',
  },
  fi: {
    pageTitle: 'Saavutettavuusseloste',
    heading: 'Saavutettavuusseloste',
    publicationLabel: 'Julkaistu',
    lastRevisionLabel: 'Viimeksi päivitetty',
    scopeLabel: 'Soveltamisala',
    methodologyLabel: 'Arviointimenetelmä',
    conformanceFull:
      'Tämä verkkosivusto täyttää täysin WCAG 2.2 -tason AA ja EN 301 549 v3.2.1 vaatimukset.',
    conformancePartial:
      'Tämä verkkosivusto on osittain WCAG 2.2 -tason AA mukainen alla lueteltujen puutteiden vuoksi.',
    conformanceNonConformant:
      'Tämä verkkosivusto ei täytä WCAG 2.2 -tason AA vaatimuksia. Tunnetut puutteet on lueteltu alla.',
    nonConformanceHeading: 'Saavuttamaton sisältö',
    feedbackHeading: 'Palaute ja yhteydenotto',
    feedbackBody:
      'Otamme mielellämme vastaan palautetta verkkosivuston saavutettavuudesta. Ota meihin yhteyttä, jos löydät sisältöä, joka ei ole saavutettavissa, tai jos haluat tietoja vaihtoehtoisessa muodossa.',
    enforcementHeading: 'Valvonta',
    enforcementBody:
      'Etelä-Suomen aluehallintovirasto (Avi) valvoo saavutettavuusvaatimuksia. Voit tehdä valituksen Aville, jos et ole tyytyväinen vastaukseemme.',
    standardsHeading: 'Sovellettavat standardit',
    standardsBody:
      'WCAG 2.2 -taso AA (W3C-suositus) ja EN 301 549 v3.2.1 luku 9 (Verkkosisältö).',
  },
  de: {
    pageTitle: 'Erklärung zur Barrierefreiheit',
    heading: 'Erklärung zur Barrierefreiheit',
    publicationLabel: 'Veröffentlicht',
    lastRevisionLabel: 'Zuletzt überprüft',
    scopeLabel: 'Geltungsbereich',
    methodologyLabel: 'Bewertungsverfahren',
    conformanceFull:
      'Diese Website ist vollständig mit WCAG 2.2 Stufe AA und EN 301 549 v3.2.1 vereinbar.',
    conformancePartial:
      'Diese Website ist wegen der unten aufgeführten Mängel teilweise mit WCAG 2.2 Stufe AA vereinbar.',
    conformanceNonConformant:
      'Diese Website ist nicht mit WCAG 2.2 Stufe AA vereinbar. Die bekannten Mängel sind unten aufgeführt.',
    nonConformanceHeading: 'Nicht barrierefreie Inhalte',
    feedbackHeading: 'Feedback und Kontakt',
    feedbackBody:
      'Wir freuen uns über Rückmeldungen zur Barrierefreiheit dieser Website. Bitte kontaktieren Sie uns, wenn Sie Inhalte finden, die nicht barrierefrei sind, oder wenn Sie Informationen in einem alternativen Format benötigen.',
    enforcementHeading: 'Durchsetzungsverfahren',
    enforcementBody:
      'Wenn unsere Antwort Sie nicht zufriedenstellt, können Sie sich an die Überwachungsstelle des Bundes für Barrierefreiheit der Informationstechnik (BFIT-Bund) wenden.',
    standardsHeading: 'Angewandte Standards',
    standardsBody:
      'WCAG 2.2 Stufe AA (W3C-Empfehlung) und EN 301 549 v3.2.1 Kapitel 9 (Webinhalte).',
  },
  fr: {
    pageTitle: 'Déclaration d’accessibilité',
    heading: 'Déclaration d’accessibilité',
    publicationLabel: 'Publiée le',
    lastRevisionLabel: 'Dernière révision',
    scopeLabel: 'Périmètre',
    methodologyLabel: 'Méthode d’évaluation',
    conformanceFull:
      'Ce site est totalement conforme au WCAG 2.2 niveau AA et à la norme EN 301 549 v3.2.1.',
    conformancePartial:
      'Ce site est partiellement conforme au WCAG 2.2 niveau AA en raison des non-conformités listées ci-dessous.',
    conformanceNonConformant:
      'Ce site n’est pas conforme au WCAG 2.2 niveau AA. Les non-conformités connues sont listées ci-dessous.',
    nonConformanceHeading: 'Contenus non accessibles',
    feedbackHeading: 'Retour d’information et contact',
    feedbackBody:
      'Nous accueillons volontiers vos retours sur l’accessibilité de ce site. Contactez-nous si vous rencontrez un contenu inaccessible ou si vous souhaitez obtenir une information dans un format alternatif.',
    enforcementHeading: 'Voie de recours',
    enforcementBody:
      'Si notre réponse ne vous satisfait pas, vous pouvez saisir l’autorité nationale compétente en matière d’accessibilité numérique.',
    standardsHeading: 'Normes applicables',
    standardsBody:
      'WCAG 2.2 niveau AA (recommandation du W3C) et EN 301 549 v3.2.1 chapitre 9 (contenus web).',
  },
  nl: {
    pageTitle: 'Toegankelijkheidsverklaring',
    heading: 'Toegankelijkheidsverklaring',
    publicationLabel: 'Gepubliceerd',
    lastRevisionLabel: 'Laatst herzien',
    scopeLabel: 'Reikwijdte',
    methodologyLabel: 'Evaluatiemethode',
    conformanceFull:
      'Deze website voldoet volledig aan WCAG 2.2 niveau AA en EN 301 549 v3.2.1.',
    conformancePartial:
      'Deze website voldoet gedeeltelijk aan WCAG 2.2 niveau AA vanwege de hieronder genoemde tekortkomingen.',
    conformanceNonConformant:
      'Deze website voldoet niet aan WCAG 2.2 niveau AA. De bekende tekortkomingen staan hieronder.',
    nonConformanceHeading: 'Niet-toegankelijke inhoud',
    feedbackHeading: 'Feedback en contact',
    feedbackBody:
      'Wij ontvangen graag feedback over de toegankelijkheid van deze website. Neem contact met ons op als u inhoud aantreft die niet toegankelijk is, of als u informatie in een alternatieve vorm wilt ontvangen.',
    enforcementHeading: 'Handhavingsprocedure',
    enforcementBody:
      'Bent u niet tevreden met onze reactie, dan kunt u een klacht indienen bij de nationale toezichthouder.',
    standardsHeading: 'Toepasselijke standaarden',
    standardsBody:
      'WCAG 2.2 niveau AA (W3C-aanbeveling) en EN 301 549 v3.2.1 hoofdstuk 9 (webcontent).',
  },
  es: {
    pageTitle: 'Declaración de accesibilidad',
    heading: 'Declaración de accesibilidad',
    publicationLabel: 'Publicada',
    lastRevisionLabel: 'Última revisión',
    scopeLabel: 'Ámbito de aplicación',
    methodologyLabel: 'Método de evaluación',
    conformanceFull:
      'Este sitio web es plenamente conforme con WCAG 2.2 nivel AA y con la norma EN 301 549 v3.2.1.',
    conformancePartial:
      'Este sitio web es parcialmente conforme con WCAG 2.2 nivel AA debido a las no conformidades que se indican a continuación.',
    conformanceNonConformant:
      'Este sitio web no es conforme con WCAG 2.2 nivel AA. Las no conformidades conocidas se indican a continuación.',
    nonConformanceHeading: 'Contenido no accesible',
    feedbackHeading: 'Comentarios y contacto',
    feedbackBody:
      'Agradecemos sus comentarios sobre la accesibilidad de este sitio web. Póngase en contacto con nosotros si encuentra contenido que no sea accesible o si necesita información en un formato alternativo.',
    enforcementHeading: 'Procedimiento de reclamación',
    enforcementBody:
      'Si nuestra respuesta no le resulta satisfactoria, puede presentar una reclamación ante la autoridad nacional competente.',
    standardsHeading: 'Normas aplicables',
    standardsBody:
      'WCAG 2.2 nivel AA (recomendación del W3C) y EN 301 549 v3.2.1 capítulo 9 (contenido web).',
  },
  it: {
    pageTitle: 'Dichiarazione di accessibilità',
    heading: 'Dichiarazione di accessibilità',
    publicationLabel: 'Pubblicata il',
    lastRevisionLabel: 'Ultima revisione',
    scopeLabel: 'Ambito di applicazione',
    methodologyLabel: 'Metodo di valutazione',
    conformanceFull:
      'Questo sito web è pienamente conforme alle WCAG 2.2 livello AA e alla norma EN 301 549 v3.2.1.',
    conformancePartial:
      'Questo sito web è parzialmente conforme alle WCAG 2.2 livello AA a causa delle non conformità elencate di seguito.',
    conformanceNonConformant:
      'Questo sito web non è conforme alle WCAG 2.2 livello AA. Le non conformità note sono elencate di seguito.',
    nonConformanceHeading: 'Contenuti non accessibili',
    feedbackHeading: 'Riscontri e contatti',
    feedbackBody:
      'Accogliamo volentieri i riscontri sull’accessibilità di questo sito. Contattaci se trovi contenuti non accessibili o se desideri ricevere informazioni in un formato alternativo.',
    enforcementHeading: 'Procedura di reclamo',
    enforcementBody:
      'Se la nostra risposta non è soddisfacente, è possibile presentare reclamo all’autorità nazionale competente.',
    standardsHeading: 'Norme applicabili',
    standardsBody:
      'WCAG 2.2 livello AA (raccomandazione W3C) e EN 301 549 v3.2.1 capitolo 9 (contenuti web).',
  },
  pl: {
    pageTitle: 'Deklaracja dostępności',
    heading: 'Deklaracja dostępności',
    publicationLabel: 'Data publikacji',
    lastRevisionLabel: 'Data ostatniego przeglądu',
    scopeLabel: 'Zakres',
    methodologyLabel: 'Metoda oceny',
    conformanceFull:
      'Ta strona internetowa jest w pełni zgodna z WCAG 2.2 na poziomie AA oraz z normą EN 301 549 v3.2.1.',
    conformancePartial:
      'Ta strona internetowa jest częściowo zgodna z WCAG 2.2 na poziomie AA z powodu niezgodności wymienionych poniżej.',
    conformanceNonConformant:
      'Ta strona internetowa nie jest zgodna z WCAG 2.2 na poziomie AA. Znane niezgodności wymieniono poniżej.',
    nonConformanceHeading: 'Treści niedostępne',
    feedbackHeading: 'Informacje zwrotne i kontakt',
    feedbackBody:
      'Chętnie przyjmiemy uwagi dotyczące dostępności tej strony. Prosimy o kontakt, jeśli napotkasz treści niedostępne lub potrzebujesz informacji w alternatywnej formie.',
    enforcementHeading: 'Postępowanie odwoławcze',
    enforcementBody:
      'Jeżeli nasza odpowiedź nie będzie satysfakcjonująca, można złożyć skargę do właściwego organu krajowego.',
    standardsHeading: 'Obowiązujące standardy',
    standardsBody:
      'WCAG 2.2 poziom AA (zalecenie W3C) oraz EN 301 549 v3.2.1 rozdział 9 (treści internetowe).',
  },
  pt: {
    pageTitle: 'Declaração de acessibilidade',
    heading: 'Declaração de acessibilidade',
    publicationLabel: 'Publicada em',
    lastRevisionLabel: 'Última revisão',
    scopeLabel: 'Âmbito',
    methodologyLabel: 'Método de avaliação',
    conformanceFull:
      'Este sítio web é totalmente conforme com as WCAG 2.2 nível AA e com a norma EN 301 549 v3.2.1.',
    conformancePartial:
      'Este sítio web é parcialmente conforme com as WCAG 2.2 nível AA devido às não conformidades indicadas abaixo.',
    conformanceNonConformant:
      'Este sítio web não é conforme com as WCAG 2.2 nível AA. As não conformidades conhecidas são indicadas abaixo.',
    nonConformanceHeading: 'Conteúdo não acessível',
    feedbackHeading: 'Comentários e contacto',
    feedbackBody:
      'Agradecemos os seus comentários sobre a acessibilidade deste sítio. Contacte-nos se encontrar conteúdo não acessível ou se pretender informação num formato alternativo.',
    enforcementHeading: 'Procedimento de reclamação',
    enforcementBody:
      'Se a nossa resposta não for satisfatória, pode apresentar reclamação junto da autoridade nacional competente.',
    standardsHeading: 'Normas aplicáveis',
    standardsBody:
      'WCAG 2.2 nível AA (recomendação do W3C) e EN 301 549 v3.2.1 capítulo 9 (conteúdo web).',
  },
};