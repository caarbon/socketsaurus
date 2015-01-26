var slice = Array.prototype.slice;

/**
 * delicious curry - crates a new function, based on a target function,
 * that allows you to call it with fixed arguments
 *
 * @param  {Function} fn Base function we are currying
 * @return {Function}
 *
 * Example:
 * var curry = require('./curry');
 * function xyz(x, y, z) {}
 * var myCurry = curry(xyz, 'A'); // 'A' becomes a fixed first argument
 * myCurry('B', 'C'); // will pass 'A', 'B', 'C'
 */
module.exports = function(fn) {
  var args = slice.call(arguments, 1);

  if (typeof fn !== 'function') {
    throw new Error('Curry expects a function');
  }

  return function() {
    // keeping the 'this' of this function, which will be useful for prototype methods
    return fn.apply(this, args.concat(slice.call(arguments)));
  };
};
