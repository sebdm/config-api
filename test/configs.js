var chai = require('chai');
chai.use(require('chai-subset'));
var expect = chai.expect;
var config = require('../configs/test.json');
var app = require('../index.js')(config);
var server = app.listen();
var request = require('supertest').agent(server);
var mongoose = require('mongoose');
var _ = require('lodash');
var async = require('async');

describe('configs', function() {

    var subSubQaId;
    var someComponentBlueprintId;

    before(function(done) {
        async.series([
            require('./setup/importComponents'),
            require('./setup/importBlueprints'),
            function(cb) {
                mongoose.model('Instance').findOne({fullIdentifier: 'blueprints.someComponent'}).exec(function(err, result) {
                    if (err || !result) {
                        return cb(err);
                    }

                    someComponentBlueprintId = result._id;
                    cb();
                })
            }
        ], done);
    });

    after(function() {
        mongoose.connection.db.dropDatabase();
        server.close();
    });

    describe('create', function() {
        var topConfigFixture = require('./fixtures/configs/top-config.json');
        var subConfigFixture = require('./fixtures/configs/sub-config.json');
        var subSubConfigFixture = require('./fixtures/configs/sub-sub-config.json');
        var topConfigRevision1;
        var subConfigRevision1;

        it('successfully creates a new config', function(done) {
            request.post('/configs')
                .send(topConfigFixture)
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(1);
                    expect(res.body.settings.languageId).to.equal('sv-SE');
                    expect(res.body.components.topComponentInstance._id).to.be.ok;
                    topConfigRevision1 = res.body;
                })
                .end(done);
        });

        it('successfully creates a new revision of a config', function(done) {
            request.post('/configs')
                .send(_.merge({}, topConfigFixture, {
                    settings: {
                        languageId: 'en-GB'
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(2);
                    expect(res.body.settings.languageId).to.equal('en-GB');
                    expect(res.body.components.topComponentInstance._id).to.be.ok;
                })
                .end(done);
        });

        it('fails (400) to create a config that references multiple versions of the same component', function(done) {
            request.post('/configs')
                .send(_.merge({}, topConfigFixture, {
                    components: {
                        subComponentInstance: {
                            type: 'subComponent',
                            version: 1.1
                        }
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                    expect(res.text).to.match(/component: subComponent: 1.1, 1/);
                })
                .end(done);
        });

        it('successfully creates a new config (sub) that inherits another config (top)', function(done) {
            request.post('/configs?includeParent=true')
                .send(_.merge({}, subConfigFixture, {
                    parent: topConfigRevision1._id
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.parent.settings.languageId).to.equal('sv-SE');
                    expect(res.body.settings.currencyId).to.equal('SEK');
                    expect(res.body.settings.languageId).to.equal('sv-SE');
                    expect(res.body.components.topComponentInstance._id).to.be.ok;
                    expect(res.body.components.topComponentInstance._id).to.not.equal(topConfigRevision1.components.topComponentInstance._id);
                    expect(res.body.components.topComponentInstance.settings.name).to.equal('Overridden name');
                    expect(res.body.components.subComponentInstance._id).to.be.ok;
                    subConfigRevision1 = res.body;
                })
                .end(done);
        });

        it('fails (400) to create a config that references multiple versions of the same component (on separate levels of inheritance)', function(done) {
            request.post('/configs')
                .send(_.merge({}, topConfigFixture, {
                    components: {
                        anotherTopComponentInstance: {
                            type: 'topComponent',
                            version: 1.1
                        }
                    },
                    parent: topConfigRevision1._id
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                    expect(res.text).to.match(/component: topComponent: 1.1, 1/);
                })
                .end(done);
        });

        it('successfully creates a new revision of a config that overrides an instance version from its parent', function(done) {
            request.post('/configs')
                .send(_.merge({}, topConfigFixture, {
                    components: {
                        topComponentInstance: {
                            type: 'topComponent',
                            version: 1.1
                        }
                    }
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                })
                .end(done);
        });

        it('successfully creates a new config (subsub) that inherits another config (sub)', function(done) {
            request.post('/configs?includeParent=true')
                .send(_.merge({}, subSubConfigFixture, {
                    parent: subConfigRevision1._id
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.parent.settings.languageId).to.equal('sv-SE');
                    expect(res.body.settings.currencyId).to.equal('SEK');
                    expect(res.body.settings.languageId).to.equal('sv-SE');
                    expect(res.body.settings.countryId).to.equal('SE');
                    expect(res.body.components.topComponentInstance._id).to.be.ok;
                    expect(res.body.components.topComponentInstance.settings.name).to.equal('Overridden name');
                })
                .end(done);
        });

        it('successfully creates a new revision of subsub that has flags set to qa', function(done) {
            request.post('/configs')
                .send(_.merge({}, subSubConfigFixture, {
                    flags: ['dev', 'qa'],
                    parent: subConfigRevision1._id
                }))
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.flags[0]).to.equal('dev');
                    expect(res.body.flags[1]).to.equal('qa');
                })
                .end(done);
        });

        it('successfully creates a new revision of subsub that also has a qa flag (should set previous qa flagged revision to non-qa)', function(done) {
            request.post('/configs')
                .send(_.merge({}, subSubConfigFixture, {
                    flags: ['qa'],
                    parent: subConfigRevision1._id
                }))
                .end(function(err, res) {
                    subSubQaId = res.body._id;
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(3);

                    mongoose.model('Config').find({fullIdentifier: 'top.sub.subsub', flags: 'qa'})
                        .exec(function(err, res) {
                            expect(res.length).to.equal(1);
                            done();
                        });
                });
        });

        it('successfully creates a new revision of a top config (that includes a component that references a blueprint)', function(done) {
            request.post('/configs')
                .send(_.merge({}, topConfigFixture, {
                    components: {
                        someComponentInheritingBlueprint: {
                            type: 'someComponent',
                            version: 1,
                            blueprint: someComponentBlueprintId,
                            components: {
                                subComponentInstance2: {
                                    type: 'subComponent',
                                    version: 1,
                                    settings: {
                                        instanceSetting: 2
                                    }
                                }
                            }
                        }
                    }
                }))
                .end(function(err, res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(4);
                    expect(res.body.components.someComponentInheritingBlueprint.settings.name).to.equal('Name from blueprint');
                    done();
                });
        });
    });

    describe('retrieve', function() {
        it('fails (404) to retrieve a config that doesn\'t exist', function(done) {
            request.get('/configs/doesNotExist')
                .expect(function(res) {
                    expect(res.status).to.equal(404);
                })
                .end(done);
        });

        it('fails (404) to retrieve an invalid revision', function(done) {
            request.get('/configs/top/jibberish')
                .expect(function(res) {
                    expect(res.status).to.equal(400);
                })
                .end(done);
        });

        it('retrieves all revisions of a config', function(done) {
            request.get('/configs/top')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body[0].revision).to.equal(1);
                    expect(res.body[1].revision).to.equal(2);
                })
                .end(done);
        });

        it('retrieves all revisions of a config (include parents)', function(done) {
            request.get('/configs/top.sub?includeParent=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body[0].parent._id).to.be.ok;
                })
                .end(done);
        });

        it('retrieves the latest revision of a config', function(done) {
            request.get('/configs/top/latest')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(4);
                })
                .end(done);
        });

        it('retrieves the latest revision of a config (include parents)', function(done) {
            request.get('/configs/top.sub/latest?includeParent=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.parent._id).to.be.ok;
                })
                .end(done);
        });

        it('retrieves a specific revision of a config', function(done) {
            request.get('/configs/top/1')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(1);
                })
                .end(done);
        });

        it('retrieves a specific revision of a config (include parents)', function(done) {
            request.get('/configs/top.sub/1?includeParent=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.parent._id).to.be.ok;
                })
                .end(done);
        });

        it('retrieves a specific revision of a config (includes sources correctly)', function(done) {
            request.get('/configs/top.sub.subsub/1?includeSources=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.revision).to.equal(1);
                    expect(res.body.__sources._id).to.not.be.ok;
                    expect(res.body.__sources.__v).to.not.be.ok;
                    expect(res.body.__sources.fullIdentifier).to.not.be.ok;
                    expect(res.body.__sources.parentFullIdentifier).to.not.be.ok;
                    expect(res.body.__sources.parentRevision).to.not.be.ok;
                    expect(res.body.__sources.revision).to.not.be.ok;
                    expect(res.body.__sources.__sources).to.not.be.ok;
                    expect(res.body.__sources.flags).to.be.ok;
                    expect(res.body.__sources.name).to.be.ok;
                    expect(res.body.settings.__sources.languageId.fullIdentifier).to.equal('top');
                    expect(res.body.settings.__sources.languageId.revision).to.equal(1);
                    expect(res.body.settings.__sources.currencyId.fullIdentifier).to.equal('top.sub');
                    expect(res.body.settings.__sources.currencyId.revision).to.equal(1);
                    expect(res.body.settings.__sources.countryId.fullIdentifier).to.equal('top.sub.subsub');
                    expect(res.body.settings.__sources.countryId.revision).to.equal(1);
                    expect(res.body.components.topComponentInstance.settings.__sources.name.fullIdentifier).to.equal('top.sub');
                    expect(res.body.components.topComponentInstance.settings.__sources.someSetting.fullIdentifier).to.equal('top');
                })
                .end(done);
        });

        it('retrieves the revision with the specified flag', function(done) {
            request.get('/configs/top.sub.subsub/qa')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body._id).to.equal(subSubQaId);
                })
                .end(done);
        });

        it('retrieves (top does not have a parent)', function(done) {
            request.get('/configs/top?includeParent=true')
                .expect(function(res) {
                    expect(res.body[0].parent).to.not.be.ok;
                    expect(res.body[1].parent).to.not.be.ok;
                })
                .end(done);
        });

        it('retrieves latest revision including children', function(done) {
            request.get('/configs/top.sub/latest?includeChildren=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.children).to.be.ok;
                    expect(res.body.children.length).to.equal(1);
                    expect(res.body.children[0].name).to.equal('Sub sub');
                    expect(res.body.children[0].revision).to.equal(3);
                })
                .end(done);
        });

        it('retrieves a specific revision of a config (verify blueprint sources)', function(done) {
            request.get('/configs/top/4?includeSources=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.components.someComponentInheritingBlueprint.settings.__sources.name.fullIdentifier).to.equal('blueprints.someComponent');
                    expect(res.body.components.someComponentInheritingBlueprint.components.subComponentInstance2).to.be.ok;
                    expect(res.body.components.someComponentInheritingBlueprint.components.subComponentInstance2.settings.__sources.blueprintSetting.fullIdentifier).to.equal('blueprints.someComponent');
                    expect(res.body.components.someComponentInheritingBlueprint.components.subComponentInstance2.settings.__sources.instanceSetting.fullIdentifier).to.equal('top.someComponentInheritingBlueprint');
                    expect(res.body.components.someComponentInheritingBlueprint.components.subComponentInstance2.settings.blueprintSetting).to.equal(1);
                    expect(res.body.components.someComponentInheritingBlueprint.components.subComponentInstance2.settings.instanceSetting).to.equal(2);
                    expect(res.body.componentVersions.someComponent).to.equal(1);
                })
                .end(done);
        });

        it('retrieves all top including children', function(done) {
            request.get('/configs/top?includeChildren=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body[0].children.length).to.equal(1);
                    expect(res.body[0].children[0].name).to.equal('Sub');
                    expect(res.body[0].children[0].revision).to.equal(1);
                    expect(res.body[0].children[0].children[0].name).to.equal('Sub sub');
                    expect(res.body[0].children[0].children[0].revision).to.equal(3);
                })
                .end(done);
        });

        it('retrieves a specific revision of a config (verify component versions)', function(done) {
            request.get('/configs/top/4?includeChildren=true')
                .expect(function(res) {
                    expect(res.status).to.equal(200);
                    expect(res.body.componentVersions.topComponent).to.equal(1);
                    expect(res.body.componentVersions.someComponent).to.equal(1);
                    expect(res.body.componentVersions.subComponent).to.equal(1);
                })
                .end(done);
        });
    });
    //
    //describe('delete', function() {
    //    it('deletes a specific version of a component', function(done) {
    //        request.delete('/components/subComponent/1.1')
    //            .expect(function(res) {
    //                expect(res.status).to.equal(200);
    //                expect(res.body.ok).to.equal(1);
    //                expect(res.body.n).to.equal(1);
    //            })
    //            .end(function() {
    //                request.get('/components/subComponent/1.1')
    //                    .expect(function(res) {
    //                        expect(res.status).to.equal(404);
    //                    })
    //                    .end(done);
    //            });
    //    });
    //});
});