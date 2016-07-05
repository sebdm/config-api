var mongoose = require('mongoose');
var _ = require('lodash');
var Instance = mongoose.model('Instance');

// todo(slind): no need for find all
module.exports.findAll = function(req, res) {
    var query = Instance.find({});

    if (req.query.type) {
        query.where('type').equals(req.query.type);
    }

    query.select('-component -__v');

    query.exec(function(err, results) {
        _.each(results, function(instance, key) {
            instance.applyInheritance(false, req.query.includeSources === 'true');
            if (req.query.includeBlueprints !== 'true') {
                if (instance.toObject && instance.blueprint) {
                    results[key] = instance.toObject();
                    results[key].blueprint = instance.blueprint._id;
                }
            }
        });

        return res.send(results);
    });
};

module.exports.findByFullIdentifier = function(req, res) {
    var query = Instance.find({ fullIdentifier: req.params.fullIdentifier });

    if (req.query.type) {
        query.where('type').equals(req.query.type);
    }

    query.select('-component -__v');

    query.exec(function(err, results) {
        _.each(results, function(instance, key) {
            instance.applyInheritance(false, req.query.includeSources === 'true');
            if (req.query.includeBlueprints !== 'true') {
                if (instance.toObject && instance.blueprint) {
                    results[key] = instance.toObject();
                    results[key].blueprint = instance.blueprint._id;
                }
            }
        });

        return res.send(results);
    });
};
