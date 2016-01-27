var mongoose = require('mongoose');

module.exports = function schemaLoader(ref, cb) {
    if (ref.indexOf('configapi:') === 0) {
        var path = ref.split(':')[1];
        var split = path.split('/');
        if (split[0] === 'component' && split.length >= 3) {
            var componentType = split[1],
                componentVersion = split[2];
            mongoose.model('Component').findOne({ type: componentType, version: componentVersion }, function(err, refComponent) {
                if (err || !refComponent) {
                    var err = new Error(['Couldn\'t find referenced schema', componentType, componentVersion].join(', '));
                    err.code = 422;
                    cb(err, null);
                    return;
                }

                cb(null, (split.length === 4 ? refComponent[split[3]] : refComponent) || null);
            });
        } else {
            cb(new Error('Unrecognized first part of $ref path: ' + split[0]));
        }
    } else {
        cb(new Error('Unrecognized schema reference: ' + ref));
    }
};