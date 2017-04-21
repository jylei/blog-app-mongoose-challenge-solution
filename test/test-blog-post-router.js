const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const { DATABASE_URL } = require('../config');
const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);



// generate an object to represent a blogpost
// can be used to generate seed data for db
// or request.body data
function generateBlogPost() {
    return {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()
        }
    }
}


// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedblogPostData() {
    console.info('seeding blogtaurant data');
    const seedData = [];
        //adds object created in genblogpost into seeddata
    for (let i = 1; i <= 10; i++) {
        seedData.push(generateBlogPost());
    }
    // this will return a promise
    //inserts each document in the seedata into the collection
    return BlogPost.insertMany(seedData); 
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure  ata from one test does not stick
// around for next one
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Blog post API resource', function () {

    // we need each of these hook functions to return a promise
    // otherwise we'd need to call a `done` callback. `runServer`,
    // `seedblogtaurantData` and `tearDownDb` each return a promise,
    // so we return the value returned by these function calls.

    //starts the server before each function
    before(function () {
        return runServer(TEST_DATABASE_URL);
    });
    //inserts seed data into collection before each function
    beforeEach(function () {
        return seedblogPostData();
    });
    //drops the db connection after function is done running/zeroing out the database to gaurantee the state isn't maintained between tests
    afterEach(function () {
        return tearDownDb();
    });
    // closes server after function is done running so there won't be any errors when server starts for the next test
    after(function () {
        return closeServer();
    })

    describe('GET endpoint', function () {

        it('should return all existing blog posts', function () {
            /*
                strategy:
                    1. get back all blog posts return by GET req to `/posts`
                    2. prove res has right status, data type
                    3. prove the number of blogs we got back is equal to number in db
            */
            let res;
            //returning chai as a promise bc this is an async operation
            return chai.request(app)
                .get('/posts')
                //private function res
                .then(function (_res) {
                    res = _res;
                    res.should.have.status(200);
                    //otherwise our db seeding didn't work
                    res.body.should.have.length.of.at.least(1);
                    return BlogPost.count();
                })
                //making sure number of documents same as db
                .then(function (count) {
                    res.body.should.have.length.of(count);
                });
        });

        it('should return blogposts with the right fields', function () {
            //get back all blogposts and ensure they have expected keys
            let resBlogPost;
            //return chai as promise
            return chai.request(app)
                .get('/posts')
                .then(function (res) {
                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);
                    res.body.forEach(function (blogpost) {
                        blogpost.should.be.a('object');
                        blogpost.should.include.keys(
                            'id', 'title', 'content', 'author', 'created');
                    });
                    resBlogPost = res.body[0];
                    return BlogPost.findById(resBlogPost.id);
                })
                .then(function (blogpost) {
                    resBlogPost.id.should.equal(blogpost.id);
                    resBlogPost.title.should.equal(blogpost.title);
                    resBlogPost.content.should.equal(blogpost.content);
                    resBlogPost.author.should.equal(blogpost.authorName);
                });
        });
    });

    describe('POST endpoint', function () {
    /*
    strategy - make post req with data and prove what we get back has the right keys and that theid is there
    */
        it('should add a new blog', function () {
            const newBlog = generateBlogPost();

            return chai.request(app)
                .post('/posts')
                .send(newBlog)
                .then(function (res) {
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.be.a('object');
                    res.body.should.include.keys('id', 'title', 'content', 'author', 'created');
                    res.body.id.should.not.be.null;
                    res.body.title.should.equal(newBlog.title);
                    res.body.content.should.equal(newBlog.content);
                              res.body.author.should.equal(
            `${newBlog.author.firstName} ${newBlog.author.lastName}`);
                    return BlogPost.findById(res.body.id);
                })
                .then(function (blogpost) {
                    blogpost.title.should.equal(newBlog.title);
                    blogpost.content.should.equal(newBlog.content);
                    blogpost.author.firstName.should.equal(newBlog.author.firstName);
                    blogpost.author.lastName.should.equal(newBlog.author.lastName);
                });
        });
    });

    describe('PUT endpoint', function () {
    
    //strat - 
    //get existing post from db 
    //make put req to update that post. 
    //prove post returned by req contains data we sent, 
    //prove post in db is updated correctly
    
        it('should update fields you send over', function () {
            const updatedData = {
                title: 'Hello',
                content: 'World'
            };

            return BlogPost
                .findOne()
                .exec()
                .then(function (blogpost) {
                    updatedData.id = blogpost.id;

                    return chai.request(app)
                        .put(`/posts/${blogpost.id}`)
                        .send(updatedData);
                })
                .then(function (res) {
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.be.a('object');
                    res.body.title.should.equal(updatedData.title);
                    res.body.content.should.equal(updatedData.content);
                    return BlogPost.findById(updatedData.id).exec();
                })
                .then(function (blogpost) {
                    blogpost.title.should.equal(updatedData.title);
                    blogpost.content.should.equal(updatedData.content);
                });
        });
    });

    describe('DELETE endpoint', function () {
        //strat -
        //get a post
        //make delete req using post id
        //make sure correct status code
        //prove id doesn't exist in db anymore

        it('should delete a blogpost by id', function () {
            let blogpost;

            return BlogPost
                .findOne()
                .exec()
                .then(function (_blogpost) {
                    blogpost = _blogpost;
                    return chai.request(app).delete(`/posts/${blogpost.id}`);
                })
                .then(function (blog) {
                    blog.should.have.status(204);
                    return BlogPost.findById(blogpost.id).exec();
                })
                .then(function (_blogpost) {
                    should.not.exist(_blogpost);
                });
        });
    });
});