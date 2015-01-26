# Socketsaurus

Socketsaurus exposes changes in your Mongoose collections, via sockets.

## NPM

```
npm install socketsaurus --save
```

## Usage

Call Socketsaurus with your config, and it will return you a function that you can use to expose collections.

```js
// io = require('socket.io')(server);

var socketsaurus = require('socketsaurus');

var expose = socketsaurus(io, {
  // required
  oplogUrl: 'mongodb://<user>:<password>@candidate.35.mongolayer.com:10491,candidate.34.mongolayer.com:10493/local?authSource=oplog_test',
  // required
  db: 'dev'
});
```

Then, you can expose any Mongoose collection.

```js
var mongoose = require('mongoose');

var schema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: Date
});

schema.pre('save', function(next) {
  this.updated = Date.now();
  next();
});

var Person = mongoose.model('people', schema);

expose(Person);
```

### Events

Each collection exposed will emit the following events:

- created
- removed
- modified
- modification

See docs on the [Socketsaurus JS Client](https://github.com/caarbon/socketsaurus-js-client) for examples on listening to these events.

Events are emitted within namespace, per collection. If exposing a `Person` model, that is stored in the `People` collection in the database, then any event will be emitted to the `People` namespace.

Clients can listen to specific attributes of documents by sending an event to the server.

**Server**
```js
expose(Person);
```

**Client**
```js
// joining people namespace
var socket = io('localhost:3000/states');
// only want to listen to a specific attribute event
socket.emit('child', 'cities.population');
// will only fire events within `states.cities.population`
socket.on('modified', function(doc) {});
```

### Additional Options

#### prep

Each document passes through `prep` before being sent to the client.

For example, if you wanted to remove `password` from any document before emitting, you could:

```js
var expose = socketsaurus(io, {
  oplogUrl: 'mongodb://<user>:<password>@candidate.35.mongolayer.com:10491,candidate.34.mongolayer.com:10493/local?authSource=oplog_test',
  db: 'dev',
  prep: function(doc) {
    doc = doc.toJSON();
    delete doc.password;
    return doc;
  }
});
```

#### auth

Each connection to a socket namespace passes through `auth` to verify it is authorized. The default `auth` just passes it through, regardless.

```js
var expose = socketsaurus(io, {
  oplogUrl: 'mongodb://<user>:<password>@candidate.35.mongolayer.com:10491,candidate.34.mongolayer.com:10493/local?authSource=oplog_test',
  db: 'dev',
  auth: checkAuth
});

function checkAuth(io) {
  io.use(function(socket, next) {
    var auth = socket.handshake.query.token;

    if (!token) {
      return next(new Error('invalid permissions'));
    }

    // further checks on token

    next();
  });

  return io;
};
```

#### namespace

If you want to customize the namespace labels, you can do so by overriding `namespace`. By default, all namespaces are the database collection names.

```js
var expose = socketsaurus(io, {
  oplogUrl: 'mongodb://<user>:<password>@candidate.35.mongolayer.com:10491,candidate.34.mongolayer.com:10493/local?authSource=oplog_test',
  db: 'dev',
  namespace: function(name) {
    // now events for the collection with name 'people' will be emitted under the namespace 'socketsaurus_people'
    return 'socketsaurus_' + name;
  }
});
```

## Lint

To lint the code, first `npm install` the dev dependencies, and then run `grunt lint`.
