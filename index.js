#!/usr/bin/env node

var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

var defaultConfig = require('./configs/local.json');

require('./models/component');
require('./models/config');
require('./models/instance');

function app(config) {
    var app = express();

    config = config || defaultConfig;

    mongoose.connect(config.mongoUri, function() {
        if (config.dev === true) {
            mongoose.connection.db.dropDatabase();
            if (config.import === true) {
                require('./test/setup/import')(function() {});
            }
        }
    });

    var db = mongoose.connection;

    db.on('error', function() {
        throw new Error('Unable to connect to database at %s', config.mongoUri);
    });

    db.once('open', function() {
        console.log('Connected to Mongo server at %s', config.mongoUri);
    });

    process.on('SIGINT', function() {
        if (config.dev === true) {
            mongoose.connection.db.dropDatabase();
        }

        mongoose.connection.close(function () {
            console.log('Mongoose disconnected on app termination');
            process.exit(0);
        });
    });

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    require('./routes')(app);

    if (!module.parent) {
        app.listen(3001);
        console.log('Config API listening on port %d', config.port);
    }

    return app;
}

if (!module.parent) {
    app();
}

module.exports = app;