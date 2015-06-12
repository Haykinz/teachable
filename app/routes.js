'use strict';

var User            = require('../app/models/user');
var Course          = require('../app/models/course');
var Mailer          = require('../app/mailer');
var logger          = require('../app/log');
var querystring     = require('querystring');

function isLoggedIn(req, res, next) {

    if (req.isAuthenticated()){
        return next();
    }

    res.redirect('/');
}

function isAdminLoggedIn(req, res, next) {

    if (req.isAuthenticated() && req.user.admin){
        return next();
    }

    res.redirect('/');
}

module.exports = function(app, passport) {

    // normal routes ===============================================================

    // =====================================
    // HOME PAGE ===========================
    // =====================================
    app.get('/', function(req, res) {
        res.render('index');
    });

    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    app.get('/profile', isLoggedIn, function(req, res) {
        res.render('profile', {
            user : req.user
        });
    });

    // =====================================
    // USERS SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    app.get('/users', isLoggedIn, function(req, res) {
        User.find(function(err, users) {
            res.render('users', {
                user : req.user,
                users: users,
                error: err
            });
        });
    });

    app.post('/users', isLoggedIn, function(req, res) {
        logger.info('Creating new User');

        var newUser = new User();
        if (req.user.admin) {
            newUser.admin              = req.body.admin;
        }
        newUser.local.name             = req.body.name;
        newUser.local.email            = req.body.email;
        var password                   = req.body.password || Math.random().toString(36).slice(-8);
        newUser.local.password         = newUser.generateHash(password);

        newUser.save();

        if (req.body.notify) {
            logger.info('notifying the user "' + newUser.local.name + '" (' + newUser.local.email + '")');

            Mailer.send(
                newUser.local.email,
                '',
                'Neues Konto auf Teachable',
                'Ihr neuer Nutzer ist: "' + newUser.local.name +
                '" und Ihr PassworT: "' + password +
                '". Damit können Sie sich direkt auf <a href="shdev.de:3333">Teachable</a> anmelden.',
                function() {
                res.redirect('/users');
            });
        } else {
            res.redirect('/users');
        }
    });

    app.put('/users/:id', isAdminLoggedIn, function(req, res) {
        logger.info(req.body);
        var user = {
            $set: {
                admin: req.body.admin,
                'local.email': req.body.email,
                'local.name': req.body.name
            }
        };
        User.findByIdAndUpdate(req.params.id, user, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                res.send(200);
            }
        });
    });

    app.delete('/users/:id', isAdminLoggedIn, function(req, res) {
        logger.info('Delete User "', req.params.id, '"');
        User.findByIdAndRemove(req.params.id, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                logger.error('deleted.');
                res.sendStatus(200);
            }
        });

    });

    // =====================================
    // COURSE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    app.get('/courses', isLoggedIn, function(req, res) {
        Course.find(function(err, courses) {
            if (err) {
                res.render('courses', {
                    user : req.user,
                    courses: courses,
                    users: [],
                    error: err
                });
            } else {
                User.find(function(err, users) {
                    res.render('courses', {
                        user : req.user,
                        courses: courses,
                        users: users,
                        error: err
                    });
                });
            }
        });
    });


    app.get('/courses/:id', isLoggedIn, function(req, res) {
        logger.info('Loading Course');

        Course.findById(req.params.id, function(err, course) {
            if (err) {
                res.json({
                    error: err
                });
            } else {
                res.json(course);
            }
        });
    });

    app.post('/courses', isAdminLoggedIn, function(req, res) {
        logger.info('Creating new Course');

        var teachers = req.body.teachers;
        var participants = req.body.participants;

        var newCourse = new Course({
            name             : req.body.name,
            state            : req.body.state,
            date             : req.body.date,
            description      : req.body.description,
            doodle           : req.body.doodle,
            infolink         : req.body.infolink,
            participants     : participants ? participants.split(',') : [],
            teachers         : teachers ? teachers.split(',') : []
        });
        newCourse.save();

        res.redirect('/courses');
    });

    app.put('/courses/:id', isAdminLoggedIn, function(req, res) {
        logger.info('Updating Course');
        logger.info(req.body);

        var teachers = req.body.teachers;
        var participants = req.body.participants;

        var course = {
            $set: {
                name: req.body.name,
                date: req.body.date,
                teachers: teachers ? teachers.split(',') : [],
                participants: participants ? participants.split(',') : [],
                description: req.body.description
            }
        };

        if (req.body.state) {
            course.$set.state = req.body.state;
        }

        if (req.body.doodle) {
            course.$set.doodle = req.body.doodle;
        }

        Course.findByIdAndUpdate(req.params.id, course, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                res.sendStatus(200);
            }
        });
    });

    app.delete('/courses/:id', isAdminLoggedIn, function(req, res) {
        logger.info('Delete Course "', req.params.id, '"');

        Course.findByIdAndRemove(req.params.id, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                logger.info('deleted.');
                res.sendStatus(200);
            }
        });
    });

    app.post('/courses/:id/participants', isLoggedIn, function(req, res) {
        var courseId = req.params.id;
        logger.info('Adding Participant to Course "', courseId, '"');

        var course = {
            $addToSet: {
                participants: [ req.body.participant ],
            }
        };

        Course.findByIdAndUpdate(req.params.id, course, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                res.sendStatus(200);
            }
        });
    });

    app.delete('/courses/:id/participants', isLoggedIn, function(req, res) {
        var courseId = req.params.id;
        var participantId = req.body.participant;
        logger.info('Removing Participant "' + participantId + '" from Course "', courseId, '"');

        var course = {
            $pull: {
                participants: [ participantId ],
            }
        };

        Course.findByIdAndUpdate(req.params.id, course, function(err) {
            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
            } else {
                res.sendStatus(200);
            }
        });
    });

    app.post('/courses/sendmail', isAdminLoggedIn, function(req, res) {

        var courseId = req.body.courseId;
        var subject = req.body.subject;
        var cc = req.body.cc;
        var text = req.body.text;

        logger.info('Sending Mail to  the users of course  "' + courseId + '" (CC: "' + cc + '"');
        Course.findById(courseId, function(err, course) {

            if (err) {
                logger.error(err);
                res.sendStatus(500, err);
                return;
            }

            User.find({
                _id: { $in: course.participants }
            }, function(err, users) {
                if (err) {
                    logger.error(err);
                    res.sendStatus(500, err);
                    return;
                }

                var warnings = [];
                var emails = users.map(function(user) {
                    var result = user.getEmail();

                    if (!result) {
                        var warn = 'User "' + user.getName() + '" has no email defined.';
                        console.warn(warn);
                        warnings.push(warn);
                    }

                    return result;
                });

                Mailer.send(emails, cc, subject, text, function(err) {
                    if (err) {
                        logger.error(err);
                    }

                    res.redirect('/courses?' + querystring.stringify({ errors: err , warnings: warnings }));
                });

            });
        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });



// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------

        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
            var msg = req.flash('loginMessage');
            res.render('login', { message: msg, hasMessage: msg.length > 0 });
        });


        // process the login form
        app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/courses', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));


        // SIGNUP ==============================
        // show the signup form
        app.get('/signup', function(req, res) {
            var msg = req.flash('signupMessage');
            res.render('signup', { message: msg, hasMessage: msg.length > 0 });
        });

        // process the signup form
        app.post('/signup', passport.authenticate('local-signup', {
            successRedirect : '/courses',
            failureRedirect : '/signup',
            failureFlash : true
        }));


    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

        // handle the callback after facebook has authenticated the user
        app.get('/auth/facebook/callback',
            passport.authenticate('facebook', {
                successRedirect : '/courses',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

        // handle the callback after twitter has authenticated the user
        app.get('/auth/twitter/callback',
            passport.authenticate('twitter', {
                successRedirect : '/courses',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

        // the callback after google has authenticated the user
        app.get('/auth/google/callback',
            passport.authenticate('google', {
                    successRedirect : '/courses',
                    failureRedirect : '/'
            }));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------

        app.get('/connect/local', function(req, res) {
            res.render('connect-local.ejs', { message: req.flash('loginMessage') });
        });
        app.post('/connect/local', passport.authenticate('local-signup', {
            successRedirect : '/courses', // redirect to the secure profile section
            failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

        // handle the callback after facebook has authorized the user
        app.get('/connect/facebook/callback',
            passport.authorize('facebook', {
                successRedirect : '/courses',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

        // handle the callback after twitter has authorized the user
        app.get('/connect/twitter/callback',
            passport.authorize('twitter', {
                successRedirect : '/courses',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        // send to google to do the authentication
        app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

        // the callback after google has authorized the user
        app.get('/connect/google/callback',
            passport.authorize('google', {
                successRedirect : '/courses',
                failureRedirect : '/'
            }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function() {
            res.redirect('/profile');
        });
    });

    // facebook -------------------------------
    app.get('/unlink/facebook', function(req, res) {
        var user            = req.user;
        user.facebook.token = undefined;
        user.save(function() {
            res.redirect('/profile');
        });
    });

    // twitter --------------------------------
    app.get('/unlink/twitter', function(req, res) {
        var user           = req.user;
        user.twitter.token = undefined;
        user.save(function() {
           res.redirect('/profile');
        });
    });

    // google ---------------------------------
    app.get('/unlink/google', function(req, res) {
        var user          = req.user;
        user.google.token = undefined;
        user.save(function() {
           res.redirect('/profile');
        });
    });
};
