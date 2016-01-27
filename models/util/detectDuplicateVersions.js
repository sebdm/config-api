var Promise = require('bluebird');
var _ = require('lodash');
var fetchDescendantTypeVersionsMap = require('./fetchDescendantTypeVersionsMap.js');

module.exports = function(parent) {
    return function(cb) {
        var map = {};
        Promise.all(fetchDescendantTypeVersionsMap(parent, map)).then(function() {
            var duplicated = _.chain(map).map(function(v, k) {
                return {type: k, versions: v};
            })
                .filter(function(v) {
                    return v.versions.length > 1;
                }).map(function(v, k) {
                    return v.type + ': ' + v.versions.join(', ');
                }).value();

            if (duplicated && duplicated.length) {
                var err = new Error(['Descendant components had duplicate versions of the same component: '].concat(duplicated.join(', ')).join(''));
                err.code = 400;
                return cb(err);
            }

            cb();
        });
    };
};