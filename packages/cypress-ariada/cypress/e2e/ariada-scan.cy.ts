// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

describe('cy.ariadaScan', () => {
  it('fails the Cypress command and surfaces Ariada findings', () => {
    let sawFailure = false;
    cy.on('fail', (error) => {
      sawFailure = true;
      expect(error.message).to.include('button-name');
      expect(error.message).to.include('WCAG 4.1.2');
      expect(error.message).to.include('button');
      return false;
    });

    cy.visit('/bad.html');
    cy.ariadaScan({ severityThreshold: 'moderate' });
    cy.then(() => {
      expect(sawFailure).to.equal(true);
      return undefined;
    });
  });
});
