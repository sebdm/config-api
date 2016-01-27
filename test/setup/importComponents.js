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
            Component.create(
                // deep merge here is important for mocha watch
                _.merge({}, require('../fixtures/components/sub-component.json')),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/sub-component.json'), {
                    version: 1.1,
                    componentSchema: {properties: {version: {enum: [1.1]}}}
                }),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                }
            );
        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/some-component.json')),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/top-component.json')),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/top-component.json'), { version: 1.1, componentSchema: {properties: {version: {enum: [1.1]}}} }),
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
