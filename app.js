var express = require('express');
var path = require('path');
var passport = require('passport');
var logfmt = require('logfmt');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var monk = require('monk');

var config = require('./config.js');
var monitor = require('./services/monitor.js');

var bitcore = require('bitcore');
bitcore.buffertools.extend();

var TwitterStrategy = require('passport-twitter').Strategy;

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
    consumerKey: config.TWITTER_CONSUMER_KEY,
    consumerSecret: config.TWITTER_CONSUMER_SECRET,
    callbackURL: config.DOMAIN + '/auth/twitter/callback'
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
app.use(bodyParser.urlencoded({extended: true}));

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

app.post('/payments', function(req, res) {
  var payment = JSON.parse(Object.keys(req.body)[0]).signed_data;
  console.log('Payment received at ' + payment.address + ' for ' + payment.amount_btc + ' btc');

  var collection = req.db.get('bits');
  collection.findOne({address: payment.address}, function onFind(err, bit) {
    if (err) throw err;
    if (!bit) throw new Error('not address found');
    if (payment.amount < 10000) return res.send('ok'); // TODO: How much your love is worth?

    bit.paymentTx = payment.txhash;
    bit.paymentAmount = payment.amount;
    bit.payed = new Date();
    collection.updateById(bit._id, bit);
    res.send('ok');
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

      monitor.register(addr, function(err, data) {
        if (err) throw err;
      });

      res.render('wall', {cause: hashtag, bit: bit, user: req.user});
    });
  });
});

var port = Number(process.env.PORT || 3000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
