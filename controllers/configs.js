var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');

var Config = mongoose.model('Config');

module.exports.findAll = function(req, res) {
    Config.find({}, '-__v', function(err, results) {
        _.each(results, function(result, key) {
            result.applyInheritance(false, req.query.includeSources === 'true');

            if (result.toObject) {
                result = result.toObject();
            }

            if (!req.query.includeParent) {
                result.parent = undefined;
            }

            results[key] = result;
        });

        return res.send(results);
    });
};

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

        var promises = [];

        query.exec(function(err, result) {
                if (!result || err) {
                    return res.sendStatus(404);
                }

                result.applyInheritance(false, req.query.includeSources === 'true');

                if (req.query.includeChildren === 'true') {
                    promises.push(result.addChildren());
                }

                Promise.all(promises).then(function() {
                    if (result.toObject) {
                        result = result.toObject();
                    }

                    if (!req.query.includeParent) {
                        result.parent = undefined;
                    }

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
            result.applyInheritance(false, req.query.includeSources === 'true');

            if (req.query.includeChildren === 'true') {
                promises.push(result.addChildren());
            }

            results[key] = result;
        });

        Promise.all(promises).then(function() {
            _.each(results, function(result, key) {
                if (result.toObject) {
                    result = result.toObject();
                }

                if (!req.query.includeParent) {
                    result.parent = undefined;
                }

                results[key] = result;
            });

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
                result.applyInheritance(false, req.query.includeSources === 'true');

                if (result.toObject) {
                    result = result.toObject();
                }

                if (!req.query.includeParent) {
                    result.parent = undefined;
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