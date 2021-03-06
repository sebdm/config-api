var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
var async = require('async');
var createSubInstances = require('./util/createSubInstances.js');
var JaySchema = require('jayschema');

var InstanceSchema = new mongoose.Schema({
    modifiedDate: {type: Date, required: true},
    type: {type: String, required: true},
    version: {type: Number, required: true},
    component: {type: mongoose.Schema.Types.ObjectId, ref: 'Component', required: true},
    fullIdentifier: {type: String, required: true},
    revision: {type: Number, required: true},
    blueprint: {type: mongoose.Schema.Types.ObjectId, ref: 'Instance'},
    blueprintFullIdentifier: {type: String},
    blueprintRevision: {type: Number},
    settings: {type: mongoose.Schema.Types.Mixed},
    labels: {type: mongoose.Schema.Types.Mixed},
    components: {type: mongoose.Schema.Types.Mixed},
    _componentReferenceIds: [{type: String}],
    _componentReferences: [{type: mongoose.Schema.Types.ObjectId, ref: 'Instance'}],
    __sources: {type: mongoose.Schema.Types.Mixed}
}, {});

function autoPopulate(next) {
    this.populate({path: '_componentReferences', select: '-component -__v'});
    this.populate({path: 'blueprint', select: '-__v'});
    next();
};

function componentsFromDb(instance) {
    if (instance && instance._componentReferences && instance._componentReferenceIds) {
        instance.components = _.zipObject(instance._componentReferenceIds, instance._componentReferences);
        instance._componentReferenceIds = undefined;
        instance._componentReferences = undefined;
    }

    return instance;
}

InstanceSchema.methods.applyInheritance = function applyInheritance(copy, includeSources) {
    var curr = this;
    while (curr.blueprint) {
        if (curr.blueprint.applyInheritance) {
            curr.blueprint.applyInheritance(false, includeSources);
        }

        curr = curr.blueprint;
    }

    var origConfig = _.merge({}, this.toObject());
    var blueprint = this.blueprint && this.blueprint.toObject ? this.blueprint.toObject() : {};
    if (origConfig.blueprint) {
        origConfig.blueprint = undefined;
    }

    if (blueprint.blueprint) {
        blueprint.blueprint = undefined;
    }

    var result = _.merge(blueprint, origConfig, !includeSources ? function() {
    } : require('./util/expandSourcesCustomizer'), {config: origConfig, parent: blueprint});
    result = copy ? result : _.merge(this, result);
    return result;
};

InstanceSchema
    .pre('find', autoPopulate)
    .pre('findOne', autoPopulate)
    .post('find', function(data) {
        _.each(data, function(instance) {
            componentsFromDb(instance);
        });
    })
    .post('findOne', function(instance) {
        componentsFromDb(instance);
    })
    .pre('save', function(next) {
        this.components = undefined;
        next();
    })
    .pre('validate', function(next) {
        this.modifiedDate = new Date();

        var instance = this;
        async.waterfall([
            function(cb) {
                if (!instance.blueprint) {
                    async.setImmediate(function() {
                        return cb();
                    });

                    return;
                }

                // todo(slind): should we pass in blueprint's _id or fullid+rev?
                mongoose.model('Instance').findOne({_id: instance.blueprint}).exec(function(err, blueprint) {
                    if (err || !blueprint) {
                        var err = new Error(['Couldn\'t find blueprint instance', instance.blueprint].join(', '));
                        err.code = 400;
                        return cb(err);
                    }

                    instance.blueprintFullIdentifier = blueprint.fullIdentifier;
                    instance.blueprintRevision = blueprint.revision;
                    instance.blueprint = blueprint;

                    cb();
                });
            },
            require('./util/detectDuplicateVersions.js')(instance.applyInheritance(true)),
            function(cb) {
                Promise.all(createSubInstances(instance, instance.fullIdentifier)).then(function() {
                    cb();
                }, function(err) {
                    cb(err);
                })
            },
            function(cb) {
                mongoose.model('Instance').findOne({fullIdentifier: instance.fullIdentifier}).sort({ revision: -1 }).exec(function(err, latestRevision) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    instance.revision = !latestRevision ? 1 : latestRevision.revision + 1;
                    cb();
                });
            },
            function(cb) {
                if (!instance.type || !instance.version) {
                    var err = new Error(['Missing type or componentVersion for instance',
                        instance.fullIdentifier].join(', '));
                    err.code = 400;
                    async.setImmediate(function() {
                        cb(err);
                    });
                    return;
                }

                async.setImmediate(function() {
                    cb();
                });
            },
            function(cb) {
                mongoose.model('Component').findOne({
                    type: instance.type,
                    version: instance.version
                }).exec(cb);
            },
            function(refComponent, cb) {
                if (!refComponent) {
                    var err = new Error(['Couldn\'t find referenced component', instance.type,
                        instance.version].join(', '));
                    err.code = 422;
                    cb(err);
                    return;
                }

                new JaySchema(require('./util/schemaLoader.js')).validate(instance.toObject(), refComponent.componentSchema, function(errs) {
                    if (errs) {
                        var err = new Error(['Schema validation failed for instance',
                            instance.fullIdentifier].join(', '));
                        err.instance = instance;
                        err.code = 400;
                        err.validationErrors = errs;
                        cb(err);
                        return;
                    }

                    instance.component = refComponent._id;
                    cb();
                });
            }
        ], function(err, result) {
            if (err) {
                next(err);
            } else {
                next();
            }
        });
    })
    .index({fullIdentifier: 1, revision: -1}, {unique: true});

if (mongoose.models.Instance) {
    delete mongoose.models.Instance;
}

module.exports = mongoose.model('Instance', InstanceSchema);