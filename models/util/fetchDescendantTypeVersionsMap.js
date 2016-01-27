var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function fetchDescendantTypeVersionsMap(parent, map) {
    var promises = [];
    if (!parent || !parent.components) {
        return promises;
    }

    map = map || {};

    _.each(parent.components, function(component, key) {
        promises.push(new Promise(function(resolve, reject) {
            mongoose.model('Component').findOne({
                type: component.type,
                version: component.version
            }, function(err, refComponent) {
                var merged = _.merge({}, refComponent ? refComponent.toObject() : {}, component);
                map[component.type] = _.uniq((map[component.type] || []).concat([component.version]));
                Promise.all(fetchDescendantTypeVersionsMap(merged, map)).then(function() {
                    resolve();
                }, function(err) {
                    reject(err);
                });
            });
        }));
    });

    return promises;
};