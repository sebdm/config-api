var mongoose = require('mongoose');
var Promise = require('bluebird');
var async = require('async');
var _ = require('lodash');

module.exports = function createSubInstances(parent, parentFullIdentifier) {
    var promises = [];
    if (!parent.components) {
        return promises;
    }

    var components = parent.components;
    _.each(components, function(instance, key) {
        promises.push(new Promise(function(resolve, reject) {
            async.waterfall([
                function(cb) {
                    instance.fullIdentifier = [parentFullIdentifier, key].join('.');

                    mongoose.model('Instance').create(instance, function(err, res) {
                        if (err) {
                            return cb(err);
                        }

                        components[key] = res;
                        cb();
                    });
                }
            ], function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }));
    });

    Promise.all(promises).then(function() {
        parent._componentReferences = _.toArray(parent.components);
        parent._componentReferenceIds = _.keys(parent.components);
    }, function() {});

    return promises;
};