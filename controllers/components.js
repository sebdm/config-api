var mongoose = require('mongoose');

var Component = mongoose.model('Component');

module.exports.findAll = function(req, res) {
    Component.find({}, function(err, results) {
        return res.send(results);
    });
};

module.exports.findByType = function(req, res) {
    var query = Component.find({type: req.params.type});
    if (req.params.version) {
        query.where('version').equals(req.params.version);
    }

    query.exec(function(err, result) {
        if (!result || !result.length) {
            return res.sendStatus(404);
        }

        return res.send(result);
    });
};

module.exports.add = function(req, res) {
    Component.create(req.body, function(err, result) {
        if (err) {
            Component.findOne({type: req.body.type, version: req.body.version}, function(findErr, result) {
                if (!findErr && result) {
                    return res.status(409).send(result);
                } else {
                    if (err.code > 500) {
                        err.code = 500;
                    }

                    return res.status(err.code || 500).send(err.toString());
                }
            });
        } else {
            Component.findOne({ _id: result._id }, function(err, result) {
                return res.send(result);
            });
        }
    });
};

module.exports.update = function(req, res) {
    Component.update({type: req.params.type}, req.body,
        function(err, numberAffected) {
            if (err) {
                return console.log(err);
            }

            res.send(202);
        });
};

module.exports.delete = function(req, res) {
    Component.remove({type: req.params.type, version: req.params.version}, function(err, result) {
        if (err) {
            return res.status(500);
        } else {
            return res.send(result);
        }
    });
};