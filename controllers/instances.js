var mongoose = require('mongoose');

var Instance = mongoose.model('Instance');

module.exports.findAll = function(req, res) {
    var query = Instance.find({});

    if (req.query.type) {
        query.where('type').equals(req.query.type);
    }

    //if (!req.query.allRevisions) {
    //    query.select('-revision -modifiedDate');
    //    //query.sort('-revision').limit(1);
    //    query.aggregate(
    //        [
    //            { "$sort": { "buiness_id": 1, "date": -1 } },
    //            { "$group": {
    //                "_id": "$business_id",
    //                "score": { "$first": "$score" },
    //                "date": { "$first": "$date" },
    //                "description": { "$first": "$description" },
    //                "type": { "$first": "$type" }
    //            }}
    //        ],
    //        function(err,result) {
    //
    //        });
    //}

    query.select('-component -__v');

    query.exec(function(err, results) {
        return res.send(results);
    });
};
