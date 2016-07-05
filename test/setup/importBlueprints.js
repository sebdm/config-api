var mongoose = require('mongoose');
var Component = mongoose.model('Component');
var Config = mongoose.model('Config');
var Instance = mongoose.model('Instance');
var Promise = require('bluebird');
var async = require('async');
var _ = require('lodash');

module.exports = function(done) {
    async.series([
        function(cb) {
            Instance.create(
                // deep merge here is important for mocha watch
                _.merge({}, require('../fixtures/blueprints/some-component-blueprint.json')),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
        }
    ], function(err, results) {
        done(err, results);
    });
};
