var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
var async = require('async');
var createSubInstances = require('./util/createSubInstances.js');
var JaySchema = require('jayschema');

var ComponentSchema = new mongoose.Schema({
    modifiedDate: {type: Date, required: true},
    type: {type: String, required: true},
    version: {type: Number, required: true},
    componentSchema: {type: mongoose.Schema.Types.Mixed, required: true},
    settings: {type: mongoose.Schema.Types.Mixed},
    labels: {type: mongoose.Schema.Types.Mixed},
    components: {type: mongoose.Schema.Types.Mixed},
    _componentReferences: [{type: mongoose.Schema.Types.ObjectId, ref: 'Instance'}],
    _componentReferenceIds: [{type: String}]
}, {});

function preFindAutoPopulate(next) {
    this.populate({path: '_componentReferences', select: '-component -__v'});
    next();
};

function componentsFromDb(component) {
    if (component && component._componentReferences && component._componentReferenceIds) {
        component.components = _.zipObject(component._componentReferenceIds, component._componentReferences);
        component._componentReferenceIds = undefined;
        component._componentReferences = undefined;
    }

    return component;
}

ComponentSchema.methods.mapFromDb = function mapComponentsFromDb() {
    componentsFromDb(this);
};

ComponentSchema
    .pre('find', preFindAutoPopulate)
    .pre('findOne', preFindAutoPopulate)
    .post('find', function(data) {
        _.each(data, function(component) {
            componentsFromDb(component);
        });
    })
    .post('findOne', function(component) {
        componentsFromDb(component);
    })
    .pre('validate', function(next) {
        this.modifiedDate = new Date();
        var component = this;
        async.waterfall([
            require('./util/detectDuplicateVersions.js')(component),
            function(cb) {
                if (component.componentSchema) {
                    delete component.componentSchema.$schema;
                    component.componentSchema.additionalProperties = true;
                }

                new JaySchema(require('./util/schemaLoader.js')).validate(component.toObject(), component.componentSchema, function(errs) {
                    if (errs) {
                        var err = new Error(['Schema validation failed for component',
                            component.type].join(', '));
                        err.component = component;
                        err.code = 400;
                        err.validationErrors = errs;
                        cb(err);
                        return;
                    }

                    cb();
                });
            },
            function(cb) {
                Promise.all(createSubInstances(component, ['components', component.type].join('.'))).then(function() {
                    cb();
                }, function(err) {
                    cb(err);
                })
            }
        ], function(err, result) {
            if (err) {
                next(err);
            } else {
                next();
            }
        });
    })
    .pre('save', function(next) {
        this.components = undefined;
        next();
    });
ComponentSchema.index({type: 1, version: -1}, {unique: true});

// todo(slind): set all settings and labels to optional? (ie. remove from "required") OR update all components to have all/most settings and labels as optional (e.g. settingName?: number)

if (mongoose.models.Component) {
    delete mongoose.models.Component;
}

module.exports = mongoose.model('Component', ComponentSchema);