var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
var async = require('async');
var jsondiffpatch = require('jsondiffpatch');

var Config = mongoose.model('Config');

// todo(slind): no need for find all
//module.exports.findAll = function(req, res) {
//    Config.find({}, '-__v', function(err, results) {
//        _.each(results, function(result, key) {
//            result.applyInheritance(false, req.query.includeSources === 'true');
//
//            if (result.toObject) {
//                result = result.toObject();
//            }
//
//            if (!req.query.includeParent) {
//                result.parent = undefined;
//            }
//
//            results[key] = result;
//        });
//
//        return res.send(results);
//    });
//};

module.exports.diff = function(req, res) {
    var query = Config.find({
        fullIdentifier: req.params.fullIdentifier,
        revision: {$in: [req.params.revisionOld, req.params.revisionNew]}
    });

    query.exec(function(err, results) {
        if (err || !results.length) {
            return res.status(404);
        }

        var revisionOld = _.find(results, function(rev) {
            return rev.revision == req.params.revisionOld;
        });

        var revisionNew = _.find(results, function(rev) {
            return rev.revision == req.params.revisionNew;
        });

        async.parallel([
            function(cb) {
                setup(revisionOld, req).then(function(result) {
                    cb(null, result);
                }, function(err) {
                    cb(err);
                });
            },
            function(cb) {
                setup(revisionNew, req).then(function(result) {
                    cb(null, result);
                }, function(err) {
                    cb(err);
                });
            }
        ], function(err, results) {
            if (err) {
                if (err.code > 500) {
                    err.code = 500;
                }

                return res.status(err.code || 500).send(err.toString());
            }

            var differences = jsondiffpatch.diff(results[0], results[1], function(path, key) {
                if (['_id', 'revision', 'modifiedDate', 'flags'].indexOf(key) >= 0) {
                    return true;
                }

                return false;
            });

            return res.send(differences);
        });
    });
};

function setup(result, req) {
    var promises = [];
    _.each(result.components, function(instance) {
        instance.applyInheritance(false, req.query.includeSources === 'true');
    });

    result.applyInheritance(false, req.query.includeSources === 'true');

    promises = promises.concat(result.addComponentVersions());

    if (req.query.includeChildren === 'true') {
        promises.push(result.addChildren());
    }

    return new Promise(function(resolve, reject) {
        Promise.all(promises).then(function() {
            if (result.toObject) {
                result = result.toObject();
            }

            if (req.query.includeBlueprints !== 'true') {
                _.each(result.components, function(instance, key) {
                    if (instance.blueprint) {
                        instance.blueprint = instance.blueprint._id;
                    }
                });
            }

            if (req.query.includeParent !== 'true' && result.parent) {
                result.parent = result.parent._id;
            }

            resolve(result);
        }, function(err) {
            reject(err);
        });
    });
}

module.exports.findByFullIdentifier = function(req, res) {
    if (req.params.revision) {
        var query = Config.findOne({fullIdentifier: req.params.fullIdentifier});
        query.select('-__v');
        if (req.params.revision === 'latest') {
            query.sort({revision: -1});
        } else if (require('../models/flags.js').indexOf(req.params.revision) >= 0) {
            query.where('flags').equals(req.params.revision);
        } else if (!isNaN(req.params.revision)) {
            query.where('revision').equals(req.params.revision);
        } else {
            return res.status(400).send('Invalid revision specifier');
        }

        query.exec(function(err, result) {
                if (!result || err) {
                    return res.sendStatus(404);
                }

                setup(result, req).then(function(result) {
                    return res.send(result);
                }, function(err) {
                    if (err.code > 500) {
                        err.code = 500;
                    }

                    return res.status(err.code || 500).send(err.toString());
                });
            }
        );

        return;
    }

    var query = Config.find({fullIdentifier: req.params.fullIdentifier});
    query.select('-__v');

    var promises = [];
    query.exec(function(err, results) {
        if (!results || !results.length || err) {
            return res.sendStatus(404);
        }

        _.each(results, function(result, key) {
            promises.push(setup(result, req));
        });

        Promise.all(promises).then(function(results) {
            return res.send(results);
        }, function(err) {
            if (err.code > 500) {
                err.code = 500;
            }

            return res.status(err.code || 500).send(err.toString());
        });
    });
};

module.exports.add = function(req, res) {
    Config.create(req.body, function(err, result) {
        if (err) {
            if (err.code > 500) {
                err.code = 500;
            }

            return res.status(err.code || 500).send(err.toString());
        } else {
            Config.findOne({_id: result._id}, function(err, result) {
                _.each(result.components, function(instance) {
                    instance.applyInheritance(false, req.query.includeSources === 'true');
                });

                result.applyInheritance(false, req.query.includeSources === 'true');

                if (result.toObject) {
                    result = result.toObject();
                }

                if (!req.query.includeParent && result.parent) {
                    result.parent = result.parent._id;
                }

                return res.send(result);
            });
        }
    });
};

//module.exports.update = function(req, res) {
//    Config.update({type: req.params.type}, req.body,
//        function(err, numberAffected) {
//            if (err) {
//                return console.log(err);
//            }
//
//            res.send(202);
//        });
//};

//module.exports.delete = function(req, res) {
//    Config.remove({fullIdentifier: req.params.type, version: req.params.version}, function(err, result) {
//        if (err) {
//            return res.status(500);
//        } else {
//            return res.send(result);
//        }
//    });
//};