'use strict';

const assert = require('liberica').assert;

const { filterMethodResult } = require('../../lib/utils');

describe('utils', function() {
  describe('filterMethodResult()', function() {
    it('transform null object to null', function() {
        const resp = filterMethodResult()(null);
        false && console.log(resp);
        assert.isNull(resp);
    });
    //
    it('transform null object to null with basepath', function() {
        const resp = filterMethodResult({ basepath: "body" })(null);
        false && console.log(resp);
        assert.isNull(resp);
    });
    //
    it('transform normal object (pick: ["id", "username", "email"])', function() {
      const transform1 = filterMethodResult({
        pick: [
          "username", "email", "id"
        ]
      });
      //
      const methodResult = {
        "_id": "1234567890",
        "username": "JohnDoe",
        "email": "john.doe@gmail.com",
      }
      const expected = {
        "username": "JohnDoe",
        "email": "john.doe@gmail.com"
      }
      //
      false && console.log(JSON.stringify(transform1(methodResult), null, 2));
      assert.deepEqual(transform1(methodResult), expected);
    });
    //
    it('transform normal object (basepath: "body.profile", clone: true, pick: ["id", "username", "email"])', function() {
      const transform1 = filterMethodResult({
        clone: true,
        basepath: "body.profile",
        pick: [
          "id", "username", "email",
        ]
      });
      const transform2 = filterMethodResult({
        clone: true,
        basepath: ["body", "profile"],
        pick: [
          "id", "username", "email",
        ]
      });
      //
      const methodResult = {
        "headers": {
          "X-Request-Id": "AAC41B45-63FE-4006-AED2-F5BE0823E491",
        },
        "body": {
          "profile": {
            "_id": "1234567890",
            "username": "JohnDoe",
            "email": "john.doe@gmail.com",
            "contract": {
              "_id": "1234567890",
              "premium": 10000000
            }
          }
        }
      }
      const expected = {
        "headers": {
          "X-Request-Id": "AAC41B45-63FE-4006-AED2-F5BE0823E491"
        },
        "body": {
          "profile": {
            "username": "JohnDoe",
            "email": "john.doe@gmail.com"
          }
        }
      };
      //
      // true && console.log(JSON.stringify(transform1(methodResult), null, 2));
      assert.deepEqual(transform1(methodResult), expected);
      assert.deepEqual(transform2(methodResult), expected);
    });
    //
    it('transform normal object (basepath: "body.profile", clone: true, omit: ["_id"])', function() {
      const transform1 = filterMethodResult({
        clone: true,
        basepath: "body.profile",
        omit: [
          "_id", "contract._id"
        ]
      });
      const transform2 = filterMethodResult({
        clone: true,
        omit: [
          "body.profile._id", "body.profile.contract._id",
        ]
      });
      //
      const methodResult = {
        "headers": {
          "X-Request-Id": "AAC41B45-63FE-4006-AED2-F5BE0823E491",
        },
        "body": {
          "profile": {
            "_id": "1234567890",
            "username": "JohnDoe",
            "email": "john.doe@gmail.com",
            "contract": {
              "_id": "1234567890",
              "premium": 10000000
            }
          }
        }
      }
      const expected = {
        "headers": {
          "X-Request-Id": "AAC41B45-63FE-4006-AED2-F5BE0823E491"
        },
        "body": {
          "profile": {
            "username": "JohnDoe",
            "email": "john.doe@gmail.com",
            "contract": {
              "premium": 10000000
            }
          }
        }
      };
      //
      // true && console.log(JSON.stringify(transform1(methodResult), null, 2));
      assert.deepEqual(transform1(methodResult), expected);
      assert.deepEqual(transform2(methodResult), expected);
    });
  });
});
