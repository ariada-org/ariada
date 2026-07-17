// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const { registerHexoAriada } = require('./lib/hexo-ariada');

if (typeof hexo !== 'undefined') {
  registerHexoAriada(hexo);
}

module.exports = registerHexoAriada;
module.exports.registerHexoAriada = registerHexoAriada;
