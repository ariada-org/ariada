/* global module, require */
'use strict';

var Status = require('dw/system/Status');

var service = require('*/cartridge/scripts/services/AriadaService');

function execute(args) {
    var payload = service.buildJobPayload(args);
    if (!payload.siteId || !payload.storefront) {
        return new Status(Status.ERROR, 'CONFIGURATION', 'SFCC siteId and storefront pageUrls are required');
    }
    // The job hands off to the configured Ariada API service; it never scans locally.
    service.createApiService().call(payload);
    return new Status(Status.OK);
}

module.exports = { execute: execute };
