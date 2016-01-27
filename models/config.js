var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
var async = require('async');
var createSubInstances = require('./util/createSubInstances.js');

var ConfigSchema = new mongoose.Schema({
    modifiedDate: {type: Date, required: true},
    fullIdentifier: {type: String, required: true},
    name: {type: String, required: true},
    revision: {type: Number, required: true},
    flags: [{type: String, enum: require('./flags.js')}],
    parent: {type: mongoose.Schema.Types.ObjectId, ref: 'Config'},
    parentFullIdentifier: {type: String},
    parentRevision: {type: Number},
    settings: {type: mongoose.Schema.Types.Mixed},
    labels: {type: mongoose.Schema.Types.Mixed},
    children: {type: mongoose.Schema.Types.Mixed},
    components: {type: mongoose.Schema.Types.Mixed},
    _componentReferenceIds: [{type: String}],
    _componentReferences: [{type: mongoose.Schema.Types.ObjectId, ref: 'Instance'}],
    __sources: {type: mongoose.Schema.Types.Mixed}
}, {});

function autoPopulate(next) {
    this.populate({path: '_componentReferences', select: '-component -__v'});
    this.populate({path: 'parent', select: '-__v'});
    next();
};

function fromDb(config) {
    if (!config) {
        return;
    }

    if (config._componentReferences && config._componentReferenceIds) {
        config.components = _.zipObject(config._componentReferenceIds, config._componentReferences);
        config._componentReferenceIds = undefined;
        config._componentReferences = undefined;
    }

    return config;
}

var ignoredProperties = ['__sources', '_id', 'parent', 'parentFullIdentifier', 'parentRevision', '__v', 'revision',
    'fullIdentifier'];
function customizer(objValue, srcValue, key, obj, source) {
    var self = this;

    if (ignoredProperties.indexOf(key) >= 0) {
        return;
    }

    if ((_.isPlainObject(objValue) || _.isUndefined(objValue)) &&
        (_.isPlainObject(srcValue) || _.isUndefined(srcValue))) {
        if (obj.__sources && obj.__sources[key]) {
            delete obj.__sources[key];
        }

        if (source.__sources && source.__sources[key]) {
            delete source.__sources[key];
        }

        return;
    }

    if (!obj.__sources) {
        obj.__sources = {};
    }

    if (srcValue) {
        obj.__sources[key] = source.__sources && source.__sources[key] ? source.__sources[key] : {
            fullIdentifier: self.config.fullIdentifier,
            revision: self.config.revision
        };
    } else {
        obj.__sources[key] = obj.__sources && obj.__sources[key] ? obj.__sources[key] : {
            fullIdentifier: self.parent.fullIdentifier,
            revision: self.parent.revision
        };
    }
}

ConfigSchema.methods.applyInheritance = function applyInheritance(copy, includeSources) {
    var curr = this;
    while (curr.parent) {
        if (curr.parent.applyInheritance) {
            curr.parent.applyInheritance(false, includeSources);
        }

        curr = curr.parent;
    }

    var origConfig = _.merge({}, this.toObject());
    var parent = this.parent && this.parent.toObject ? this.parent.toObject() : {};
    if (origConfig.parent) {
        delete origConfig.parent;
    }

    if (parent.parent) {
        delete parent.parent;
    }

    var result = _.merge(parent, origConfig, !includeSources ? function() {
    } : customizer, {config: origConfig, parent: parent});
    result = _.merge(copy ? _.merge({}, this) : this, result);
    return result;
};

ConfigSchema.methods.addChildren = function addChildren() {
    var config = this;
    var promise = new Promise(function(resolve, reject) {
        async.waterfall([
            function(cb) {
                mongoose.model('Config').aggregate([
                    {$match: {parentFullIdentifier: config.fullIdentifier}},
                    {$sort: {revision: -1}},
                    {
                        $group: {
                            _id: '$fullIdentifier',
                            id: {$first: '$_id'}
                        }
                    }
                ]).exec(cb);
            },
            function(results, cb) {
                mongoose.model('Config').find({
                    _id: {
                        $in: _.map(results, function(r) {
                            return r.id;
                        })
                    }
                }).sort({name: 1})
                    .exec(cb);
            },
            function(children, cb) {
                var promises = [];
                _.each(children, function(child) {
                    promises.push(child.addChildren());
                });

                config.children = children;
                Promise.all(promises).then(function() {
                    cb();
                }, function(err) {
                    cb(err);
                });
            }
        ], function(err) {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });

    return promise;
};

ConfigSchema.methods.mapFromDb = function mapFromDb() {
    fromDb(this);
};

ConfigSchema
    .pre('find', autoPopulate)
    .pre('findOne', autoPopulate)
    .post('find', function(data) {
        _.each(data, function(config) {
            fromDb(config);
        });
    })
    .post('findOne', function(config) {
        fromDb(config);
    })
    .pre('save', function(next) {
        this.components = undefined;

        var config = this;
        mongoose.model('Config').find({
            fullIdentifier: config.fullIdentifier,
            flags: {$in: config.flags}
        }).exec(function(err, results) {
            var promises = [];
            _.each(results, function(result) {
                if (config._id && config._id === result._id) {
                    return;
                }

                var flags = _.difference(result.flags, config.flags);
                promises.push(new Promise(function(resolve, reject) {
                    result.update({flags: flags}, function(err) {
                        if (err) {
                            return reject(err);
                        }

                        resolve();
                    });
                }));
            });

            Promise.all(promises).then(function() {
                next();
            }, function(err) {
                next(err);
            });
        });
    })
    .pre('validate', function(next) {
        this.modifiedDate = new Date();

        var config = this;
        async.waterfall([
            function(cb) {
                if (!config.parent) {
                    async.setImmediate(function() {
                        return cb();
                    });

                    return;
                }

                // todo(slind): should we pass in parent's _id or fullid+rev?
                mongoose.model('Config').findOne({_id: config.parent}).exec(function(err, parent) {
                    if (err || !parent) {
                        var err = new Error(['Couldn\'t find parent config', config.parent].join(', '));
                        err.code = 400;
                        return cb(err);
                    }

                    config.parentFullIdentifier = parent.fullIdentifier;
                    config.parentRevision = parent.revision;
                    config.parent = parent;

                    cb();
                });
            },
            require('./util/detectDuplicateVersions.js')(config.applyInheritance(true)),
            function(cb) {
                Promise.all(createSubInstances(config, config.fullIdentifier)).then(function() {
                    cb();
                }, function(err) {
                    cb(err);
                });
            },
            function(cb) {
                mongoose.model('Config').findOne({fullIdentifier: config.fullIdentifier}).sort({revision: -1}).exec(function(err, latestRevision) {
                    if (err) {
                        return cb(err);
                    }

                    config.revision = !latestRevision ? 1 : latestRevision.revision + 1;
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
    .index({fullIdentifier: 1, revision: -1}, {unique: true})
    .index({fullIdentifier: 1, flags: 1});

if (mongoose.models.Config) {
    delete mongoose.models.Config;
}

module.exports = mongoose.model('Config', ConfigSchema);