/* global module, require */
'use strict';

var server = require('server');

var service = require('*/cartridge/scripts/services/AriadaService');

server.get('Dashboard', function (req, res, next) {
    var result = service.getLatestResult(req.currentCustomer.raw.profile);
    res.render('ariada/dashboard', { result: result });
    return next();
});

module.exports = server.exports();
