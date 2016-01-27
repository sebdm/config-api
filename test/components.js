var chai = require('chai');
chai.use(require('chai-subset'));
var expect = chai.expect;
var config = require('../configs/test.json');
var app = require('../index.js')(config);
var server = app.listen();
var request = require('supertest').agent(server);
var mongoose = require('mongoose');
var _ = require('lodash');

describe('components', function() {

    after(function() {
        mongoose.connection.db.dropDatabase();
        server.close();
    });

    describe('create', function() {
        var subComponentFixture = require('./fixtures/components/sub-component.json');
        var someComponentFixture = require('./fixtures/components/some-component.json');
        var topComponentFixture = require('./fixtures/components/top-component.json');
        var subComponentV1;
        var someComponentV1;

        it('successfully creates a new component', function(done) {
            request.post('/components')
                .send(subComponentFixture)
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.version).to.equal(1);
                    expect(res.body.type).to.equal('subComponent');
                    subComponentV1 = res.body;
                })
                .end(done);
        });

        it('fails (409) to create the same component (and version) a second time', function(done) {
            request.post('/components')
                .send(subComponentFixture)
                .expect(function(res) {
                    expect(res.status).to.equal(409);
                    expect(res.body._id).to.equal(subComponentV1._id);
                })
                .end(done);
        });

        it('successfully creates a new component version', function(done) {
            request.post('/components')
                .send(_.merge({}, subComponentFixture, {
                    version: 1.1,
                    componentSchema: {properties: {version: {enum: [1.1]}}}
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.version).to.equal(1.1);
                    expect(res.body.type).to.equal('subComponent');
                })
                .end(done);
        });

        it('fails (400) to create a new component version (violates schema)', function(done) {
            request.post('/components')
                .send(_.merge({}, subComponentFixture, {
                    version: 1.2,
                    componentSchema: {properties: {version: {enum: [1.0]}}}
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                })
                .end(done);
        });

        it('successfully creates a new component that references a subComponent', function(done) {
            request.post('/components')
                .send(someComponentFixture)
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.type).to.equal('someComponent');
                    expect(res.body.version).to.equal(1.0);
                    expect(res.body.settings.name).to.equal('Default name');
                    expect(res.body.components.subComponentInstance._id).to.be.ok;
                    expect(res.body.components.subComponentInstance.type).to.equal('subComponent');
                    expect(res.body.components.subComponentInstance.version).to.equal(1);
                    expect(res.body.components.subComponentInstance.fullIdentifier).to.equal('components.someComponent.subComponentInstance');
                    expect(res.body.components.subComponentInstance.revision).to.equal(1);
                    someComponentV1 = res.body;
                })
                .end(done);
        });

        it('successfully creates a new version of a component that references a subComponent', function(done) {
            request.post('/components')
                .send(_.merge({}, someComponentFixture, {
                    version: 1.1,
                    componentSchema: {properties: {version: {enum: [1.1]}}},
                    settings: {name: 'Name in 1.1'}
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.type).to.equal('someComponent');
                    expect(res.body.version).to.equal(1.1);
                    expect(res.body.settings.name).to.equal('Name in 1.1');
                    expect(res.body.components.subComponentInstance._id).to.be.ok;
                    expect(res.body.components.subComponentInstance.type).to.equal('subComponent');
                    expect(res.body.components.subComponentInstance.version).to.equal(1);
                    expect(res.body.components.subComponentInstance.fullIdentifier).to.equal('components.someComponent.subComponentInstance');
                    expect(res.body.components.subComponentInstance.revision).to.equal(2);
                })
                .end(done);
        });

        it('fails (422) to create a new version of a component that references a sub component that does not exist', function(done) {
            request.post('/components')
                .send(_.merge({}, someComponentFixture, {
                    version: 1.2,
                    componentSchema: {properties: {version: {enum: [1.2]}}},
                    components: {
                        doesNotExistInstance: {
                            type: 'doesNotExist',
                            version: 1.0
                        }
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(422);
                })
                .end(done);
        });

        it('fails (400) to create a new component that references a sub component that does not exist (violates schema)', function(done) {
            request.post('/components')
                .send(require('./fixtures/components/some-component-invalid-child.json'))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                })
                .end(done);
        });

        it('successfully creates a new component that references a someComponent', function(done) {
            request.post('/components')
                .send(topComponentFixture)
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.type).to.equal('topComponent');
                    expect(res.body.version).to.equal(1.0);
                    expect(res.body.settings.name).to.equal('Default name');
                    expect(res.body.components.someComponentInstance._id).to.be.ok;
                    expect(res.body.components.someComponentInstance.type).to.equal('someComponent');
                    expect(res.body.components.someComponentInstance.version).to.equal(1);
                    expect(res.body.components.someComponentInstance.fullIdentifier).to.equal('components.topComponent.someComponentInstance');
                    expect(res.body.components.someComponentInstance.revision).to.equal(1);
                })
                .end(done);
        });

        it('successfully creates a new version of a component that references a someComponent', function(done) {
            request.post('/components')
                .send(_.merge({}, topComponentFixture, {
                    version: 1.1,
                    componentSchema: {properties: {version: {enum: [1.1]}}},
                    components: {
                        someComponentInstance: {
                            components: {
                                subComponentInstance: {
                                    type: 'subComponent',
                                    version: 1.0
                                }
                            }
                        }
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.type).to.equal('topComponent');
                    expect(res.body.version).to.equal(1.1);
                    expect(res.body.settings.name).to.equal('Default name');
                    expect(res.body.components.someComponentInstance._id).to.be.ok;
                    expect(res.body.components.someComponentInstance.type).to.equal('someComponent');
                    expect(res.body.components.someComponentInstance.version).to.equal(1);
                    expect(res.body.components.someComponentInstance.fullIdentifier).to.equal('components.topComponent.someComponentInstance');
                    expect(res.body.components.someComponentInstance.revision).to.equal(2);
                    expect(res.body.components.someComponentInstance.components.subComponentInstance._id).to.be.ok;
                    expect(res.body.components.someComponentInstance.components.subComponentInstance.revision).to.equal(1);
                })
                .end(done);
        });

        it('fails (400) to create a new version of a component that references a someComponent with an invalid subComponentInstance version (violates schema)', function(done) {
            request.post('/components')
                .send(_.merge({}, topComponentFixture, {
                    version: 1.2,
                    componentSchema: {properties: {version: {enum: [1.2]}}},
                    components: {
                        someComponentInstance: {
                            components: {
                                subComponentInstance: {
                                    type: 'subComponent',
                                    version: 1.1
                                }
                            }
                        }
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                })
                .end(done);
        });

        it('fails (400) to create a new version of a component that indirectly uses mixed versions of the same component', function(done) {
            request.post('/components')
                .send(_.merge({}, require('./fixtures/components/top-component-with-invalid-direct-sub-component.json'), {
                    version: 1.2,
                    componentSchema: {properties: {version: {enum: [1.2]}}}
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                })
                .end(done);
        });
    });

    describe('retrieve', function() {
        it('fails (404) to retrieve a component that doesn\'t exist', function(done) {
            request.get('/components/doesNotExist')
                .expect(function(res) {
                    expect(res.status).to.equal(404);
                })
                .end(done);
        });

        it('retrieves all versions of all components', function(done) {
            request.get('/components/all')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body[0].version).to.equal(1);
                    expect(res.body[1].version).to.equal(1.1);
                })
                .end(done);
        });

        it('retrieves all versions of a type', function(done) {
            request.get('/components/subComponent')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.length).to.equal(2);
                    expect(res.body[0].version).to.equal(1.1);
                    expect(res.body[1].version).to.equal(1);
                })
                .end(done);
        });
    });

    describe('delete', function() {
        it('deletes a specific version of a component', function(done) {
            request.delete('/components/subComponent/1.1')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.ok).to.equal(1);
                    expect(res.body.n).to.equal(1);
                })
                .end(function() {
                    request.get('/components/subComponent/1.1')
                        .expect(function(res) {
                            expect(res.status).to.equal(404);
                        })
                        .end(done);
                });
        });
    });
});