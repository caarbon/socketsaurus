var Reactive = require('reactive-mongo');
var mongoose = require('mongoose');
var curry = require('./curry');
var getQueue = require('./queue');

var toString = Object.prototype.toString;
var defaultOptions = {};

/**
 * Optional method that all documents pass through before being sent to the client
 * @param  {Object} doc Moongoose document object
 * @return {Object}     Possibly modified version of document
 */
defaultOptions.prep = function(doc) {
  return doc;
};

/**
 * Optional method to use to auth connections
 * @param  {Object} namespace Socketio namespace
 * @return {Object}           Namespace
 */
defaultOptions.auth = function(nsp) {
  return nsp;
};

/**
 * Optional method to alter the namespace strings used
 * @param  {String} modelName Name of the Mongoose model
 * @return {String}           Namespace label to use
 */
defaultOptions.namespace = function(modelName) {
  return modelName;
};

/**
 * This func exposes the socket events for each collection
 * @param  {Object} io          Socketio instance
 * @param  {Object} Db          Oplog listener
 * @param  {Object} options     Variety of options to be used
 * @param  {Object} Collection  Mongoose model constructor (e.g. Users)
 */
function exhibitionist(io, Db, options, Collection) {
  if (!~socketsaurus.models.indexOf(Collection)) {
    socketsaurus.models.push(Collection);
  }

  var namespaceLabel = options.namespace(Collection.modelName);
  var namespace = options.auth(io.of(namespaceLabel));
  var prep = options.prep;
  var criteria;

  namespace.on('connection', function(socket) {
    var path = '';

    enterRoom(socket, path);

    socket.on('child', function(data) {
      path = path ? path + '.' + data : data;
      enterRoom(socket, path);
    });

    socket.on('root', function() {
      path = '';
      enterRoom(socket, path);
    });

    socket.on('conditionals', function(data) {
      criteria = criteria || {};

      if (toString.call(data) === '[object Object]') {
        require('picu').object.extend(criteria, data);
        return;
      }

      data = data.split(',');

      for (var i = 0, conditionals = {}; i < data.length; i++) {
        match = /(^\w+)([=><!]+)(.*)$/.exec(data[i].trim());

        if (!match) {
          continue;
        }

        (function(using) {
          conditionals[ match[1] ] = function(val) {
            switch (using.operator) {
              case '>':
                return val > using.str;
                break;

              case '<':
                return val < using.str;
                break;

              case '>=':
                return val >= using.str;
                break;

              case '<=':
                return val <= using.str;
                break;

              case '=':
              case '==':
                return val == using.str;
                break;

              case '===':
                return val === using.str;
                break;

              case '!=':
                return val != using.str;
                break;

              case '!==':
                return val !== using.str;
                break;
            }
          };
        }({
          operator: match[2],
          str: match[3]
        }));
      }

      require('picu').object.extend(criteria, conditionals);
    });

    socket.on('clear-conditionals', function() {
      criteria = null;
    });
  });

  var queue = getQueue(namespace);
  var ref = new Db(options.db + '.' + Collection.modelName);

  ref.on('insert', function(doc) {
    if (!compare(doc, criteria)) {
      return;
    }

    queue({
      action: 'created',
      payload: prep(doc)
    });
  });

  ref.on('update', function(doc, query) {
    if (!compare(doc, criteria)) {
      return;
    }

    queue({
      action: ['modified', 'modification'],
      worker: function(callback) {
        doc = doc.$set || doc;

        if (!query._id) {
          return callback(new Error('no _id found in oplog update operation'));
        }

        fetch(Collection, query._id, function(err, record) {
          if (err) {
            return callback(err);
          }

          callback(null, prep(record));
        });
      },
      modificationPayload: function(payload) {
        return {
          doc: prep(payload),
          mod: prep(doc)
        };
      }
    });
  });

  ref.on('delete', function(doc) {
    if (!compare(doc, criteria)) {
      return;
    }

    queue({
      action: 'removed',
      payload: prep(doc)
    });
  });

  return namespace;
}

/**
 * Utility func to have sockets enter a room (and leave all others)
 * @param  {Object} socket Socket
 * @param  {String} room   Room to join
 */
function enterRoom(socket, room) {
  room = room || '[root]';

  for (var key in socket.rooms) {
    socket.leave(socket.rooms[key]);
  }

  socket.join(room);
}

/**
 * Gets a single document, by id
 * @param  {Object}         Collection  The Mongoose collection instance
 * @param  {String}         id          Document id
 * @param  {Function}       callback    Callback func
 */
function fetch(Collection, id, callback) {
  try {
    id = mongoose.Types.ObjectId('' + id);
  } catch(err) {
    return callback(new Error('record not found'));
  }

  Collection.findById(id, null, callback);
}

/**
 * Compares an input object with a criteria object - returns true if input passes criteria
 * @param  {Object} input    Input object to check
 * @param  {Object} criteria Criteria to check with (deeply)
 */
function compare(input, criteria) {
  if (!criteria) {
    return true;
  }

  for (var key in criteria) {
    if (typeof criteria[key] === 'function') {
      if (!criteria[key](input && input[key])) {
        return false;
      }
    } else if (toString.call(criteria[key]) === '[object Object]') {
      if (!compare(input && input[key], criteria[key])) {
        return false;
      }
    } else {
      if (input[key] !== criteria[key]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Socketsaurus exhibitionist factory
 * @param  {Object}   io      Socketio
 * @param  {Object}   options Options to use
 * @return {Function}         Curry'd exhibitionist (that only needs a mongoose model)
 */
function socketsaurus(io, options) {
  options = options || {};

  for (var key in defaultOptions) {
    options[key] = options[key] || defaultOptions[key];
  }

  if (!options.oplogUrl) {
    throw new Error('Expecting options.oplogUrl');
  }

  if (!options.db) {
    throw new Error('Expecting options.db');
  }

  return curry(exhibitionist, io, new Reactive(options.oplogUrl), options);
}
socketsaurus.models = [];

module.exports = socketsaurus;
