var express = require('express');
var path = require('path');
var passport = require('passport');
var logfmt = require('logfmt');
var request = require('request');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var monk = require('monk');
var bitcore = require('bitcore');
bitcore.buffertools.extend();

var TwitterStrategy = require('passport-twitter').Strategy;

// ENVIRONMENT
var TWITTER_CONSUMER_KEY = process.env.T_API_KEY;
var TWITTER_CONSUMER_SECRET = process.env.T_API_SECRET;
var DOMAIN = process.env.DOMAIN;

var mongoUri = process.env.MONGOLAB_URI || 'mongodb://localhost:27017/bitlove';
var db = monk(mongoUri);

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

// Make our db accessible to the router
app.use(function(req,res,next){
    req.db = db;
    next();
});

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

app.get('/data', function(req, res) {
  var collection = req.db.get('bits');
  collection.findOne({username: 'yemel', cause: 'bitcoin'}, function onFind(err, vouch){
    console.log(err, vouch);
    res.send('Hola');
  });
});

app.get('/love/h/:hashtag', function(req, res) {
  if (!req.user) return res.redirect('/');

  var hashtag = '#' + req.param('hashtag');
  var collection = req.db.get('bits');
  collection.findOne({
    username: req.user.username,
    cause: hashtag
  }, function onFind(err, bit){
    if (err) throw err;
    if (bit) return res.render('wall', {cause: hashtag, bit: bit, user: req.user});

    var key = new bitcore.Key.generateSync();
    var hash = bitcore.util.sha256ripe160(key.public);
    var addr = new bitcore.Address(0, hash).toString();

    bit = {
      username: req.user.username,
      cause: hashtag,
      address: addr,
      pkey: key.private.toHex(),
      created: new Date()
    };

    collection.insert(bit, function onInsert(err, bit){
      if (err) throw err;
      res.render('wall', {cause: hashtag, bit: bit, user: req.user});
    });
  });
});

var port = Number(process.env.PORT || 3000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
