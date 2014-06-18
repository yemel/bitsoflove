var express = require('express');
var path = require('path');
var passport = require('passport')
var logfmt = require('logfmt');
var request = require('request');
var cookieParser = require('cookie-parser');
var session = require('express-session');

var TwitterStrategy = require('passport-twitter').Strategy;

// ENVIRONMENT
var TWITTER_CONSUMER_KEY = process.env.T_API_KEY;
var TWITTER_CONSUMER_SECRET = process.env.T_API_SECRET;
var DOMAIN = process.env.DOMAIN;

// TWITTER
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new TwitterStrategy({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    callbackURL: DOMAIN + '/auth/twitter/callback'
  },
  function(token, tokenSecret, profile, done) {
    process.nextTick(function () {
      return done(null, profile);
    });
  }
));

// APPLICATION
var app = express();

var cons = require('consolidate');
app.engine('hbs', cons.handlebars);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logfmt.requestLogger());
app.use(express.static(__dirname + '/public'));

app.use(cookieParser());
app.use(session({ secret: process.env.SECRET }));

app.use(passport.initialize());
app.use(passport.session());

/* Auth end points */
app.get('/auth/twitter',
  passport.authenticate('twitter'),
  function(req, res){
});

app.get('/auth/twitter/callback', 
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

/* GET home page. */
app.get('/', function(req, res) {
  res.render('index', {user: req.user});
});

app.get('/love/h/bitcoin', function(req, res) {
  res.render('wall', {topic: '#bitcoin', user: req.user});
});

var port = Number(process.env.PORT || 3000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
