/* global module, require */
'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

function getLatestResult(profile) {
    var payload = {
        siteId: profile && profile.custom ? profile.custom.ariadaSiteId : null,
        status: 'pending',
        message: 'Run the Ariada SFCC job to populate findings.'
    };
    return payload;
}

function createApiService() {
    return LocalServiceRegistry.createService('ariada.sfcc.scan', {
        createRequest: function (svc, request) {
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');
            return JSON.stringify(request);
        },
        parseResponse: function (svc, response) {
            return JSON.parse(response.text);
        }
    });
}

function buildJobPayload(siteConfig) {
    return {
        platform: 'salesforce-commerce-cloud',
        siteId: siteConfig.siteId,
        storefront: siteConfig.pageUrls,
        outputFormat: 'json',
        domains: ['accessibility']
    };
}

module.exports = { buildJobPayload: buildJobPayload, createApiService: createApiService, getLatestResult: getLatestResult };
