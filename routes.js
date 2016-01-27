var components = require('./controllers/components');
var configs = require('./controllers/configs');
var instances = require('./controllers/instances');

module.exports = function(app) {
    app.get('/components/all', components.findAll);
    app.get('/components/:type/:version*?', components.findByType);
    app.post('/components', components.add);
    app.put('/components/:type', components.update);
    app.delete('/components/:type/:version', components.delete);

    app.get('/configs/all', configs.findAll);
    app.get('/configs/:fullIdentifier', configs.findByFullIdentifier);
    app.get('/configs/:fullIdentifier/:revision', configs.findByFullIdentifier);
    app.post('/configs', configs.add);

    app.get('/instances/all', instances.findAll);
};