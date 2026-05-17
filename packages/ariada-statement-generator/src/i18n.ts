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
};