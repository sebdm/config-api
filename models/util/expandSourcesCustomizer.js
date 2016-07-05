var _ = require('lodash');

var ignoredProperties = ['__sources', '_id', 'parent', 'parentFullIdentifier', 'parentRevision', '__v', 'revision',
    'fullIdentifier', 'component', 'blueprintFullIdentifier', 'blueprintRevision', 'blueprint', 'flags'];

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

module.exports = customizer;