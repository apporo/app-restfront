'use strict';

function Fibonacci (P) {
  let n = P && P.number && P.number >= 0 ? P.number : null;
  let c = 0;
  let f = 0;
  let f_1 = 0;
  let f_2 = 0;

  this.next = function() {
    if (c >= n) return false;
    if (++c < 2) {
      f = c;
    } else {
      f_2 = f_1; f_1 = f; f = f_1 + f_2;
    }
    return true;
  };

  this.result = function() {
    return { value: f, step: c, number: n };
  };

  this.finish = function() {
    while (this.next()) {}
    return this.result();
  };
};

module.exports = Fibonacci;
