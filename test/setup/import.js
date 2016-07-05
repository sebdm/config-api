var mongoose = require('mongoose');
var Component = mongoose.model('Component');
var Config = mongoose.model('Config');
var Instance = mongoose.model('Instance');
var async = require('async');
var _ = require('lodash');

module.exports = function() {
    var subComponent, someComponent, topConfig, subConfig;

    async.waterfall([
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/sub-component.json')),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    subComponent = c;
                    cb();
                });

        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/some-component.json')),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    someComponent = c;
                    cb();
                });
        },
        function(cb) {
            Component.create(
                _.merge({}, require('../fixtures/components/top-component.json')),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    cb();
                });
        },
        function(cb) {
            Config.create(
                _.merge({}, require('../fixtures/configs/top-config.json'), {
                    flags: ['qa']
                }),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    topConfig = c;

                    cb();
                });
        },
        function(cb) {
            Config.create(
                _.merge({}, require('../fixtures/configs/sub-config.json'), {
                    parent: topConfig._id
                }),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    subConfig = c;

                    cb();
                });
        },
        function(cb) {
            Config.create(
                _.merge({}, require('../fixtures/configs/sub-sub-config.json'), {
                    parent: subConfig._id
                }),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    cb();
                });
        },
        function(cb) {
            Instance.create(
                // deep merge here is important for mocha watch
                _.merge({}, require('../fixtures/blueprints/some-component-blueprint.json')),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, c);
                });
        },
        function(blueprint, cb) {
            Instance.create(
                // deep merge here is important for mocha watch
                _.merge({}, {
                    type: 'someComponent',
                    version: 1,
                    blueprint: blueprint,
                    fullIdentifier: 'inherits.someComponent.blueprint'
                }),
                function(err, c) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, blueprint);
                });
        },
        function(blueprint, cb) {
            Config.create(
                _.merge({}, require('../fixtures/configs/top-config.json'), {
                    settings: {
                        languageId: 'en-GB'
                    },
                    components: {
                        topComponentInstance: {
                            settings: {
                                someSetting: 'override!'
                            }
                        },
                        someComponentThatInheritsFromBlueprint: {
                            fullIdentifier: 'someComponentThatInheritsFromBlueprint',
                            type: 'someComponent',
                            version: 1,
                            blueprint: blueprint,
                            components: {
                                subComponentInstance2: {
                                    type: 'subComponent',
                                    version: 1,
                                    settings: {
                                        instanceSetting: 2
                                    }
                                }
                            }
                        }
                    }
                }),
                function(err, c) {
                    if (err) {
                        cb(err);
                        return console.log(err);
                    }

                    cb();
                });
        }
        //function(cb) {
        //    Instance.create({
        //        type: 'subComponent',
        //        component: subComponent._id,
        //        fullIdentifier: 'subComponentInstance1',
        //        revision: 1
        //    }, function(err, instance1) {
        //        if (err) {
        //            cb(err);
        //        }
        //
        //        console.log(instance1)
        //
        //        Instance.create({
        //            type: 'subComponent',
        //            component: subComponent._id,
        //            fullIdentifier: 'subComponentInstance2',
        //            revision: 1,
        //            components: {
        //                subComponentInstance: instance1._id
        //            }
        //        }, function(err, instance2) {
        //            if (err) {
        //                cb(err);
        //            }
        //
        //            Instance.create({
        //                type: 'ecInput',
        //                component: someComponent._id,
        //                fullIdentifier: 'ecInputInstance',
        //                revision: 1,
        //                components: {
        //                    subComponentInstance: instance2._id
        //                }
        //            }, function(err) {
        //                if (err) {
        //                    cb(err);
        //                }
        //
        //                Instance.create({
        //                    type: 'ecInput',
        //                    component: someComponent._id,
        //                    fullIdentifier: 'ecInputInstance',
        //                    revision: 2,
        //                    settings: {
        //                        slighty: 'updated'
        //                    },
        //                    components: {
        //                        subComponentInstance: instance2._id
        //                    }
        //                }, function(err) {
        //                    if (err) {
        //                        cb(err);
        //                    }
        //
        //                    cb();
        //                    done();
        //                });
        //            });
        //        });
        //    });
        //}
    ], function(err, result) {
        if (err) {
            console.log(err);
        }
    });

    console.log('Created dummy component types');
};
