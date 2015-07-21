var async = require('async');

var toString = Object.prototype.toString;

/**
 * Returns a Async.cargo queue
 *
 * This queue takes in emit tasks.
 * A normal task looks like:
 * {
 *   action: 'someaction',
 *   payload: someData
 * }
 *
 * You can pass multiple actions, if we should emit the same payload to multiple aliases
 * {
 *   action: ['actionOne', 'actionTwo'],
 *   payload: someData
 * }
 *
 * If something async needs to happen, pass a `worker` function, which should call its callback with the payload (omit root `payload` in this instance)
 * This will hold up the queue until the async worker has completed
 * {
 *   action: 'someaction',
 *   worker: function(callback) {
 *     callback(null, payload);
 *   }
 * }
 *
 * If you need to modify a payload before emitting it, add a key of `action` + 'Payload'
 *
 * {
 *   action: ['one', 'two'],
 *   onePayload: function(payload) {
 *     var newPayload = {};
 *     newPayload.abc = payload.abc;
 *     newPayload.xyz = 987;
 *     return newPayload;
 *   },
 *   payload: {
 *     abc: 123
 *   }
 * }
 *
 * ^ in this example we will emit 'one' with `{ abc: 123 }` and 'two' with `{ abc: 123, xyz: 987 }`
 *
 * To add a task, just call it with the object you want pushed
 * var queue = require('./queue')(socketioNamespace);
 * queue({ action: 'action', payload: payload });
 *
 * @param  {Object} namespace Socket.io namespace
 * @return {Object}           Queue
 */
module.exports = function(namespace) {
  var emitterQueue = async.cargo(function(tasks, callback) {
    var task = tasks[0];

    if (!task.action) {
      throw new Error('No task action given for emitter queue');
    }

    if (typeof task.worker !== 'function') {
      broadcast(namespace, task);
      return callback();
    }

    task.worker(function(err, payload) {
      if (err) {
        return callback(err);
      }

      task.payload = payload;
      broadcast(namespace, task);
      callback();
    });
  }, 1);

  return emitterQueue.push;
};

function broadcast(namespace, task, room) {
  var payload = task.payload;
  var nextRoom;
  var modifier;

  if (arguments.length > 2 && room === undefined) {
    return;
  }

  if (Array.isArray(task.action)) {
    for (var action, i = 0; i < task.action.length; i++) {
      action = task.action[i];
      modifier = task[ action + 'Payload' ];
      namespace
        .in(room ? room : '[root]')
        .emit(action, modifier ? modifier(payload) : payload);
    }
  } else {
    modifier = task[ task.action + 'Payload' ];
    namespace
      .in(room ? room : '[root]')
      .emit(task.action, modifier ? modifier(payload) : payload);
  }

  if (toString.call(payload) === '[object Object]') {
    if (!room && payload.id) {
      return broadcast(namespace, task, payload.id);
    }

    // beginning recursive walk of payload, to broadcast to specific rooms
    // e.g. if listening to 'location.lat' changes, this will bubble to 'location' then 'location.lat'
    for (var key in payload) {
      if (!payload.hasOwnProperty(key)) {
        continue;
      }

      if (toString.call(payload[key]) === '[object Object]' && payload[key].constructor !== Object) {
        continue;
      }

      task.payload = payload[key];
      nextRoom = room ? room + '.' + key : key;
      broadcast(namespace, task, nextRoom);

      if (key === 'id') {
        nextRoom = room ? room + '.' + payload.id : payload.id;
        broadcast(namespace, task, nextRoom);
      }
    }
  }
}
