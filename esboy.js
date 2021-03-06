(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":1,"ieee754":4,"isarray":5}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BrowserStorage = function () {

  /**
   * @param {Object} localStorage implementing getItem, setItem
   */
  function BrowserStorage(localStorage) {
    _classCallCheck(this, BrowserStorage);

    if (localStorage == null) throw new Error('Missing localStorage');

    if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') throw new Error('localStorage must implement getItem(key), setItem(key, value)');

    this._localStorage = localStorage;
  }

  /**
   * @param {number} expectedSize
   */


  _createClass(BrowserStorage, [{
    key: 'setExpectedGameSize',
    value: function setExpectedGameSize(expectedSize) {
      this._expectedSize = expectedSize;
    }

    /**
     * @param gameTitle
     * @returns {Uint8Array} saved game
     */

  }, {
    key: 'read',
    value: function read(gameTitle) {
      var stringyfiedMemory = this._localStorage.getItem(gameTitle);

      if (stringyfiedMemory == null || stringyfiedMemory.length == null) return null;

      var array = stringyfiedMemory.split(',');

      if (array.length !== this._expectedSize) return null;

      return new Uint8Array(array);
    }

    /**
     * @param {string} gameTitle
     * @param {Uint8Array} memory
     */

  }, {
    key: 'write',
    value: function write(gameTitle, memory) {
      this._localStorage.setItem(gameTitle, memory);
    }
  }]);

  return BrowserStorage;
}();

exports.default = BrowserStorage;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var config = {
  DEBUG: false,
  TEST: false
};

exports.default = config;

},{}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CPU = function () {

  /**
   * @param {MMU|MMUMock} mmu
   * @param {LCD|LCDMock} lcd
   */
  function CPU(mmu, lcd) {
    _classCallCheck(this, CPU);

    if (mmu == null) throw new Error('Missing mmu');
    if (lcd == null) throw new Error('Missing lcd');

    // Constants
    this.EXTENDED_PREFIX = 0xcb;
    this.ADDR_VBLANK_INTERRUPT = 0x40;
    this.ADDR_STAT_INTERRUPT = 0x48;
    this.ADDR_TIMER_INTERRUPT = 0x50;
    this.ADDR_SERIAL_INTERRUPT = 0x58;
    this.ADDR_P10P13_INTERRUPT = 0x60;

    this.M_CYCLES_PER_LINE = 114;
    this.M_CYCLES_STOP_MODE_0 = 4;
    this.M_CYCLES_STOP_MODE_2 = 20;
    this.M_CYCLES_STOP_MODE_3 = 22; // Naive
    this.M_CYCLES_DMA = 40;

    // Masks
    this.IF_VBLANK_ON = 1;
    this.IF_VBLANK_OFF = 30;

    this._attach_bit_functions();
    this._INSTRUCTIONS = {
      0x00: { fn: this._nop, paramBytes: 0 },
      0x01: { fn: this.ld_bc_nn, paramBytes: 2 },
      0x02: { fn: this.ld_0xbc_a, paramBytes: 0 },
      0x03: { fn: this.inc_bc, paramBytes: 0 },
      0x04: { fn: this.inc_b, paramBytes: 0 },
      0x05: { fn: this.dec_b, paramBytes: 0 },
      0x06: { fn: this.ld_b_n, paramBytes: 1 },
      0x07: { fn: this.rlca, paramBytes: 0 },
      0x08: { fn: this.ld_nn_sp, paramBytes: 2 },
      0x09: { fn: this.add_hl_bc, paramBytes: 0 },
      0x0a: { fn: this.ld_a_0xbc, paramBytes: 0 },
      0x0b: { fn: this.dec_bc, paramBytes: 0 },
      0x0c: { fn: this.inc_c, paramBytes: 0 },
      0x0d: { fn: this.dec_c, paramBytes: 0 },
      0x0e: { fn: this.ld_c_n, paramBytes: 1 },
      0x0f: { fn: this.rrca, paramBytes: 0 },
      0x10: { fn: this._stop, paramBytes: 1 },
      0x11: { fn: this.ld_de_nn, paramBytes: 2 },
      0x12: { fn: this.ld_0xde_a, paramBytes: 0 },
      0x13: { fn: this.inc_de, paramBytes: 0 },
      0x14: { fn: this.inc_d, paramBytes: 0 },
      0x15: { fn: this.dec_d, paramBytes: 0 },
      0x16: { fn: this.ld_d_n, paramBytes: 1 },
      0x17: { fn: this.rla, paramBytes: 0 },
      0x18: { fn: this._jr_e, paramBytes: 1 },
      0x19: { fn: this.add_hl_de, paramBytes: 0 },
      0x1a: { fn: this.ld_a_0xde, paramBytes: 0 },
      0x1b: { fn: this.dec_de, paramBytes: 0 },
      0x1c: { fn: this.inc_e, paramBytes: 0 },
      0x1d: { fn: this.dec_e, paramBytes: 0 },
      0x1e: { fn: this.ld_e_n, paramBytes: 1 },
      0x1f: { fn: this.rra, paramBytes: 0 },
      0x20: { fn: this._jr_nz_n, paramBytes: 1 },
      0x21: { fn: this.ld_hl_nn, paramBytes: 2 },
      0x22: { fn: this.ldi_0xhl_a, paramBytes: 0 },
      0x23: { fn: this.inc_hl, paramBytes: 0 },
      0x24: { fn: this.inc_h, paramBytes: 0 },
      0x25: { fn: this.dec_h, paramBytes: 0 },
      0x26: { fn: this.ld_h_n, paramBytes: 1 },
      0x27: { fn: this._daa, paramBytes: 0 },
      0x28: { fn: this._jr_z_n, paramBytes: 1 },
      0x29: { fn: this.add_hl_hl, paramBytes: 0 },
      0x2a: { fn: this.ldi_a_0xhl, paramBytes: 0 },
      0x2b: { fn: this.dec_hl, paramBytes: 0 },
      0x2c: { fn: this.inc_l, paramBytes: 0 },
      0x2d: { fn: this.dec_l, paramBytes: 0 },
      0x2e: { fn: this.ld_l_n, paramBytes: 1 },
      0x2f: { fn: this.cpl, paramBytes: 0 },
      0x30: { fn: this._jr_nc_n, paramBytes: 1 },
      0x31: { fn: this.ld_sp_nn, paramBytes: 2 },
      0x32: { fn: this.ldd_0xhl_a, paramBytes: 0 },
      0x33: { fn: this.inc_sp, paramBytes: 0 },
      0x34: { fn: this._inc_0xhl, paramBytes: 0 },
      0x35: { fn: this.dec_0xhl, paramBytes: 0 },
      0x36: { fn: this.ld_0xhl_n, paramBytes: 1 },
      0x37: { fn: this._scf, paramBytes: 0 },
      0x38: { fn: this._jr_c_n, paramBytes: 1 },
      0x39: { fn: this.add_hl_sp, paramBytes: 0 },
      0x3a: { fn: this.ldd_a_0xhl, paramBytes: 0 },
      0x3b: { fn: this.dec_sp, paramBytes: 0 },
      0x3c: { fn: this.inc_a, paramBytes: 0 },
      0x3d: { fn: this.dec_a, paramBytes: 0 },
      0x3e: { fn: this.ld_a_n, paramBytes: 1 },
      0x3f: { fn: this._ccf, paramBytes: 0 },
      0x40: { fn: this.ld_b_b, paramBytes: 0 },
      0x41: { fn: this.ld_b_c, paramBytes: 0 },
      0x42: { fn: this.ld_b_d, paramBytes: 0 },
      0x43: { fn: this.ld_b_e, paramBytes: 0 },
      0x44: { fn: this.ld_b_h, paramBytes: 0 },
      0x45: { fn: this.ld_b_l, paramBytes: 0 },
      0x46: { fn: this.ld_b_0xhl, paramBytes: 0 },
      0x47: { fn: this.ld_b_a, paramBytes: 0 },
      0x48: { fn: this.ld_c_b, paramBytes: 0 },
      0x49: { fn: this.ld_c_c, paramBytes: 0 },
      0x4a: { fn: this.ld_c_d, paramBytes: 0 },
      0x4b: { fn: this.ld_c_e, paramBytes: 0 },
      0x4c: { fn: this.ld_c_h, paramBytes: 0 },
      0x4d: { fn: this.ld_c_l, paramBytes: 0 },
      0x4e: { fn: this.ld_c_0xhl, paramBytes: 0 },
      0x4f: { fn: this.ld_c_a, paramBytes: 0 },
      0x50: { fn: this.ld_d_b, paramBytes: 0 },
      0x51: { fn: this.ld_d_c, paramBytes: 0 },
      0x52: { fn: this.ld_d_d, paramBytes: 0 },
      0x53: { fn: this.ld_d_e, paramBytes: 0 },
      0x54: { fn: this.ld_d_h, paramBytes: 0 },
      0x55: { fn: this.ld_d_l, paramBytes: 0 },
      0x56: { fn: this.ld_d_0xhl, paramBytes: 0 },
      0x57: { fn: this.ld_d_a, paramBytes: 0 },
      0x58: { fn: this.ld_e_b, paramBytes: 0 },
      0x59: { fn: this.ld_e_c, paramBytes: 0 },
      0x5a: { fn: this.ld_e_d, paramBytes: 0 },
      0x5b: { fn: this.ld_e_e, paramBytes: 0 },
      0x5c: { fn: this.ld_e_h, paramBytes: 0 },
      0x5d: { fn: this.ld_e_l, paramBytes: 0 },
      0x5e: { fn: this.ld_e_0xhl, paramBytes: 0 },
      0x5f: { fn: this.ld_e_a, paramBytes: 0 },
      0x60: { fn: this.ld_h_b, paramBytes: 0 },
      0x61: { fn: this.ld_h_c, paramBytes: 0 },
      0x62: { fn: this.ld_h_d, paramBytes: 0 },
      0x63: { fn: this.ld_h_e, paramBytes: 0 },
      0x64: { fn: this.ld_h_h, paramBytes: 0 },
      0x65: { fn: this.ld_h_l, paramBytes: 0 },
      0x66: { fn: this.ld_h_0xhl, paramBytes: 0 },
      0x67: { fn: this.ld_h_a, paramBytes: 0 },
      0x68: { fn: this.ld_l_b, paramBytes: 0 },
      0x69: { fn: this.ld_l_c, paramBytes: 0 },
      0x6a: { fn: this.ld_l_d, paramBytes: 0 },
      0x6b: { fn: this.ld_l_e, paramBytes: 0 },
      0x6c: { fn: this.ld_l_h, paramBytes: 0 },
      0x6d: { fn: this.ld_l_l, paramBytes: 0 },
      0x6e: { fn: this.ld_l_0xhl, paramBytes: 0 },
      0x6f: { fn: this.ld_l_a, paramBytes: 0 },
      0x70: { fn: this.ld_0xhl_b, paramBytes: 0 },
      0x71: { fn: this.ld_0xhl_c, paramBytes: 0 },
      0x72: { fn: this.ld_0xhl_d, paramBytes: 0 },
      0x73: { fn: this.ld_0xhl_e, paramBytes: 0 },
      0x74: { fn: this.ld_0xhl_h, paramBytes: 0 },
      0x75: { fn: this.ld_0xhl_l, paramBytes: 0 },
      0x76: { fn: this.halt, paramBytes: 0 },
      0x77: { fn: this.ld_0xhl_a, paramBytes: 0 },
      0x78: { fn: this.ld_a_b, paramBytes: 0 },
      0x79: { fn: this.ld_a_c, paramBytes: 0 },
      0x7a: { fn: this.ld_a_d, paramBytes: 0 },
      0x7b: { fn: this.ld_a_e, paramBytes: 0 },
      0x7c: { fn: this.ld_a_h, paramBytes: 0 },
      0x7d: { fn: this.ld_a_l, paramBytes: 0 },
      0x7e: { fn: this.ld_a_0xhl, paramBytes: 0 },
      0x7f: { fn: this.ld_a_a, paramBytes: 0 },
      0x80: { fn: this.add_b, paramBytes: 0 },
      0x81: { fn: this.add_c, paramBytes: 0 },
      0x82: { fn: this.add_d, paramBytes: 0 },
      0x83: { fn: this.add_e, paramBytes: 0 },
      0x84: { fn: this.add_h, paramBytes: 0 },
      0x85: { fn: this.add_l, paramBytes: 0 },
      0x86: { fn: this.add_0xhl, paramBytes: 0 },
      0x87: { fn: this.add_a, paramBytes: 0 },
      0x88: { fn: this.adc_b, paramBytes: 0 },
      0x89: { fn: this.adc_c, paramBytes: 0 },
      0x8a: { fn: this.adc_d, paramBytes: 0 },
      0x8b: { fn: this.adc_e, paramBytes: 0 },
      0x8c: { fn: this.adc_h, paramBytes: 0 },
      0x8d: { fn: this.adc_l, paramBytes: 0 },
      0x8e: { fn: this.adc_0xhl, paramBytes: 0 },
      0x8f: { fn: this.adc_a, paramBytes: 0 },
      0x90: { fn: this.sub_b, paramBytes: 0 },
      0x91: { fn: this.sub_c, paramBytes: 0 },
      0x92: { fn: this.sub_d, paramBytes: 0 },
      0x93: { fn: this.sub_e, paramBytes: 0 },
      0x94: { fn: this.sub_h, paramBytes: 0 },
      0x95: { fn: this.sub_l, paramBytes: 0 },
      0x96: { fn: this.sub_0xhl, paramBytes: 0 },
      0x97: { fn: this.sub_a, paramBytes: 0 },
      0x98: { fn: this.sbc_b, paramBytes: 0 },
      0x99: { fn: this.sbc_c, paramBytes: 0 },
      0x9a: { fn: this.sbc_d, paramBytes: 0 },
      0x9b: { fn: this.sbc_e, paramBytes: 0 },
      0x9c: { fn: this.sbc_h, paramBytes: 0 },
      0x9d: { fn: this.sbc_l, paramBytes: 0 },
      0x9e: { fn: this.sbc_0xhl, paramBytes: 0 },
      0x9f: { fn: this.sbc_a, paramBytes: 0 },
      0xa0: { fn: this._and_b, paramBytes: 0 },
      0xa1: { fn: this._and_c, paramBytes: 0 },
      0xa2: { fn: this._and_d, paramBytes: 0 },
      0xa3: { fn: this._and_e, paramBytes: 0 },
      0xa4: { fn: this._and_h, paramBytes: 0 },
      0xa5: { fn: this._and_l, paramBytes: 0 },
      0xa6: { fn: this._and_0xhl, paramBytes: 0 },
      0xa7: { fn: this._and_a, paramBytes: 0 },
      0xa8: { fn: this.xor_b, paramBytes: 0 },
      0xa9: { fn: this.xor_c, paramBytes: 0 },
      0xaa: { fn: this.xor_d, paramBytes: 0 },
      0xab: { fn: this.xor_e, paramBytes: 0 },
      0xac: { fn: this.xor_h, paramBytes: 0 },
      0xad: { fn: this.xor_l, paramBytes: 0 },
      0xae: { fn: this.xor_0xhl, paramBytes: 0 },
      0xaf: { fn: this.xor_a, paramBytes: 0 },
      0xb0: { fn: this.or_b, paramBytes: 0 },
      0xb1: { fn: this.or_c, paramBytes: 0 },
      0xb2: { fn: this.or_d, paramBytes: 0 },
      0xb3: { fn: this.or_e, paramBytes: 0 },
      0xb4: { fn: this.or_h, paramBytes: 0 },
      0xb5: { fn: this.or_l, paramBytes: 0 },
      0xb6: { fn: this.or_0xhl, paramBytes: 0 },
      0xb7: { fn: this.or_a, paramBytes: 0 },
      0xb8: { fn: this.cp_b, paramBytes: 0 },
      0xb9: { fn: this.cp_c, paramBytes: 0 },
      0xba: { fn: this.cp_d, paramBytes: 0 },
      0xbb: { fn: this.cp_e, paramBytes: 0 },
      0xbc: { fn: this.cp_h, paramBytes: 0 },
      0xbd: { fn: this.cp_l, paramBytes: 0 },
      0xbe: { fn: this.cp_0xhl, paramBytes: 0 },
      0xbf: { fn: this.cp_a, paramBytes: 0 },
      0xc0: { fn: this.ret_nz, paramBytes: 0 },
      0xc1: { fn: this.pop_bc, paramBytes: 0 },
      0xc2: { fn: this._jp_nz_nn, paramBytes: 2 },
      0xc3: { fn: this._jp, paramBytes: 2 },
      0xc4: { fn: this.call_nz, paramBytes: 2 },
      0xc5: { fn: this.push_bc, paramBytes: 0 },
      0xc6: { fn: this.add_n, paramBytes: 1 },
      0xc7: { fn: this.rst_00, paramBytes: 0 },
      0xc8: { fn: this.ret_z, paramBytes: 0 },
      0xc9: { fn: this.ret, paramBytes: 0 },
      0xca: { fn: this._jp_z_nn, paramBytes: 2 },
      0xcb00: { fn: this.rlc_b, paramBytes: 0 },
      0xcb01: { fn: this.rlc_c, paramBytes: 0 },
      0xcb02: { fn: this.rlc_d, paramBytes: 0 },
      0xcb03: { fn: this.rlc_e, paramBytes: 0 },
      0xcb04: { fn: this.rlc_h, paramBytes: 0 },
      0xcb05: { fn: this.rlc_l, paramBytes: 0 },
      0xcb06: { fn: this.rlc_0xhl, paramBytes: 0 },
      0xcb07: { fn: this.rlc_a, paramBytes: 0 },
      0xcb08: { fn: this.rrc_b, paramBytes: 0 },
      0xcb09: { fn: this.rrc_c, paramBytes: 0 },
      0xcb0a: { fn: this.rrc_d, paramBytes: 0 },
      0xcb0b: { fn: this.rrc_e, paramBytes: 0 },
      0xcb0c: { fn: this.rrc_h, paramBytes: 0 },
      0xcb0d: { fn: this.rrc_l, paramBytes: 0 },
      0xcb0e: { fn: this.rrc_0xhl, paramBytes: 0 },
      0xcb0f: { fn: this.rrc_a, paramBytes: 0 },
      0xcb10: { fn: this.rl_b, paramBytes: 0 },
      0xcb11: { fn: this.rl_c, paramBytes: 0 },
      0xcb12: { fn: this.rl_d, paramBytes: 0 },
      0xcb13: { fn: this.rl_e, paramBytes: 0 },
      0xcb14: { fn: this.rl_h, paramBytes: 0 },
      0xcb15: { fn: this.rl_l, paramBytes: 0 },
      0xcb16: { fn: this.rl_0xhl, paramBytes: 0 },
      0xcb17: { fn: this.rl_a, paramBytes: 0 },
      0xcb18: { fn: this.rr_b, paramBytes: 0 },
      0xcb19: { fn: this.rr_c, paramBytes: 0 },
      0xcb1a: { fn: this.rr_d, paramBytes: 0 },
      0xcb1b: { fn: this.rr_e, paramBytes: 0 },
      0xcb1c: { fn: this.rr_h, paramBytes: 0 },
      0xcb1d: { fn: this.rr_l, paramBytes: 0 },
      0xcb1e: { fn: this.rr_0xhl, paramBytes: 0 },
      0xcb1f: { fn: this.rr_a, paramBytes: 0 },
      0xcb20: { fn: this.sla_b, paramBytes: 0 },
      0xcb21: { fn: this.sla_c, paramBytes: 0 },
      0xcb22: { fn: this.sla_d, paramBytes: 0 },
      0xcb23: { fn: this.sla_e, paramBytes: 0 },
      0xcb24: { fn: this.sla_h, paramBytes: 0 },
      0xcb25: { fn: this.sla_l, paramBytes: 0 },
      0xcb26: { fn: this.sla_0xhl, paramBytes: 0 },
      0xcb27: { fn: this.sla_a, paramBytes: 0 },
      0xcb28: { fn: this.sra_b, paramBytes: 0 },
      0xcb29: { fn: this.sra_c, paramBytes: 0 },
      0xcb2a: { fn: this.sra_d, paramBytes: 0 },
      0xcb2b: { fn: this.sra_e, paramBytes: 0 },
      0xcb2c: { fn: this.sra_h, paramBytes: 0 },
      0xcb2d: { fn: this.sra_l, paramBytes: 0 },
      0xcb2e: { fn: this.sra_0xhl, paramBytes: 0 },
      0xcb2f: { fn: this.sra_a, paramBytes: 0 },
      0xcb30: { fn: this.swap_b, paramBytes: 0 },
      0xcb31: { fn: this.swap_c, paramBytes: 0 },
      0xcb32: { fn: this.swap_d, paramBytes: 0 },
      0xcb33: { fn: this.swap_e, paramBytes: 0 },
      0xcb34: { fn: this.swap_h, paramBytes: 0 },
      0xcb35: { fn: this.swap_l, paramBytes: 0 },
      0xcb36: { fn: this.swap_0xhl, paramBytes: 0 },
      0xcb37: { fn: this.swap_a, paramBytes: 0 },
      0xcb38: { fn: this.srl_b, paramBytes: 0 },
      0xcb39: { fn: this.srl_c, paramBytes: 0 },
      0xcb3a: { fn: this.srl_d, paramBytes: 0 },
      0xcb3b: { fn: this.srl_e, paramBytes: 0 },
      0xcb3c: { fn: this.srl_h, paramBytes: 0 },
      0xcb3d: { fn: this.srl_l, paramBytes: 0 },
      0xcb3e: { fn: this.srl_0xhl, paramBytes: 0 },
      0xcb3f: { fn: this.srl_a, paramBytes: 0 },
      0xcb40: { fn: this.bit_0_b, paramBytes: 0 },
      0xcb41: { fn: this.bit_0_c, paramBytes: 0 },
      0xcb42: { fn: this.bit_0_d, paramBytes: 0 },
      0xcb43: { fn: this.bit_0_e, paramBytes: 0 },
      0xcb44: { fn: this.bit_0_h, paramBytes: 0 },
      0xcb45: { fn: this.bit_0_l, paramBytes: 0 },
      0xcb46: { fn: this.bit_0_0xhl, paramBytes: 0 },
      0xcb47: { fn: this.bit_0_a, paramBytes: 0 },
      0xcb48: { fn: this.bit_1_b, paramBytes: 0 },
      0xcb49: { fn: this.bit_1_c, paramBytes: 0 },
      0xcb4a: { fn: this.bit_1_d, paramBytes: 0 },
      0xcb4b: { fn: this.bit_1_e, paramBytes: 0 },
      0xcb4c: { fn: this.bit_1_h, paramBytes: 0 },
      0xcb4d: { fn: this.bit_1_l, paramBytes: 0 },
      0xcb4e: { fn: this.bit_1_0xhl, paramBytes: 0 },
      0xcb4f: { fn: this.bit_1_a, paramBytes: 0 },
      0xcb50: { fn: this.bit_2_b, paramBytes: 0 },
      0xcb51: { fn: this.bit_2_c, paramBytes: 0 },
      0xcb52: { fn: this.bit_2_d, paramBytes: 0 },
      0xcb53: { fn: this.bit_2_e, paramBytes: 0 },
      0xcb54: { fn: this.bit_2_h, paramBytes: 0 },
      0xcb55: { fn: this.bit_2_l, paramBytes: 0 },
      0xcb56: { fn: this.bit_2_0xhl, paramBytes: 0 },
      0xcb57: { fn: this.bit_2_a, paramBytes: 0 },
      0xcb58: { fn: this.bit_3_b, paramBytes: 0 },
      0xcb59: { fn: this.bit_3_c, paramBytes: 0 },
      0xcb5a: { fn: this.bit_3_d, paramBytes: 0 },
      0xcb5b: { fn: this.bit_3_e, paramBytes: 0 },
      0xcb5c: { fn: this.bit_3_h, paramBytes: 0 },
      0xcb5d: { fn: this.bit_3_l, paramBytes: 0 },
      0xcb5e: { fn: this.bit_3_0xhl, paramBytes: 0 },
      0xcb5f: { fn: this.bit_3_a, paramBytes: 0 },
      0xcb60: { fn: this.bit_4_b, paramBytes: 0 },
      0xcb61: { fn: this.bit_4_c, paramBytes: 0 },
      0xcb62: { fn: this.bit_4_d, paramBytes: 0 },
      0xcb63: { fn: this.bit_4_e, paramBytes: 0 },
      0xcb64: { fn: this.bit_4_h, paramBytes: 0 },
      0xcb65: { fn: this.bit_4_l, paramBytes: 0 },
      0xcb66: { fn: this.bit_4_0xhl, paramBytes: 0 },
      0xcb67: { fn: this.bit_4_a, paramBytes: 0 },
      0xcb68: { fn: this.bit_5_b, paramBytes: 0 },
      0xcb69: { fn: this.bit_5_c, paramBytes: 0 },
      0xcb6a: { fn: this.bit_5_d, paramBytes: 0 },
      0xcb6b: { fn: this.bit_5_e, paramBytes: 0 },
      0xcb6c: { fn: this.bit_5_h, paramBytes: 0 },
      0xcb6d: { fn: this.bit_5_l, paramBytes: 0 },
      0xcb6e: { fn: this.bit_5_0xhl, paramBytes: 0 },
      0xcb6f: { fn: this.bit_5_a, paramBytes: 0 },
      0xcb70: { fn: this.bit_6_b, paramBytes: 0 },
      0xcb71: { fn: this.bit_6_c, paramBytes: 0 },
      0xcb72: { fn: this.bit_6_d, paramBytes: 0 },
      0xcb73: { fn: this.bit_6_e, paramBytes: 0 },
      0xcb74: { fn: this.bit_6_h, paramBytes: 0 },
      0xcb75: { fn: this.bit_6_l, paramBytes: 0 },
      0xcb76: { fn: this.bit_6_0xhl, paramBytes: 0 },
      0xcb77: { fn: this.bit_6_a, paramBytes: 0 },
      0xcb78: { fn: this.bit_7_b, paramBytes: 0 },
      0xcb79: { fn: this.bit_7_c, paramBytes: 0 },
      0xcb7a: { fn: this.bit_7_d, paramBytes: 0 },
      0xcb7b: { fn: this.bit_7_e, paramBytes: 0 },
      0xcb7c: { fn: this.bit_7_h, paramBytes: 0 },
      0xcb7d: { fn: this.bit_7_l, paramBytes: 0 },
      0xcb7e: { fn: this.bit_7_0xhl, paramBytes: 0 },
      0xcb7f: { fn: this.bit_7_a, paramBytes: 0 },
      0xcb80: { fn: this.res_0_b, paramBytes: 0 },
      0xcb81: { fn: this.res_0_c, paramBytes: 0 },
      0xcb82: { fn: this.res_0_d, paramBytes: 0 },
      0xcb83: { fn: this.res_0_e, paramBytes: 0 },
      0xcb84: { fn: this.res_0_h, paramBytes: 0 },
      0xcb85: { fn: this.res_0_l, paramBytes: 0 },
      0xcb86: { fn: this.res_0_0xhl, paramBytes: 0 },
      0xcb87: { fn: this.res_0_a, paramBytes: 0 },
      0xcb88: { fn: this.res_1_b, paramBytes: 0 },
      0xcb89: { fn: this.res_1_c, paramBytes: 0 },
      0xcb8a: { fn: this.res_1_d, paramBytes: 0 },
      0xcb8b: { fn: this.res_1_e, paramBytes: 0 },
      0xcb8c: { fn: this.res_1_h, paramBytes: 0 },
      0xcb8d: { fn: this.res_1_l, paramBytes: 0 },
      0xcb8e: { fn: this.res_1_0xhl, paramBytes: 0 },
      0xcb8f: { fn: this.res_1_a, paramBytes: 0 },
      0xcb90: { fn: this.res_2_b, paramBytes: 0 },
      0xcb91: { fn: this.res_2_c, paramBytes: 0 },
      0xcb92: { fn: this.res_2_d, paramBytes: 0 },
      0xcb93: { fn: this.res_2_e, paramBytes: 0 },
      0xcb94: { fn: this.res_2_h, paramBytes: 0 },
      0xcb95: { fn: this.res_2_l, paramBytes: 0 },
      0xcb96: { fn: this.res_2_0xhl, paramBytes: 0 },
      0xcb97: { fn: this.res_2_a, paramBytes: 0 },
      0xcb98: { fn: this.res_3_b, paramBytes: 0 },
      0xcb99: { fn: this.res_3_c, paramBytes: 0 },
      0xcb9a: { fn: this.res_3_d, paramBytes: 0 },
      0xcb9b: { fn: this.res_3_e, paramBytes: 0 },
      0xcb9c: { fn: this.res_3_h, paramBytes: 0 },
      0xcb9d: { fn: this.res_3_l, paramBytes: 0 },
      0xcb9e: { fn: this.res_3_0xhl, paramBytes: 0 },
      0xcb9f: { fn: this.res_3_a, paramBytes: 0 },
      0xcba0: { fn: this.res_4_b, paramBytes: 0 },
      0xcba1: { fn: this.res_4_c, paramBytes: 0 },
      0xcba2: { fn: this.res_4_d, paramBytes: 0 },
      0xcba3: { fn: this.res_4_e, paramBytes: 0 },
      0xcba4: { fn: this.res_4_h, paramBytes: 0 },
      0xcba5: { fn: this.res_4_l, paramBytes: 0 },
      0xcba6: { fn: this.res_4_0xhl, paramBytes: 0 },
      0xcba7: { fn: this.res_4_a, paramBytes: 0 },
      0xcba8: { fn: this.res_5_b, paramBytes: 0 },
      0xcba9: { fn: this.res_5_c, paramBytes: 0 },
      0xcbaa: { fn: this.res_5_d, paramBytes: 0 },
      0xcbab: { fn: this.res_5_e, paramBytes: 0 },
      0xcbac: { fn: this.res_5_h, paramBytes: 0 },
      0xcbad: { fn: this.res_5_l, paramBytes: 0 },
      0xcbae: { fn: this.res_5_0xhl, paramBytes: 0 },
      0xcbaf: { fn: this.res_5_a, paramBytes: 0 },
      0xcbb0: { fn: this.res_6_b, paramBytes: 0 },
      0xcbb1: { fn: this.res_6_c, paramBytes: 0 },
      0xcbb2: { fn: this.res_6_d, paramBytes: 0 },
      0xcbb3: { fn: this.res_6_e, paramBytes: 0 },
      0xcbb4: { fn: this.res_6_h, paramBytes: 0 },
      0xcbb5: { fn: this.res_6_l, paramBytes: 0 },
      0xcbb6: { fn: this.res_6_0xhl, paramBytes: 0 },
      0xcbb7: { fn: this.res_6_a, paramBytes: 0 },
      0xcbb8: { fn: this.res_7_b, paramBytes: 0 },
      0xcbb9: { fn: this.res_7_c, paramBytes: 0 },
      0xcbba: { fn: this.res_7_d, paramBytes: 0 },
      0xcbbb: { fn: this.res_7_e, paramBytes: 0 },
      0xcbbc: { fn: this.res_7_h, paramBytes: 0 },
      0xcbbd: { fn: this.res_7_l, paramBytes: 0 },
      0xcbbe: { fn: this.res_7_0xhl, paramBytes: 0 },
      0xcbbf: { fn: this.res_7_a, paramBytes: 0 },
      0xcbc0: { fn: this.set_0_b, paramBytes: 0 },
      0xcbc1: { fn: this.set_0_c, paramBytes: 0 },
      0xcbc2: { fn: this.set_0_d, paramBytes: 0 },
      0xcbc3: { fn: this.set_0_e, paramBytes: 0 },
      0xcbc4: { fn: this.set_0_h, paramBytes: 0 },
      0xcbc5: { fn: this.set_0_l, paramBytes: 0 },
      0xcbc6: { fn: this.set_0_0xhl, paramBytes: 0 },
      0xcbc7: { fn: this.set_0_a, paramBytes: 0 },
      0xcbc8: { fn: this.set_1_b, paramBytes: 0 },
      0xcbc9: { fn: this.set_1_c, paramBytes: 0 },
      0xcbca: { fn: this.set_1_d, paramBytes: 0 },
      0xcbcb: { fn: this.set_1_e, paramBytes: 0 },
      0xcbcc: { fn: this.set_1_h, paramBytes: 0 },
      0xcbcd: { fn: this.set_1_l, paramBytes: 0 },
      0xcbce: { fn: this.set_1_0xhl, paramBytes: 0 },
      0xcbcf: { fn: this.set_1_a, paramBytes: 0 },
      0xcbd0: { fn: this.set_2_b, paramBytes: 0 },
      0xcbd1: { fn: this.set_2_c, paramBytes: 0 },
      0xcbd2: { fn: this.set_2_d, paramBytes: 0 },
      0xcbd3: { fn: this.set_2_e, paramBytes: 0 },
      0xcbd4: { fn: this.set_2_h, paramBytes: 0 },
      0xcbd5: { fn: this.set_2_l, paramBytes: 0 },
      0xcbd6: { fn: this.set_2_0xhl, paramBytes: 0 },
      0xcbd7: { fn: this.set_2_a, paramBytes: 0 },
      0xcbd8: { fn: this.set_3_b, paramBytes: 0 },
      0xcbd9: { fn: this.set_3_c, paramBytes: 0 },
      0xcbda: { fn: this.set_3_d, paramBytes: 0 },
      0xcbdb: { fn: this.set_3_e, paramBytes: 0 },
      0xcbdc: { fn: this.set_3_h, paramBytes: 0 },
      0xcbdd: { fn: this.set_3_l, paramBytes: 0 },
      0xcbde: { fn: this.set_3_0xhl, paramBytes: 0 },
      0xcbdf: { fn: this.set_3_a, paramBytes: 0 },
      0xcbe0: { fn: this.set_4_b, paramBytes: 0 },
      0xcbe1: { fn: this.set_4_c, paramBytes: 0 },
      0xcbe2: { fn: this.set_4_d, paramBytes: 0 },
      0xcbe3: { fn: this.set_4_e, paramBytes: 0 },
      0xcbe4: { fn: this.set_4_h, paramBytes: 0 },
      0xcbe5: { fn: this.set_4_l, paramBytes: 0 },
      0xcbe6: { fn: this.set_4_0xhl, paramBytes: 0 },
      0xcbe7: { fn: this.set_4_a, paramBytes: 0 },
      0xcbe8: { fn: this.set_5_b, paramBytes: 0 },
      0xcbe9: { fn: this.set_5_c, paramBytes: 0 },
      0xcbea: { fn: this.set_5_d, paramBytes: 0 },
      0xcbeb: { fn: this.set_5_e, paramBytes: 0 },
      0xcbec: { fn: this.set_5_h, paramBytes: 0 },
      0xcbed: { fn: this.set_5_l, paramBytes: 0 },
      0xcbee: { fn: this.set_5_0xhl, paramBytes: 0 },
      0xcbef: { fn: this.set_5_a, paramBytes: 0 },
      0xcbf0: { fn: this.set_6_b, paramBytes: 0 },
      0xcbf1: { fn: this.set_6_c, paramBytes: 0 },
      0xcbf2: { fn: this.set_6_d, paramBytes: 0 },
      0xcbf3: { fn: this.set_6_e, paramBytes: 0 },
      0xcbf4: { fn: this.set_6_h, paramBytes: 0 },
      0xcbf5: { fn: this.set_6_l, paramBytes: 0 },
      0xcbf6: { fn: this.set_6_0xhl, paramBytes: 0 },
      0xcbf7: { fn: this.set_6_a, paramBytes: 0 },
      0xcbf8: { fn: this.set_7_b, paramBytes: 0 },
      0xcbf9: { fn: this.set_7_c, paramBytes: 0 },
      0xcbfa: { fn: this.set_7_d, paramBytes: 0 },
      0xcbfb: { fn: this.set_7_e, paramBytes: 0 },
      0xcbfc: { fn: this.set_7_h, paramBytes: 0 },
      0xcbfd: { fn: this.set_7_l, paramBytes: 0 },
      0xcbfe: { fn: this.set_7_0xhl, paramBytes: 0 },
      0xcbff: { fn: this.set_7_a, paramBytes: 0 },
      0xcc: { fn: this.call_z, paramBytes: 2 },
      0xcd: { fn: this.call, paramBytes: 2 },
      0xce: { fn: this.adc_n, paramBytes: 1 },
      0xcf: { fn: this.rst_08, paramBytes: 0 },
      0xd0: { fn: this.ret_nc, paramBytes: 0 },
      0xd1: { fn: this.pop_de, paramBytes: 0 },
      0xd2: { fn: this._jp_nc_nn, paramBytes: 2 },
      0xd3: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xd4: { fn: this.call_nc, paramBytes: 2 },
      0xd5: { fn: this.push_de, paramBytes: 0 },
      0xd6: { fn: this.sub_n, paramBytes: 1 },
      0xd7: { fn: this.rst_10, paramBytes: 0 },
      0xd8: { fn: this.ret_c, paramBytes: 0 },
      0xd9: { fn: this.reti, paramBytes: 0 },
      0xda: { fn: this._jp_c_nn, paramBytes: 2 },
      0xdb: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xdc: { fn: this.call_c, paramBytes: 2 },
      0xdd: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xde: { fn: this.sbc_n, paramBytes: 1 },
      0xdf: { fn: this.rst_18, paramBytes: 0 },
      0xe0: { fn: this.ldh_n_a, paramBytes: 1 },
      0xe1: { fn: this.pop_hl, paramBytes: 0 },
      0xe2: { fn: this.ld_0xc_a, paramBytes: 0 },
      0xe3: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xe4: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xe5: { fn: this.push_hl, paramBytes: 0 },
      0xe6: { fn: this._and_n, paramBytes: 1 },
      0xe7: { fn: this.rst_20, paramBytes: 0 },
      0xe8: { fn: this._add_sp_e, paramBytes: 1 },
      0xe9: { fn: this._jp_hl, paramBytes: 0 },
      0xea: { fn: this.ld_0xnn_a, paramBytes: 2 },
      0xeb: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xec: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xed: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xee: { fn: this.xor_n, paramBytes: 1 },
      0xef: { fn: this.rst_28, paramBytes: 0 },
      0xf0: { fn: this.ldh_a_n, paramBytes: 1 },
      0xf1: { fn: this.pop_af, paramBytes: 0 },
      0xf2: { fn: this.ld_a_0xc, paramBytes: 0 },
      0xf3: { fn: this.di, paramBytes: 0 },
      0xf4: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xf5: { fn: this.push_af, paramBytes: 0 },
      0xf6: { fn: this.or_n, paramBytes: 1 },
      0xf7: { fn: this.rst_30, paramBytes: 0 },
      0xf8: { fn: this._ldhl_sp_n, paramBytes: 1 },
      0xf9: { fn: this.ld_sp_hl, paramBytes: 0 },
      0xfa: { fn: this.ld_a_nn, paramBytes: 2 },
      0xfb: { fn: this.ei, paramBytes: 0 },
      0xfc: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xfd: { fn: this._noSuchOpcode, paramBytes: 0 },
      0xfe: { fn: this.cp_n, paramBytes: 1 },
      0xff: { fn: this.rst_38, paramBytes: 0 }
    };

    this.mmu = mmu;
    this.lcd = lcd;

    this._r = {
      pc: 0,
      sp: this.mmu.ADDR_MAX - 1,
      a: 0x01,
      b: 0x00,
      c: 0x13,
      d: 0x00,
      e: 0xd8,
      _f: 0xb0,
      h: 0x01,
      l: 0x4d,
      ime: 1
    };

    this._lastInstrWasEI = false;
    this._m = 0; // machine cycles for lcd
    this._m_dma = 0; // machine cycles for DMA
    this._t = 0; // timer counter

    // CPU modes
    this._halt = false;
    this._stop = false;

    this.mustPaint = false;

    this._bootstrap();
  }

  /**
   * @returns {number} Accumulator
   */


  _createClass(CPU, [{
    key: 'a',
    value: function a() {
      return this._r.a;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_a',
    value: function _set_a(n) {
      this._r.a = n;
    }

    /**
     * @returns {number} register b
     */

  }, {
    key: 'b',
    value: function b() {
      return this._r.b;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_b',
    value: function _set_b(n) {
      this._r.b = n;
    }

    /**
     * @returns {number} register c
     */

  }, {
    key: 'c',
    value: function c() {
      return this._r.c;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_c',
    value: function _set_c(n) {
      this._r.c = n;
    }

    /**
     * @returns {number} register d
     */

  }, {
    key: 'd',
    value: function d() {
      return this._r.d;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_d',
    value: function _set_d(n) {
      this._r.d = n;
    }

    /**
     * @returns {number} register e
     */

  }, {
    key: 'e',
    value: function e() {
      return this._r.e;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_e',
    value: function _set_e(n) {
      this._r.e = n;
    }

    /**
     * @returns {number} register h
     */

  }, {
    key: 'h',
    value: function h() {
      return this._r.h;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_set_h',
    value: function _set_h(n) {
      this._r.h = n;
    }

    /**
     * @returns {number} register l
     */

  }, {
    key: 'l',
    value: function l() {
      return this._r.l;
    }

    /**
     * @param n
     */

  }, {
    key: '_set_l',
    value: function _set_l(n) {
      this._r.l = n;
    }

    /**
     * @returns {number} program counter
     */

  }, {
    key: 'pc',
    value: function pc() {
      return this._r.pc;
    }

    /**
     * @returns {number} stack pointer
     */

  }, {
    key: 'sp',
    value: function sp() {
      return this._r.sp;
    }

    /**
     * @param offset
     * @returns {number} byte at memory location sp + offset
     * @private
     */

  }, {
    key: 'peek_stack',
    value: function peek_stack() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this.mmu.readByteAt(this.sp() + offset);
    }

    /**
     * @returns {number} Register af
     */

  }, {
    key: 'af',
    value: function af() {
      return (this._r.a << 8) + this._r._f;
    }

    /**
     * @returns {number} Register bc
     */

  }, {
    key: 'bc',
    value: function bc() {
      return (this._r.b << 8) + this._r.c;
    }

    /**
     * @returns {number} Register de
     */

  }, {
    key: 'de',
    value: function de() {
      return (this._r.d << 8) + this._r.e;
    }

    /**
     * @returns {number} Register hl
     */

  }, {
    key: 'hl',
    value: function hl() {
      return (this._r.h << 8) + this._r.l;
    }

    /**
     * Sets register hl
     * @param nn
     * @private
     */

  }, {
    key: '_set_hl',
    value: function _set_hl(nn) {
      this._r.h = nn >> 8 & 0x00ff;
      this._r.l = nn & 0x00ff;
    }

    /**
     * @returns {number} byte at memory location hl
     * @private
     */

  }, {
    key: '_0xhl',
    value: function _0xhl() {
      this._m++;
      return this.mmu.readByteAt(this.hl());
    }

    /**
     * @returns {number} byte at memory location hl
     */

  }, {
    key: '$hl',
    value: function $hl() {
      return this.mmu.readByteAt(this.hl());
    }

    /**
     * @returns {number} flags (4 bits)
     */

  }, {
    key: 'f',
    value: function f() {
      return (this._r._f & 0xf0) >> 4;
    }

    /**
     * @returns {number} interrupt master enable
     */

  }, {
    key: 'ime',
    value: function ime() {
      return this._r.ime;
    }

    /**
     * @returns {number} interrupt enable register
     */

  }, {
    key: 'ie',
    value: function ie() {
      return this.mmu.readByteAt(this.mmu.ADDR_IE);
    }

    /**
     * Sets value on Interrupt Enable Register
     * @param value
     */

  }, {
    key: 'setIe',
    value: function setIe(value) {
      this.mmu.writeByteAt(this.mmu.ADDR_IE, value);
    }

    /**
     * Reads the interrupt request register
     * @returns {number}
     */

  }, {
    key: 'If',
    value: function If() {
      return this.mmu.readByteAt(this.mmu.ADDR_IF);
    }

    /**
     * Sets Interrupt flags
     * @param value
     */

  }, {
    key: 'setIf',
    value: function setIf(value) {
      this.mmu.writeByteAt(this.mmu.ADDR_IF, value);
    }

    /**
     * @returns {number} LCD Control Register
     */

  }, {
    key: 'lcdc',
    value: function lcdc() {
      return this.mmu.lcdc();
    }

    /**
     * LCD Status Flag
     * @returns {number}
     */

  }, {
    key: 'stat',
    value: function stat() {
      return this.mmu.stat();
    }
  }, {
    key: 'scy',
    value: function scy() {
      return this.mmu.readByteAt(0xff42);
    }
  }, {
    key: 'scx',
    value: function scx() {
      return this.mmu.readByteAt(0xff43);
    }

    /**
     * LCDC Y Coordinate (read-only)
     * @returns {*}
     */

  }, {
    key: 'ly',
    value: function ly() {
      return this.mmu.ly();
    }
  }, {
    key: 'lyc',
    value: function lyc() {
      return this.mmu.readByteAt(0xff45);
    }
  }, {
    key: 'bgp',
    value: function bgp() {
      return this.mmu.readByteAt(0xff47);
    }
  }, {
    key: 'obp0',
    value: function obp0() {
      return this.mmu.readByteAt(0xff48);
    }
  }, {
    key: 'obp1',
    value: function obp1() {
      return this.mmu.readByteAt(0xff49);
    }
  }, {
    key: 'wy',
    value: function wy() {
      return this.mmu.readByteAt(0xff4a);
    }
  }, {
    key: 'wx',
    value: function wx() {
      return this.mmu.readByteAt(0xff4b);
    }
  }, {
    key: 'nr11',
    value: function nr11() {
      return this.mmu.readByteAt(0xff11);
    }
  }, {
    key: 'nr12',
    value: function nr12() {
      return this.mmu.readByteAt(0xff12);
    }
  }, {
    key: 'nr50',
    value: function nr50() {
      return this.mmu.readByteAt(0xff24);
    }
  }, {
    key: 'nr51',
    value: function nr51() {
      return this.mmu.readByteAt(0xff25);
    }
  }, {
    key: 'nr52',
    value: function nr52() {
      return this.mmu.readByteAt(0xff26);
    }

    /**
     * @returns {number} machine cycles, for TDD
     */

  }, {
    key: 'm',
    value: function m() {
      return this._m;
    }

    /**
     * Runs cpu during a frame
     */

  }, {
    key: 'frame',
    value: function frame(pc_stop) {
      do {
        if (this.isStopped() || pc_stop !== -1 && this._r.pc === pc_stop) return;
        this.cpuCycle(pc_stop);
      } while (!this.mustPaint);

      this.mustPaint = false;
    }

    /**
     * Runs a CPU instruction cycle, including interruption handle and LCD/DMA/DIV updates
     */

  }, {
    key: 'cpuCycle',
    value: function cpuCycle() {

      var m = this._m;

      if (this._shouldStartVBlankRoutine()) {
        this._handleVBlankInterrupt();
      } else if (this._shouldHandleLCDInterrupt()) {
        this._handleLYCInterrupt();
      } else if (this._shouldHandleTimerInterrupt()) {
        this._handleTimerInterrupt();
      } else {
        if (!this.isHalted()) {
          this.execute();
        } else {
          if (this._isAnyInterruptRequestedAndAllowed()) {
            this._halt = false;
          } else {
            this._m++;
          }
        }
      }

      if (this._isTimerOn()) {
        this._updateTimer(this._m - m);
      }

      this._updateDivider(this._m - m);
      this._handleLCD();
      this._handleDMA();
    }

    /**
     * Sets adjustments before game starts.
     * @private
     */

  }, {
    key: '_bootstrap',
    value: function _bootstrap() {
      this.setIe(0x00);
      this.mmu.setLy(0x00);
      this._r.a = 0x11; // GBC a:0x11, DMG a:0x01
      this._r.b = 0;
      this._r.c = 0x13;
      this._r.d = 0;
      this._r.e = 0xd8;
      this._r.h = 1;
      this._r.l = 0x4d;
      this._r.pc = 0x100;
      this._r.ime = 1;
      this._r.sp = 0xfffe;
    }

    /**
     * @returns {boolean} true if timer is on
     * @private
     */

  }, {
    key: '_isTimerOn',
    value: function _isTimerOn() {
      return (this.mmu.readByteAt(this.mmu.ADDR_TAC) & this.mmu.MASK_TIMER_ON) === this.mmu.MASK_TIMER_ON;
    }

    /**
     * @param instrCycles
     * @private
     */

  }, {
    key: '_updateTimer',
    value: function _updateTimer(instrCycles) {
      var current = this.mmu.readByteAt(this.mmu.ADDR_TIMA);
      this._t += instrCycles;

      if (this._t >= this._getTicksToIncreaseTimer()) {
        var newValue = current + 1;
        if (newValue > 0xff) {
          this.setIf(this.If() | this.mmu.IF_TIMER_ON);
          newValue = this.mmu.readByteAt(this.mmu.ADDR_TMA);
        }
        this.mmu.writeByteAt(this.mmu.ADDR_TIMA, newValue);
        this._t = 0;
      }
    }

    /**
     * @returns {number}
     * @private
     */

  }, {
    key: '_getTicksToIncreaseTimer',
    value: function _getTicksToIncreaseTimer() {
      var clock = this.mmu.readByteAt(this.mmu.ADDR_TAC) & this.mmu.TAC_MASK_CLOCK;
      switch (clock) {
        case 0:
          return 256;
        case 1:
          return 4;
        case 2:
          return 16;
        case 3:
          return 64;
      }
    }

    /**
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_shouldHandleTimerInterrupt',
    value: function _shouldHandleTimerInterrupt() {
      return this._r.ime === 1 && (this.ie() & this.If() & this.mmu.IF_TIMER_ON) === this.mmu.IF_TIMER_ON;
    }

    /**
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isAnyInterruptRequestedAndAllowed',
    value: function _isAnyInterruptRequestedAndAllowed() {
      return (this.ie() & this.If()) !== 0;
    }

    /**
     * @private
     */

  }, {
    key: '_handleTimerInterrupt',
    value: function _handleTimerInterrupt() {
      this._halt = false;
      this.setIf(this.If() & this.mmu.IF_TIMER_OFF);
      this.di();
      this._rst_50();
      this._m = 0;
    }

    /**
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_shouldHandleLCDInterrupt',
    value: function _shouldHandleLCDInterrupt() {
      return this._r.ime === 1 && (this.ie() & this.If() & this.mmu.IF_STAT_ON) >> 1 === 1;
    }

    /**
     * @private
     */

  }, {
    key: '_handleLYCInterrupt',
    value: function _handleLYCInterrupt() {
      this._halt = false;
      this.setIf(this.If() & this.mmu.IF_STAT_OFF);
      this.di();
      this._rst_48();
    }

    /**
     * @private
     */

  }, {
    key: '_updateDivider',
    value: function _updateDivider(instructionCPUCycles) {
      this.mmu.setHWDivider(instructionCPUCycles * 2);
    }

    /**
     * Handles DMA
     * @private
     */

  }, {
    key: '_handleDMA',
    value: function _handleDMA() {
      if (this.mmu.isDMA()) {
        if (this._m_dma === this.M_CYCLES_DMA) {
          this.mmu.setDMA(false);
        } else {
          this._m_dma++;
        }
      } else {
        this._m_dma = 0;
      }
    }

    /**
     * Handles LCD updates
     * @private
     */

  }, {
    key: '_handleLCD',
    value: function _handleLCD() {

      if (!this._isLCDOn()) {
        this._m = 0;
        return;
      }

      if (this._m >= this._mLyOffset() + this.M_CYCLES_PER_LINE) {

        this.mmu.incrementLy();
        this._lineDrawn = false;

        if (this.ly() === 0) {
          this._m = 0;
          this.mmu.setLCDMode(0);
        }

        if (this.ly() === this.mmu.LCDC_LINE_VBLANK) {
          this.mmu.setLCDMode(1);
          this._requestVBlankInterrupt();
          this.mustPaint = true;
        }
      } else {
        this._handleTransitionsBeforeVBL();
      }
    }

    /**
     * @private
     */

  }, {
    key: '_handleTransitionsBeforeVBL',
    value: function _handleTransitionsBeforeVBL() {
      switch (this.mmu.getLCDMode()) {
        case 0:
          if (!this._lineDrawn && this._m > this._mLyOffset() + this.M_CYCLES_STOP_MODE_0) {
            this.mmu.setLCDMode(2);
          }
          break;
        case 1:
          break; // No transition during vblank
        case 2:
          if (this._m > this._mLyOffset() + this.M_CYCLES_STOP_MODE_2) {
            this.mmu.setLCDMode(3);
          }
          break;
        case 3:
          if (this._m > this._mLyOffset() + this.M_CYCLES_STOP_MODE_3) {
            this.mmu.setLCDMode(0);
            this.lcd.drawLine(this.ly());
            this._lineDrawn = true;
          }
          break;
      }
    }

    /**
     * @returns {number} clock start value for a given lcd line
     * @private
     */

  }, {
    key: '_mLyOffset',
    value: function _mLyOffset() {
      return this.ly() * this.M_CYCLES_PER_LINE;
    }

    /**
     * @returns {boolean} true if LCD is on
     * @private
     */

  }, {
    key: '_isLCDOn',
    value: function _isLCDOn() {
      return (this.lcdc() & 0x80) === 0x80;
    }

    /**
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_shouldStartVBlankRoutine',
    value: function _shouldStartVBlankRoutine() {
      if (this._r.ime === 1 && (this.ie() & this.If() & this.IF_VBLANK_ON) === 1) {
        if (this._lastInstrWasEI) {
          this._lastInstrWasEI = false;
          return false; // wait one instruction more
        } else {
          return true;
        }
      }
      return false;
    }
  }, {
    key: '_isVblankInterruptRequested',
    value: function _isVblankInterruptRequested() {
      return (this.If() & this.IF_VBLANK_ON) === 1;
    }

    /**
     * Handles vertical blank interruption
     * @private
     */

  }, {
    key: '_handleVBlankInterrupt',
    value: function _handleVBlankInterrupt() {

      this._halt = false;
      this.setIf(this.If() & this.IF_VBLANK_OFF);

      this.di();
      this._rst_40();
    }
  }, {
    key: 'paint',
    value: function paint() {
      this.lcd.paint();
    }

    /**
     * Sets IF to trigger a vblank interruption
     * @private
     */

  }, {
    key: '_requestVBlankInterrupt',
    value: function _requestVBlankInterrupt() {
      this.setIf(this.If() | this.IF_VBLANK_ON);
    }
  }, {
    key: '_resetVBlankInterruptRequest',
    value: function _resetVBlankInterruptRequest() {
      this.setIf(this.If() & this.IF_VBLANK_OFF);
    }

    /**
     * Start emulation until a given program counter. For tests.
     * @param {number} pc_stop
     */

  }, {
    key: 'runUntil',
    value: function runUntil(pc_stop) {
      while (this.pc() !== pc_stop) {
        this.frame(pc_stop);
      }
    }

    /**
     * @param cycles
     */

  }, {
    key: 'runCycles',
    value: function runCycles(cycles) {
      while (cycles-- > 0) {
        this.cpuCycle();
      }
    }

    /**
     * Executes the next instruction and increases the program counter.
     */

  }, {
    key: 'execute',
    value: function execute() {

      var opcode = this._nextOpcode();

      if (opcode === this.EXTENDED_PREFIX) {
        opcode = (opcode << 8) + this._nextOpcode();
      }

      var _getInstruction2 = this._getInstruction(opcode),
          fn = _getInstruction2.fn,
          paramBytes = _getInstruction2.paramBytes;

      var param = this._getInstrParams(paramBytes);

      _logger2.default.state(this, fn, paramBytes, param);

      try {
        fn.call(this, param, opcode);
      } catch (e) {
        _logger2.default.beforeCrash(this, fn, paramBytes, param);
        throw e;
      }
      this._lastInstrWasEI = fn.name === 'ei';
    }

    /**
     * @param param
     * @param opcode
     * @private
     */

  }, {
    key: '_noSuchOpcode',
    value: function _noSuchOpcode(param, opcode) {
      _logger2.default.info('Opcode ' + _utils2.default.hex2(opcode) + ' not supported in original DMG. Ignoring.');
    }

    /**
     * @param numBytes
     * @returns {*}
     * @private
     */

  }, {
    key: '_getInstrParams',
    value: function _getInstrParams(numBytes) {
      var param = void 0;
      if (numBytes > 0) {
        param = this.mmu.readByteAt(this._r.pc++);
        if (numBytes > 1) {
          param += this.mmu.readByteAt(this._r.pc++) << 8;
        }
      }
      return param;
    }

    /**
     * @param {number} opcode
     * @returns {Object} instruction given the opcode
     * @private
     */

  }, {
    key: '_getInstruction',
    value: function _getInstruction(opcode) {
      if (this._INSTRUCTIONS[opcode] != null) {
        return this._INSTRUCTIONS[opcode];
      } else {
        throw new Error('[' + _utils2.default.hex4(this._r.pc - 1) + '] Unknown opcode ' + _utils2.default.hex2(opcode) + '.');
      }
    }

    /**
     * @return {number} next opcode
     * @private
     */

  }, {
    key: '_nextOpcode',
    value: function _nextOpcode() {
      if (this._r.pc > this.mmu.ADDR_HRAM_END) {
        throw new Error('PC overflown');
      }
      var opcode = this.mmu.readByteAt(this._r.pc);
      this._r.pc = (this._r.pc + 1) % 0x10000;
      return opcode;
    }

    /**
     * Jumps to address
     * @param {number} nn 16 bits
     * @private
     */

  }, {
    key: '_jp',
    value: function _jp(nn) {
      this._r.pc = nn;
      this._m += 4;
    }

    /**
     * Adds signed byte to current address and jumps to it.
     * @param {number} signed byte
     */

  }, {
    key: '_jr_e',
    value: function _jr_e(signed) {
      var nextAddress = this._r.pc + _utils2.default.uint8ToInt8(signed);
      if (nextAddress < 0) {
        nextAddress += 0x10000;
      } else if (nextAddress > 0xffff) {
        nextAddress -= 0x10000;
      }
      this._r.pc = nextAddress;
      this._m += 3;
    }

    /**
     * Jumps to address contained in hl.
     * @private
     */

  }, {
    key: '_jp_hl',
    value: function _jp_hl() {
      this._r.pc = this.hl();
      this._m++;
    }

    /**
     * No operation.
     * @private
     */

  }, {
    key: '_nop',
    value: function _nop() {
      this._m++;
    }

    /**
     * Register a AND a
     */

  }, {
    key: '_and_a',
    value: function _and_a() {
      this.__and_n(this._r.a);
    }

    /**
     * Register a AND b
     */

  }, {
    key: '_and_b',
    value: function _and_b() {
      this.__and_n(this._r.b);
    }

    /**
     * Register a AND c
     */

  }, {
    key: '_and_c',
    value: function _and_c() {
      this.__and_n(this._r.c);
    }

    /**
     * Register a AND d
     */

  }, {
    key: '_and_d',
    value: function _and_d() {
      this.__and_n(this._r.d);
    }

    /**
     * Register a AND e
     */

  }, {
    key: '_and_e',
    value: function _and_e() {
      this.__and_n(this._r.e);
    }

    /**
     * Register a AND h
     */

  }, {
    key: '_and_h',
    value: function _and_h() {
      this.__and_n(this._r.h);
    }

    /**
     * Register a AND l
     */

  }, {
    key: '_and_l',
    value: function _and_l() {
      this.__and_n(this._r.l);
    }

    /**
     * Register a AND value at memory location hl
     */

  }, {
    key: '_and_0xhl',
    value: function _and_0xhl() {
      this.__and_n(this._0xhl());
    }

    /**
     * Register a AND n
     * @param n
     */

  }, {
    key: '_and_n',
    value: function _and_n(n) {
      this.__and_n(n);
      this._m++;
    }

    /**
     * Register a AND n
     * @param n
     * @private
     */

  }, {
    key: '__and_n',
    value: function __and_n(n) {
      if (this._r.a &= n) {
        this._setZ(0);
      } else {
        this._setZ(1);
      }
      this._setN(0);this._setH(1);this._setC(0);
      this._m++;
    }

    /** 
     * Register a OR a. Does nothing.
     */

  }, {
    key: 'or_a',
    value: function or_a() {
      this._or_n(this._r.a);
    }

    /**
     * Register a OR b
     */

  }, {
    key: 'or_b',
    value: function or_b() {
      this._or_n(this._r.b);
    }

    /**
     * Register a OR c
     */

  }, {
    key: 'or_c',
    value: function or_c() {
      this._or_n(this._r.c);
    }

    /**
     * Register a OR d
     */

  }, {
    key: 'or_d',
    value: function or_d() {
      this._or_n(this._r.d);
    }

    /**
     * Register a OR e
     */

  }, {
    key: 'or_e',
    value: function or_e() {
      this._or_n(this._r.e);
    }

    /**
     * Register a OR h
     */

  }, {
    key: 'or_h',
    value: function or_h() {
      this._or_n(this._r.h);
    }

    /**
     * Register a OR l
     */

  }, {
    key: 'or_l',
    value: function or_l() {
      this._or_n(this._r.l);
    }

    /**
     * Register a OR memory location hl
     */

  }, {
    key: 'or_0xhl',
    value: function or_0xhl() {
      this._or_n(this._0xhl());
    }

    /**
     * Register a OR n
     * @param n
     */

  }, {
    key: 'or_n',
    value: function or_n(n) {
      this._or_n(n);
      this._m++;
    }

    /**
     * Register a OR n
     * @param {number} n
     * @private
     */

  }, {
    key: '_or_n',
    value: function _or_n(n) {
      if (this._r.a |= n) {
        this._setZ(0);
      } else {
        this._setZ(1);
      }
      this._setN(0);this._setH(0);this._setC(0);
      this._m++;
    }

    /**
     * XOR register a, result in a.
     */

  }, {
    key: 'xor_a',
    value: function xor_a() {
      this._xor(this._r.a);
    }

    /**
     * XOR register b, result in a.
     */

  }, {
    key: 'xor_b',
    value: function xor_b() {
      this._xor(this._r.b);
    }

    /**
     * XOR register c, result in a.
     */

  }, {
    key: 'xor_c',
    value: function xor_c() {
      this._xor(this._r.c);
    }

    /**
     * XOR register d, result in a.
     */

  }, {
    key: 'xor_d',
    value: function xor_d() {
      this._xor(this._r.d);
    }

    /**
     * XOR register e, result in a.
     */

  }, {
    key: 'xor_e',
    value: function xor_e() {
      this._xor(this._r.e);
    }

    /**
     * XOR register h, result in a.
     */

  }, {
    key: 'xor_h',
    value: function xor_h() {
      this._xor(this._r.h);
    }

    /**
     * XOR register l, result in a.
     */

  }, {
    key: 'xor_l',
    value: function xor_l() {
      this._xor(this._r.l);
    }

    /**
     * XOR memory location hl, result in a.
     */

  }, {
    key: 'xor_0xhl',
    value: function xor_0xhl() {
      this._xor(this._0xhl());
    }

    /**
     * XOR byte n, result in a.
     */

  }, {
    key: 'xor_n',
    value: function xor_n(n) {
      this._xor(n);
      this._m++;
    }

    /**
     * XOR byte n with register a.
     * @param {number} n, a byte
     * @private
     */

  }, {
    key: '_xor',
    value: function _xor(n) {
      this._r.a ^= n;
      this._resetAllFlags();
      if (this._r.a === 0) {
        this._setZ(1);
      }
      this._m++;
    }

    /**
     * @private
     */

  }, {
    key: '_resetAllFlags',
    value: function _resetAllFlags() {
      this._r._f &= 0x0f;
    }

    /**
     * @returns {number} flag Z
     */

  }, {
    key: 'Z',
    value: function Z() {
      return this._r._f >> 7;
    }

    /**
     * @param {number} value Z
     */

  }, {
    key: '_setZ',
    value: function _setZ(value) {
      if (value === 1) {
        this._r._f |= 0x80;
      } else if (value === 0) {
        this._r._f &= 0x7f;
      } else {
        _logger2.default.error('Cannot set flag Z with ' + value);
      }
    }

    /**
     * @returns {number} flag N
     */

  }, {
    key: 'N',
    value: function N() {
      return (this._r._f & 0x40) >> 6;
    }

    /**
     * @param {number} value of flag N
     */

  }, {
    key: '_setN',
    value: function _setN(value) {
      if (value === 1) {
        this._r._f |= 0x40;
      } else if (value === 0) {
        this._r._f &= 0xbf;
      } else {
        _logger2.default.error('Cannot set flag N with ' + value);
      }
    }

    /**
     * @returns {number} flag H
     */

  }, {
    key: 'H',
    value: function H() {
      return (this._r._f & 0x20) >> 5;
    }

    /**
     * @param {number} value of flag H
     */

  }, {
    key: '_setH',
    value: function _setH(value) {
      if (value === 1) {
        this._r._f |= 0x20;
      } else if (value === 0) {
        this._r._f &= 0xdf;
      } else {
        _logger2.default.error('Cannot set flag H with ' + value);
      }
    }

    /**
     * @returns {number} flag C
     */

  }, {
    key: 'C',
    value: function C() {
      return (this._r._f & 0x10) >> 4;
    }

    /**
     * @param {number} value of flag C
     */

  }, {
    key: '_setC',
    value: function _setC(value) {
      if (value === 1) {
        this._r._f |= 0x10;
      } else if (value === 0) {
        this._r._f &= 0xef;
      } else {
        _logger2.default.error('Cannot set flag C with ' + value);
      }
    }

    /**
     * Sets carry flag
     * @private
     */

  }, {
    key: '_scf',
    value: function _scf() {
      this._setC(1);
      this._setN(0);
      this._setH(0);
      this._m++;
    }

    /**
     * Complements carry flag
     * @private
     */

  }, {
    key: '_ccf',
    value: function _ccf() {
      if (this.C() === 0) this._setC(1);else this._setC(0);
      this._setN(0);
      this._setH(0);
      this._m++;
    }

    /**
     * Loads 16 bits nn into bc.
     * @param {number} nn 16 bits
     */

  }, {
    key: 'ld_bc_nn',
    value: function ld_bc_nn(nn) {
      this._ld_rr_nn('b', 'c', nn);
    }

    /**
     * Loads 16 bits nn into de.
     * @param {number} nn, 16 bits
     */

  }, {
    key: 'ld_de_nn',
    value: function ld_de_nn(nn) {
      this._ld_rr_nn('d', 'e', nn);
    }

    /**
     * Loads 16 bits nn into hl.
     * @param {number} nn, 16 bits
     */

  }, {
    key: 'ld_hl_nn',
    value: function ld_hl_nn(nn) {
      this._ld_rr_nn('h', 'l', nn);
    }

    /**
     * Loads 16 bits nn into sp.
     * @param {number} nn, 16 bits
     */

  }, {
    key: 'ld_sp_nn',
    value: function ld_sp_nn(nn) {
      this._r.sp = nn;
      this._m += 3;
    }

    /**
     * Loads hl into stack pointer
     */

  }, {
    key: 'ld_sp_hl',
    value: function ld_sp_hl() {
      this._r.sp = this.hl();
      this._m += 2;
    }

    /**
     * Loads MSB in r1, LSB in r2
     * @param {string} r1
     * @param {string} r2
     * @param {number} nn, 16 bits
     * @private
     */

  }, {
    key: '_ld_rr_nn',
    value: function _ld_rr_nn(r1, r2, nn) {
      this._r[r1] = (nn & 0xff00) >> 8;
      this._r[r2] = nn & 0x00ff;
      this._m += 3;
    }

    /**
     * Loads 8 bits into b
     * @param n
     */

  }, {
    key: 'ld_b_n',
    value: function ld_b_n(n) {
      this._ld_r_n('b', n);
      this._m++;
    }

    /**
     * Loads 8 bits into c
     * @param n
     */

  }, {
    key: 'ld_c_n',
    value: function ld_c_n(n) {
      this._ld_r_n('c', n);
      this._m++;
    }

    /**
     * Loads 8 bits into d
     * @param n
     */

  }, {
    key: 'ld_d_n',
    value: function ld_d_n(n) {
      this._ld_r_n('d', n);
      this._m++;
    }

    /**
     * Loads 8 bits into e
     * @param n
     */

  }, {
    key: 'ld_e_n',
    value: function ld_e_n(n) {
      this._ld_r_n('e', n);
      this._m++;
    }

    /**
     * Loads 8 bits into h
     * @param n
     */

  }, {
    key: 'ld_h_n',
    value: function ld_h_n(n) {
      this._ld_r_n('h', n);
      this._m++;
    }

    /**
     * Loads 8 bits into l
     * @param n
     */

  }, {
    key: 'ld_l_n',
    value: function ld_l_n(n) {
      this._ld_r_n('l', n);
      this._m++;
    }

    /**
     * Loads 8 bits into register r
     * @param r
     * @param n
     * @private
     */

  }, {
    key: '_ld_r_n',
    value: function _ld_r_n(r, n) {
      this._r[r] = n;
      this._m++;
    }

    /**
     * Loads register a into a.
     */

  }, {
    key: 'ld_a_a',
    value: function ld_a_a() {
      this._ld_r_r('a', 'a');
    }

    /**
     * Loads register b into a.
     */

  }, {
    key: 'ld_a_b',
    value: function ld_a_b() {
      this._ld_r_r('a', 'b');
    }

    /**
     * Loads register c into a.
     */

  }, {
    key: 'ld_a_c',
    value: function ld_a_c() {
      this._ld_r_r('a', 'c');
    }

    /**
     * Loads register a into d.
     */

  }, {
    key: 'ld_a_d',
    value: function ld_a_d() {
      this._ld_r_r('a', 'd');
    }

    /**
     * Loads register e into a.
     */

  }, {
    key: 'ld_a_e',
    value: function ld_a_e() {
      this._ld_r_r('a', 'e');
    }

    /**
     * Loads register h into a.
     */

  }, {
    key: 'ld_a_h',
    value: function ld_a_h() {
      this._ld_r_r('a', 'h');
    }

    /**
     * Loads register l into a.
     */

  }, {
    key: 'ld_a_l',
    value: function ld_a_l() {
      this._ld_r_r('a', 'l');
    }

    /**
     * Loads address memory of bc into a.
     */

  }, {
    key: 'ld_a_0xbc',
    value: function ld_a_0xbc() {
      this.ld_a_n(this.mmu.readByteAt(this.bc()));
    }

    /**
     * Loads address memory of de into a.
     */

  }, {
    key: 'ld_a_0xde',
    value: function ld_a_0xde() {
      this.ld_a_n(this.mmu.readByteAt(this.de()));
    }

    /**
     * Loads address memory of hl into a.
     */

  }, {
    key: 'ld_a_0xhl',
    value: function ld_a_0xhl() {
      this._ld_r_0xhl('a');
    }

    /**
     * Loads value at memory location hl into b.
     */

  }, {
    key: 'ld_b_0xhl',
    value: function ld_b_0xhl() {
      this._ld_r_0xhl('b');
    }

    /**
     * Loads value at memory location hl into c.
     */

  }, {
    key: 'ld_c_0xhl',
    value: function ld_c_0xhl() {
      this._ld_r_0xhl('c');
    }

    /**
     * Loads value at memory location hl into d.
     */

  }, {
    key: 'ld_d_0xhl',
    value: function ld_d_0xhl() {
      this._ld_r_0xhl('d');
    }

    /**
     * Loads value at memory location hl into e.
     */

  }, {
    key: 'ld_e_0xhl',
    value: function ld_e_0xhl() {
      this._ld_r_0xhl('e');
    }

    /**
     * Loads value at memory location hl into h.
     */

  }, {
    key: 'ld_h_0xhl',
    value: function ld_h_0xhl() {
      this._ld_r_0xhl('h');
    }

    /**
     * Loads value at memory location hl into l.
     */

  }, {
    key: 'ld_l_0xhl',
    value: function ld_l_0xhl() {
      this._ld_r_0xhl('l');
    }

    /**
     * Loads value at memory location hl into register r.
     * @param r
     * @private
     */

  }, {
    key: '_ld_r_0xhl',
    value: function _ld_r_0xhl(r) {
      this._ld_r_n(r, this._0xhl());
    }

    /**
     * Loads address memory of nn into a.
     */

  }, {
    key: 'ld_a_nn',
    value: function ld_a_nn(nn) {
      this.ld_a_n(this.mmu.readByteAt(nn));
      this._m += 2;
    }

    /**
     * Loads 8 bits into register a.
     * @param n
     */

  }, {
    key: 'ld_a_n',
    value: function ld_a_n(n) {
      this._ld_r_n('a', n);
      this._m++;
    }

    /**
     * Loads a with value at address hl. Decrements hl.
     */

  }, {
    key: 'ldd_a_0xhl',
    value: function ldd_a_0xhl() {
      this._r.a = this._0xhl();
      this._dec_hl();
    }

    /**
     * Puts a into memory address hl. Decrements hl.
     */

  }, {
    key: 'ldd_0xhl_a',
    value: function ldd_0xhl_a() {
      this._ld_0xnn_a(this.hl());
      this._dec_hl();
    }

    /** 
     * Puts a into memory address hl. Increments hl.
     */

  }, {
    key: 'ldi_0xhl_a',
    value: function ldi_0xhl_a() {
      this._ld_0xnn_a(this.hl());
      this._inc_hl();
    }

    /**
     * Puts value at memory location hl into a. Increments hl.
     */

  }, {
    key: 'ldi_a_0xhl',
    value: function ldi_a_0xhl() {
      this._ld_a_0xhl();
      this._inc_hl();
    }

    /**
     * Loads value at memory location hl into a.
     * @private
     */

  }, {
    key: '_ld_a_0xhl',
    value: function _ld_a_0xhl() {
      this._r.a = this._0xhl();
    }

    /**
     * Decrements a by 1.
     */

  }, {
    key: 'dec_a',
    value: function dec_a() {
      this._dec_r('a');
    }

    /**
     * Decrements b by 1.
     */

  }, {
    key: 'dec_b',
    value: function dec_b() {
      this._dec_r('b');
    }

    /**
     * Decrements c by 1.
     */

  }, {
    key: 'dec_c',
    value: function dec_c() {
      this._dec_r('c');
    }

    /**
     * Decrements d by 1.
     */

  }, {
    key: 'dec_d',
    value: function dec_d() {
      this._dec_r('d');
    }

    /**
     * Decrements e by 1.
     */

  }, {
    key: 'dec_e',
    value: function dec_e() {
      this._dec_r('e');
    }

    /**
     * Decrements h by 1.
     */

  }, {
    key: 'dec_h',
    value: function dec_h() {
      this._dec_r('h');
    }

    /**
     * Decrements l by 1.
     */

  }, {
    key: 'dec_l',
    value: function dec_l() {
      this._dec_r('l');
    }

    /**
     * Decrements register r by 1.
     * @param {string} r, register
     * @private
     */

  }, {
    key: '_dec_r',
    value: function _dec_r(r) {

      this._setN(1); // subtracting

      if ((this._r[r] & 0x0f) === 0) {
        this._setH(1); // half carry
      } else {
        this._setH(0);
      }

      if (this._r[r] === 0) {
        this._r[r] = 0xff; // loop value
      } else {
        this._r[r]--;
      }

      if (this._r[r] === 0) {
        this._setZ(1); // result is zero
      } else {
        this._setZ(0);
      }
      this._m++;
    }

    /**
     * Decrements memory location hl by 1
     */

  }, {
    key: 'dec_0xhl',
    value: function dec_0xhl() {
      var value = this._0xhl();
      this._setN(1); // subtracting

      if ((value & 0x0f) === 0) {
        this._setH(1); // half carry
      } else {
        this._setH(0);
      }

      if (value === 0) {
        value = 0xff; // loop value
      } else {
        value--;
      }

      if (value === 0) {
        this._setZ(1); // result is zero
      } else {
        this._setZ(0);
      }
      this.mmu.writeByteAt(this.hl(), value);
      this._m += 2;
    }

    /**
     * Decrements bc by 1.
     */

  }, {
    key: 'dec_bc',
    value: function dec_bc() {
      this._dec_rr('b', 'c');
      this._m++;
    }

    /**
     * Decrements de by 1.
     */

  }, {
    key: 'dec_de',
    value: function dec_de() {
      this._dec_rr('d', 'e');
      this._m++;
    }

    /**
     * Decrements hl by 1.
     */

  }, {
    key: 'dec_hl',
    value: function dec_hl() {
      this._dec_hl();
      this._m++;
    }

    /**
     * Decrements hl by 1.
     * @private
     */

  }, {
    key: '_dec_hl',
    value: function _dec_hl() {
      this._dec_rr('h', 'l');
    }

    /**
     * Decrements sp by 1.
     */

  }, {
    key: 'dec_sp',
    value: function dec_sp() {
      if (this._r.sp === 0) {
        this._r.sp = this.mmu.ADDR_MAX;
      } else {
        this._r.sp--;
      }
      this._m += 2;
    }

    /**
     * Decrements the 16bits register r1r2 by 1.
     * @param r1
     * @param r2
     * @private
     */

  }, {
    key: '_dec_rr',
    value: function _dec_rr(r1, r2) {
      var value = this[r1 + r2]() - 1;
      this._r[r1] = (value & 0xff00) >> 8;
      this._r[r2] = value & 0x00ff;
      this._m++;
    }

    /**
     * Jumps to address nn if last operation was not zero.
     * @param {number} nn 2bytes
     */

  }, {
    key: '_jp_nz_nn',
    value: function _jp_nz_nn(nn) {
      this._jp_flag_nn(this.Z(), 0, nn);
    }

    /**
     * Jumps to address nn if last operation was zero.
     * @param nn
     */

  }, {
    key: '_jp_z_nn',
    value: function _jp_z_nn(nn) {
      this._jp_flag_nn(this.Z(), 1, nn);
    }

    /**
     * Jumps to memory nn if the given flag has the given value.
     * @param flag
     * @param valueToJump
     * @param nn
     * @private
     */

  }, {
    key: '_jp_flag_nn',
    value: function _jp_flag_nn(flag, valueToJump, nn) {
      if (flag === valueToJump) {
        this._jp(nn);
      } else {
        this._m += 3;
      }
    }

    /**
     * Jumps to address nn if last operation did not carry a bit.
     * @param nn
     */

  }, {
    key: '_jp_nc_nn',
    value: function _jp_nc_nn(nn) {
      this._jp_flag_nn(this.C(), 0, nn);
    }

    /**
     * Jumps to address nn if last operation carried a bit.
     * @param nn
     */

  }, {
    key: '_jp_c_nn',
    value: function _jp_c_nn(nn) {
      this._jp_flag_nn(this.C(), 1, nn);
    }

    /**
     * Jumps to current address + n if last operation was not zero.
     * @param {number} n, signed integer
     */

  }, {
    key: '_jr_nz_n',
    value: function _jr_nz_n(n) {
      this._jr_flag_n(this.Z(), 0, n);
    }

    /**
     * Jumps to current address + n if last operation was zero.
     * @param {number} n, signed integer
     */

  }, {
    key: '_jr_z_n',
    value: function _jr_z_n(n) {
      this._jr_flag_n(this.Z(), 1, n);
    }

    /**
     * Jumps to signed value n if given flag matches given value
     * @param flag
     * @param valueToJump
     * @param n
     * @private
     */

  }, {
    key: '_jr_flag_n',
    value: function _jr_flag_n(flag, valueToJump, n) {
      if (flag === valueToJump) {
        this._jr_e(n);
      } else {
        this._m += 2;
      }
    }

    /**
     * Jumps to current address + n if last operation did not carry 1 bit.
     * @param {number} n, signed integer
     */

  }, {
    key: '_jr_nc_n',
    value: function _jr_nc_n(n) {
      this._jr_flag_n(this.C(), 0, n);
    }

    /**
     * Jumps to current address + n if last operation carried 1 bit
     * @param {number} n signed integer
     */

  }, {
    key: '_jr_c_n',
    value: function _jr_c_n(n) {
      this._jr_flag_n(this.C(), 1, n);
    }

    /** 
     * Disables interruptions after executing the next instruction.
     */

  }, {
    key: 'di',
    value: function di() {
      this._r.ime = 0;
      this._m++;
    }

    /** 
     * Enables interruptions after executing the next instruction.
     */

  }, {
    key: 'ei',
    value: function ei() {
      this._r.ime = 1;
      this._m++;
    }

    /**
     * Loads a into memory address 0xff00 + n
     * @param {number} n
     */

  }, {
    key: 'ldh_n_a',
    value: function ldh_n_a(n) {
      this.mmu.writeByteAt(0xff00 + n, this._r.a);
      this._m += 3;
    }

    /**
     * Loads memory address 0xff00 + n into register a.
     * @param {number} n
     */

  }, {
    key: 'ldh_a_n',
    value: function ldh_a_n(n) {
      this._r.a = this.mmu.readByteAt(0xff00 + n);
      this._m += 3;
    }

    /**
     * Compares register a with register a
     */

  }, {
    key: 'cp_a',
    value: function cp_a() {
      this._cp_n(this._r.a);
    }

    /**
     * Compares register b with register a
     */

  }, {
    key: 'cp_b',
    value: function cp_b() {
      this._cp_n(this._r.b);
    }

    /**
     * Compares register c with register a
     */

  }, {
    key: 'cp_c',
    value: function cp_c() {
      this._cp_n(this._r.c);
    }

    /**
     * Compares register d with register a
     */

  }, {
    key: 'cp_d',
    value: function cp_d() {
      this._cp_n(this._r.d);
    }

    /**
     * Compares register e with register a
     */

  }, {
    key: 'cp_e',
    value: function cp_e() {
      this._cp_n(this._r.e);
    }

    /**
     * Compares register h with register a
     */

  }, {
    key: 'cp_h',
    value: function cp_h() {
      this._cp_n(this._r.h);
    }

    /**
     * Compares register l with register a
     */

  }, {
    key: 'cp_l',
    value: function cp_l() {
      this._cp_n(this._r.l);
    }

    /**
     * Compares memory location hl with register a
     */

  }, {
    key: 'cp_0xhl',
    value: function cp_0xhl() {
      this._cp_n(this._0xhl());
    }

    /**
     * Compares n with register a.
     * @param n
     */

  }, {
    key: 'cp_n',
    value: function cp_n(n) {
      this._cp_n(n);
      this._m++;
    }

    /**
     * Compares n with register a.
     * @param {number} n
     * @private
     */

  }, {
    key: '_cp_n',
    value: function _cp_n(n) {

      this._setN(1);this._setZ(0);this._setC(0);
      var diff = this._r.a - n;

      var nybbleDiff = diff & 0x0f;
      var nybbleA = this._r.a & 0x0f;

      if (nybbleA >= nybbleDiff) {
        this._setH(0);
      } else {
        this._setH(1);
      }

      if (diff === 0) {
        this._setZ(1);
      } else if (diff < 0) {
        this._setC(1);
      }
      this._m++;
    }

    /**
     * Tests bit b in value
     * @param b
     * @param value
     * @private
     */

  }, {
    key: '_bit_b_r',
    value: function _bit_b_r(b, value) {
      if ((value & 1 << b) >> b) {
        this._setZ(0);
      } else {
        this._setZ(1);
      }
      this._setN(0);this._setH(1);
      this._m += 2;
    }

    /**
     * Tests bit b at memory location hl
     * @param b
     * @private
     */

  }, {
    key: '_bit_b_0xhl',
    value: function _bit_b_0xhl(b) {
      this._bit_b_r(b, this._0xhl());
    }

    /**
     * Attaches reset bit functions to the cpu programmatically.
     * @private
     */

  }, {
    key: '_attach_bit_functions',
    value: function _attach_bit_functions() {
      var _this = this;

      ['a', 'b', 'c', 'd', 'e', 'h', 'l', '0xhl'].map(function (r) {
        var _loop = function _loop(b) {
          if (r === '0xhl') {
            _this['bit_' + b + '_0xhl'] = function () {
              this._bit_b_0xhl(b);
            };
            _this['res_' + b + '_0xhl'] = function () {
              this._res_b_0xhl(b);
            };
            _this['set_' + b + '_0xhl'] = function () {
              this._set_b_0xhl(b);
            };
          } else {
            _this['bit_' + b + '_' + r] = function () {
              this._bit_b_r(b, this._r[r]);
            };
            _this['res_' + b + '_' + r] = function () {
              this._res_b_r(b, r);
            };
            _this['set_' + b + '_' + r] = function () {
              this._set_b_r(b, r);
            };
          }
        };

        for (var b = 0; b < 8; b++) {
          _loop(b);
        }
      });
    }

    /**
     * Resets bit b of register r.
     * @param b
     * @param r
     * @private
     */

  }, {
    key: '_res_b_r',
    value: function _res_b_r(bit, r) {
      this._r[r] &= _utils2.default.bitMask(bit);
      this._m += 2;
    }

    /**
     * Resets bit b of value at memory location hl.
     * @param bit
     * @private
     */

  }, {
    key: '_res_b_0xhl',
    value: function _res_b_0xhl(bit) {
      this.mmu.writeByteAt(this.hl(), this._0xhl() & _utils2.default.bitMask(bit));
      this._m += 3;
    }

    /**
     * Sets bit b of register r.
     * @param bit
     * @private
     */

  }, {
    key: '_set_b_r',
    value: function _set_b_r(bit, r) {
      this._r[r] |= 1 << bit;
      this._m += 2;
    }

    /**
     * Sets bit b of value at memory location hl.
     * @param bit
     * @private
     */

  }, {
    key: '_set_b_0xhl',
    value: function _set_b_0xhl(bit) {
      var value = this._0xhl() | 1 << bit;
      this.mmu.writeByteAt(this.hl(), value);
      this._m += 3;
    }

    /**
     * Loads register a into memory address 0xff00 + c
     */

  }, {
    key: 'ld_0xc_a',
    value: function ld_0xc_a() {
      this.mmu.writeByteAt(0xff00 + this._r.c, this._r.a);
      this._m += 2;
    }

    /**
     * Loads memory address 0xff00 + c into a
     */

  }, {
    key: 'ld_a_0xc',
    value: function ld_a_0xc() {
      this._r.a = this.mmu.readByteAt(0xff00 + this._r.c);
      this._m += 2;
    }

    /**
     * Increases register a by 1
     */

  }, {
    key: 'inc_a',
    value: function inc_a() {
      this._inc_r('a');
    }
    /**
     * Increases register b by 1
     */

  }, {
    key: 'inc_b',
    value: function inc_b() {
      this._inc_r('b');
    }

    /**
     * Increases register c by 1
     */

  }, {
    key: 'inc_c',
    value: function inc_c() {
      this._inc_r('c');
    }

    /**
     * Increases register d by 1
     */

  }, {
    key: 'inc_d',
    value: function inc_d() {
      this._inc_r('d');
    }

    /**
     * Increases register e by 1
     */

  }, {
    key: 'inc_e',
    value: function inc_e() {
      this._inc_r('e');
    }

    /**
     * Increases register h by 1
     */

  }, {
    key: 'inc_h',
    value: function inc_h() {
      this._inc_r('h');
    }

    /**
     * Increases register l by 1
     */

  }, {
    key: 'inc_l',
    value: function inc_l() {
      this._inc_r('l');
    }

    /**
     * Increases register bc by 1
     */

  }, {
    key: 'inc_bc',
    value: function inc_bc() {
      this._inc_rr('b', 'c');
      this._m++;
    }

    /**
     * Increases register de by 1
     */

  }, {
    key: 'inc_de',
    value: function inc_de() {
      this._inc_rr('d', 'e');
      this._m++;
    }

    /**
     * Increases register hl by 1
     * @public
     */

  }, {
    key: 'inc_hl',
    value: function inc_hl() {
      this._inc_hl();
      this._m++;
    }

    /**
     * Increases register hl by 1
     * @private
     */

  }, {
    key: '_inc_hl',
    value: function _inc_hl() {
      this._inc_rr('h', 'l');
    }

    /**
     * Increases stack pointer by 1
     */

  }, {
    key: 'inc_sp',
    value: function inc_sp() {
      if (this._r.sp === this.mmu.ADDR_MAX) {
        this._r.sp = 0;
      } else {
        this._r.sp++;
      }
      this._m += 2;
    }

    /**
     * Increases register rr by 1
     * @private
     */

  }, {
    key: '_inc_rr',
    value: function _inc_rr(r1, r2) {
      var value = (this._r[r1] << 8) + this._r[r2] + 1;
      if ((value & 0x10000) > 0) {
        this._r[r1] = 0;
        this._r[r2] = 0;
      } else {
        this._r[r1] = (value & 0xff00) >> 8;
        this._r[r2] = value & 0x00ff;
      }
      this._m++;
    }

    /**
     * Increments the value at memory location hl by 1.
     */

  }, {
    key: '_inc_0xhl',
    value: function _inc_0xhl() {
      var value = this._0xhl();

      if (value === 0xff) {
        value = 0;
        this._setZ(1);
      } else {
        value++;
        this._setZ(0);
      }

      this.mmu.writeByteAt(this.hl(), value);

      if ((value & 0x0f) === 0) {
        this._setH(1);
      } else {
        this._setH(0);
      }
      this._setN(0);
      this._m += 2;
    }

    /**
     * Increases register r by 1.
     * @param r
     * @private
     */

  }, {
    key: '_inc_r',
    value: function _inc_r(r) {
      if (this._r[r] === 0xff) {
        this._r[r] = 0x00;
        this._setZ(1);
      } else {
        this._r[r]++;
        this._setZ(0);
      }
      if ((this._r[r] & 0x0f) === 0) {
        this._setH(1);
      } else {
        this._setH(0);
      }
      this._setN(0);
      this._m++;
    }

    /**
     * Loads register a into b
     */

  }, {
    key: 'ld_b_a',
    value: function ld_b_a() {
      this._ld_r_a('b');
    }

    /**
     * Loads register a into c
     */

  }, {
    key: 'ld_c_a',
    value: function ld_c_a() {
      this._ld_r_a('c');
    }

    /**
     * Loads register a into d
     */

  }, {
    key: 'ld_d_a',
    value: function ld_d_a() {
      this._ld_r_a('d');
    }

    /**
     * Loads register a into e
     */

  }, {
    key: 'ld_e_a',
    value: function ld_e_a() {
      this._ld_r_a('e');
    }

    /**
     * Loads register a into h
     */

  }, {
    key: 'ld_h_a',
    value: function ld_h_a() {
      this._ld_r_a('h');
    }

    /**
     * Loads register a into l
     */

  }, {
    key: 'ld_l_a',
    value: function ld_l_a() {
      this._ld_r_a('l');
    }

    /**
     * Loads register r into a
     * @param {string} r
     * @private
     */

  }, {
    key: '_ld_r_a',
    value: function _ld_r_a(r) {
      this._r[r] = this._r.a;
      this._m++;
    }

    /**
     * Loads register r2 into r1
     * @param r1
     * @param r2
     * @private
     */

  }, {
    key: '_ld_r_r',
    value: function _ld_r_r(r1, r2) {
      this._r[r1] = this._r[r2];
      this._m++;
    }

    /**
     * Loads b into b
     */

  }, {
    key: 'ld_b_b',
    value: function ld_b_b() {
      this._ld_r_r('b', 'b');
    }

    /**
     * Loads c into b
     */

  }, {
    key: 'ld_b_c',
    value: function ld_b_c() {
      this._ld_r_r('b', 'c');
    }

    /**
     * Loads d into b
     */

  }, {
    key: 'ld_b_d',
    value: function ld_b_d() {
      this._ld_r_r('b', 'd');
    }

    /**
     * Loads e into b
     */

  }, {
    key: 'ld_b_e',
    value: function ld_b_e() {
      this._ld_r_r('b', 'e');
    }

    /**
     * Loads h into b
     */

  }, {
    key: 'ld_b_h',
    value: function ld_b_h() {
      this._ld_r_r('b', 'h');
    }

    /**
     * Loads l into b
     */

  }, {
    key: 'ld_b_l',
    value: function ld_b_l() {
      this._ld_r_r('b', 'l');
    }

    /**
     * Loads b into c
     */

  }, {
    key: 'ld_c_b',
    value: function ld_c_b() {
      this._ld_r_r('c', 'b');
    }

    /**
     * Loads c into c
     */

  }, {
    key: 'ld_c_c',
    value: function ld_c_c() {
      this._ld_r_r('c', 'c');
    }

    /**
     * Loads d into c
     */

  }, {
    key: 'ld_c_d',
    value: function ld_c_d() {
      this._ld_r_r('c', 'd');
    }

    /**
     * Loads e into c
     */

  }, {
    key: 'ld_c_e',
    value: function ld_c_e() {
      this._ld_r_r('c', 'e');
    }

    /**
     * Loads h into c
     */

  }, {
    key: 'ld_c_h',
    value: function ld_c_h() {
      this._ld_r_r('c', 'h');
    }

    /**
     * Loads l into c
     */

  }, {
    key: 'ld_c_l',
    value: function ld_c_l() {
      this._ld_r_r('c', 'l');
    }

    /**
     * Loads b into d
     */

  }, {
    key: 'ld_d_b',
    value: function ld_d_b() {
      this._ld_r_r('d', 'b');
    }

    /**
     * Loads c into d
     */

  }, {
    key: 'ld_d_c',
    value: function ld_d_c() {
      this._ld_r_r('d', 'c');
    }

    /**
     * Loads d into d
     */

  }, {
    key: 'ld_d_d',
    value: function ld_d_d() {
      this._ld_r_r('d', 'd');
    }

    /**
     * Loads e into d
     */

  }, {
    key: 'ld_d_e',
    value: function ld_d_e() {
      this._ld_r_r('d', 'e');
    }

    /**
     * Loads h into d
     */

  }, {
    key: 'ld_d_h',
    value: function ld_d_h() {
      this._ld_r_r('d', 'h');
    }

    /**
     * Loads l into d
     */

  }, {
    key: 'ld_d_l',
    value: function ld_d_l() {
      this._ld_r_r('d', 'l');
    }

    /**
     * Loads b into e
     */

  }, {
    key: 'ld_e_b',
    value: function ld_e_b() {
      this._ld_r_r('e', 'b');
    }

    /**
     * Loads c into e
     */

  }, {
    key: 'ld_e_c',
    value: function ld_e_c() {
      this._ld_r_r('e', 'c');
    }

    /**
     * Loads d into e
     */

  }, {
    key: 'ld_e_d',
    value: function ld_e_d() {
      this._ld_r_r('e', 'd');
    }

    /**
     * Loads e into e
     */

  }, {
    key: 'ld_e_e',
    value: function ld_e_e() {
      this._ld_r_r('e', 'e');
    }

    /**
     * Loads h into e
     */

  }, {
    key: 'ld_e_h',
    value: function ld_e_h() {
      this._ld_r_r('e', 'h');
    }

    /**
     * Loads l into e
     */

  }, {
    key: 'ld_e_l',
    value: function ld_e_l() {
      this._ld_r_r('e', 'l');
    }

    /**
     * Loads b into h
     */

  }, {
    key: 'ld_h_b',
    value: function ld_h_b() {
      this._ld_r_r('h', 'b');
    }

    /**
     * Loads c into h
     */

  }, {
    key: 'ld_h_c',
    value: function ld_h_c() {
      this._ld_r_r('h', 'c');
    }

    /**
     * Loads d into h
     */

  }, {
    key: 'ld_h_d',
    value: function ld_h_d() {
      this._ld_r_r('h', 'd');
    }

    /**
     * Loads e into h
     */

  }, {
    key: 'ld_h_e',
    value: function ld_h_e() {
      this._ld_r_r('h', 'e');
    }

    /**
     * Loads h into h
     */

  }, {
    key: 'ld_h_h',
    value: function ld_h_h() {
      this._ld_r_r('h', 'h');
    }

    /**
     * Loads l into h
     */

  }, {
    key: 'ld_h_l',
    value: function ld_h_l() {
      this._ld_r_r('h', 'l');
    }

    /**
     * Loads b into l
     */

  }, {
    key: 'ld_l_b',
    value: function ld_l_b() {
      this._ld_r_r('l', 'b');
    }

    /**
     * Loads c into l
     */

  }, {
    key: 'ld_l_c',
    value: function ld_l_c() {
      this._ld_r_r('l', 'c');
    }

    /**
     * Loads d into l
     */

  }, {
    key: 'ld_l_d',
    value: function ld_l_d() {
      this._ld_r_r('l', 'd');
    }

    /**
     * Loads e into l
     */

  }, {
    key: 'ld_l_e',
    value: function ld_l_e() {
      this._ld_r_r('l', 'e');
    }

    /**
     * Loads h into l
     */

  }, {
    key: 'ld_l_h',
    value: function ld_l_h() {
      this._ld_r_r('l', 'h');
    }

    /**
     * Loads l into l
     */

  }, {
    key: 'ld_l_l',
    value: function ld_l_l() {
      this._ld_r_r('l', 'l');
    }

    /**
     * Loads register a into memory location bc
     */

  }, {
    key: 'ld_0xbc_a',
    value: function ld_0xbc_a() {
      this._ld_0xnn_a(this.bc());
      this._m++;
    }

    /**
     * Loads register a into memory location de
     */

  }, {
    key: 'ld_0xde_a',
    value: function ld_0xde_a() {
      this._ld_0xnn_a(this.de());
      this._m++;
    }

    /**
     * Loads register a into memory location hl
     */

  }, {
    key: 'ld_0xhl_a',
    value: function ld_0xhl_a() {
      this._ld_0xnn_a(this.hl());
      this._m++;
    }

    /**
     * Loads register a into memory address nn
     * @param addr
     */

  }, {
    key: 'ld_0xnn_a',
    value: function ld_0xnn_a(addr) {
      this._ld_0xnn_a(addr);
      this._m += 3;
    }

    /**
     * Loads register a into memory address nn
     * @param addr
     * @private
     */

  }, {
    key: '_ld_0xnn_a',
    value: function _ld_0xnn_a(addr) {
      this.mmu.writeByteAt(addr, this._r.a);
      this._m++;
    }

    /**
     * Calls a routine at a given address, saving the pc in the
     * stack.
     * @param addr
     */

  }, {
    key: 'call',
    value: function call(addr) {
      this._push_pc();
      this._r.pc = addr;
      this._m += 6;
    }

    /**
     * Calls a routine at a given address if z flag is not set
     * @param addr
     */

  }, {
    key: 'call_nz',
    value: function call_nz(addr) {
      this._call_flag(addr, this.Z(), 0);
    }

    /**
     * Calls a routine at a given address if z flag is set
     * @param addr
     */

  }, {
    key: 'call_z',
    value: function call_z(addr) {
      this._call_flag(addr, this.Z(), 1);
    }

    /**
     * Calls a routine at a given address if c flag is not set
     * @param addr
     */

  }, {
    key: 'call_nc',
    value: function call_nc(addr) {
      this._call_flag(addr, this.C(), 0);
    }

    /**
     * Calls a routine at a given address if c flag is set
     * @param addr
     */

  }, {
    key: 'call_c',
    value: function call_c(addr) {
      this._call_flag(addr, this.C(), 1);
    }

    /**
     * Calls a routine if a given flag has a given value
     * @param addr
     * @param flag
     * @param trigger
     * @private
     */

  }, {
    key: '_call_flag',
    value: function _call_flag(addr, flag, trigger) {
      if (flag === trigger) {
        this.call(addr);
      } else {
        this._m += 3;
      }
    }

    /**
     * Pushes the pc into stack.
     * @private
     */

  }, {
    key: '_push_pc',
    value: function _push_pc() {
      this.mmu.writeByteAt(--this._r.sp, _utils2.default.msb(this._r.pc));
      this.mmu.writeByteAt(--this._r.sp, _utils2.default.lsb(this._r.pc));
    }

    /**
     * Pushes register af into stack.
     */

  }, {
    key: 'push_af',
    value: function push_af() {
      this.mmu.writeByteAt(--this._r.sp, this._r.a);
      this.mmu.writeByteAt(--this._r.sp, this._r._f & 0xf0); // do not store lower hidden bits on stack
      this._m += 4;
    }

    /**
     * Pushes register bc into stack.
     */

  }, {
    key: 'push_bc',
    value: function push_bc() {
      this._push('b', 'c');
    }

    /**
     * Pushes register de into stack.
     */

  }, {
    key: 'push_de',
    value: function push_de() {
      this._push('d', 'e');
    }

    /**
     * Pushes register hl into stack.
     */

  }, {
    key: 'push_hl',
    value: function push_hl() {
      this._push('h', 'l');
    }

    /**
     * Pushes register r1 and r2 into the stack. Decrements sp twice.
     * @param r1
     * @param r2
     * @private
     */

  }, {
    key: '_push',
    value: function _push(r1, r2) {
      this.mmu.writeByteAt(--this._r.sp, this._r[r1]);
      this.mmu.writeByteAt(--this._r.sp, this._r[r2]);
      this._m += 4;
    }

    /**
     * Pops two bytes off the stack into af
     */

  }, {
    key: 'pop_af',
    value: function pop_af() {
      this._r._f = this.mmu.readByteAt(this._r.sp++) & 0xf0; // keep hidden bits at zero
      this._r.a = this.mmu.readByteAt(this._r.sp++);
      this._m += 3;
    }

    /**
     * Pops two bytes off the stack into bc
     */

  }, {
    key: 'pop_bc',
    value: function pop_bc() {
      this._pop('b', 'c');
    }

    /**
     * Pops two bytes off the stack into de
     */

  }, {
    key: 'pop_de',
    value: function pop_de() {
      this._pop('d', 'e');
    }

    /**
     * Pops two bytes off the stack into hl
     */

  }, {
    key: 'pop_hl',
    value: function pop_hl() {
      this._pop('h', 'l');
    }

    /**
     * Pops two bytes off the stack into register r1,r2
     * @param r1
     * @param r2
     * @private
     */

  }, {
    key: '_pop',
    value: function _pop(r1, r2) {
      this._r[r2] = this.mmu.readByteAt(this._r.sp++);
      this._r[r1] = this.mmu.readByteAt(this._r.sp++);
      this._m += 3;
    }

    /**
     * Pops two bytes off the stack
     * @returns {number}
     * @private
     */

  }, {
    key: '_pop_nn',
    value: function _pop_nn() {
      return this.mmu.readByteAt(this._r.sp++) + (this.mmu.readByteAt(this._r.sp++) << 8);
    }

    /**
     * Rotates left register a
     */

  }, {
    key: 'rl_a',
    value: function rl_a() {
      this._rl_r(this._set_a, this.a);
      this._m++;
    }

    /**
     * Rotates left register a
     */

  }, {
    key: 'rla',
    value: function rla() {
      this._rl_r(this._set_a, this.a);
      this._setZ(0);
    }

    /**
     * Rotates left register b
     */

  }, {
    key: 'rl_b',
    value: function rl_b() {
      this._rl_r(this._set_b, this.b);
      this._m++;
    }

    /**
     * Rotates left register c
     */

  }, {
    key: 'rl_c',
    value: function rl_c() {
      this._rl_r(this._set_c, this.c);
      this._m++;
    }

    /**
     * Rotates left register d
     */

  }, {
    key: 'rl_d',
    value: function rl_d() {
      this._rl_r(this._set_d, this.d);
      this._m++;
    }

    /**
     * Rotates left register e
     */

  }, {
    key: 'rl_e',
    value: function rl_e() {
      this._rl_r(this._set_e, this.e);
      this._m++;
    }

    /**
     * Rotates left register h
     */

  }, {
    key: 'rl_h',
    value: function rl_h() {
      this._rl_r(this._set_h, this.h);
      this._m++;
    }

    /**
     * Rotates left register l
     */

  }, {
    key: 'rl_l',
    value: function rl_l() {
      this._rl_r(this._set_l, this.l);
      this._m++;
    }

    /**
     * Rotates left register r with carry flag.
     * @param {function} setter
     * @param {function} getter
     * @param carried
     * @private
     */

  }, {
    key: '_rl_r',
    value: function _rl_r(setter, getter) {
      var carried = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.C();


      var value = getter.call(this);
      var rotated = (value << 1) + carried;
      value = rotated & 0xff;
      setter.call(this, value);

      if (value === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }

      this._setN(0);
      this._setH(0);
      this._setC((rotated & 0x100) >> 8);
      this._m++;
    }

    /**
     * Rotates right register a
     */

  }, {
    key: 'rra',
    value: function rra() {
      this._rr_r(this._set_a, this.a);
      this._setZ(0);
    }

    /**
     * Rotates right register a
     */

  }, {
    key: 'rr_a',
    value: function rr_a() {
      this._rr_r(this._set_a, this.a);
      this._m++;
    }

    /**
     * Rotates right register b
     */

  }, {
    key: 'rr_b',
    value: function rr_b() {
      this._rr_r(this._set_b, this.b);
      this._m++;
    }

    /**
     * Rotates right register c
     */

  }, {
    key: 'rr_c',
    value: function rr_c() {
      this._rr_r(this._set_c, this.c);
      this._m++;
    }

    /**
     * Rotates right register d
     */

  }, {
    key: 'rr_d',
    value: function rr_d() {
      this._rr_r(this._set_d, this.d);
      this._m++;
    }

    /**
     * Rotates right register e
     */

  }, {
    key: 'rr_e',
    value: function rr_e() {
      this._rr_r(this._set_e, this.e);
      this._m++;
    }

    /**
     * Rotates right register h
     */

  }, {
    key: 'rr_h',
    value: function rr_h() {
      this._rr_r(this._set_h, this.h);
      this._m++;
    }

    /**
     * Rotates right register l
     */

  }, {
    key: 'rr_l',
    value: function rr_l() {
      this._rr_r(this._set_l, this.l);
      this._m++;
    }

    /**
     * Rotates right register r
     * @param {function} setter
     * @param {function} getter
     * @param carried
     * @private
     */

  }, {
    key: '_rr_r',
    value: function _rr_r(setter, getter) {
      var carried = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.C();


      var value = getter.call(this);
      this._setC(value & 0x01);
      value = (value >> 1) + (carried << 7);
      setter.call(this, value);

      if (value === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }

      this._setN(0);
      this._setH(0);
      this._m++;
    }

    /**
     * Rotates left the value at memory hl. Sets carry flag.
     */

  }, {
    key: 'rl_0xhl',
    value: function rl_0xhl() {
      var carried = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.C();

      this._rl_r(this._ld_0xhl_n, this._0xhl, carried);
      if (this.$hl() === 0) {
        this._setZ(1);
      }
    }

    /**
     * Rotates right the value at memory hl. Sets carry flag.
     */

  }, {
    key: 'rr_0xhl',
    value: function rr_0xhl() {
      var carried = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.C();

      this._rr_r(this._ld_0xhl_n, this._0xhl, carried);
    }

    /** 
     * Pops two bytes from stack and jumps to that address
     */

  }, {
    key: 'ret',
    value: function ret() {
      this._jp(this._pop_nn());
    }

    /**
     * Jumps if last operation was not zero
     */

  }, {
    key: 'ret_nz',
    value: function ret_nz() {
      if (this.Z() === 0) {
        this._jp(this._pop_nn());
        this._m++;
      } else {
        this._m += 2;
      }
    }

    /**
     * Jumps if last operation was zero
     */

  }, {
    key: 'ret_z',
    value: function ret_z() {
      if (this.Z() === 1) {
        this._jp(this._pop_nn());
        this._m++;
      } else {
        this._m += 2;
      }
    }

    /**
     * Jumps if last operation did not carry
     */

  }, {
    key: 'ret_nc',
    value: function ret_nc() {
      if (this.C() === 0) {
        this._jp(this._pop_nn());
        this._m++;
      } else {
        this._m += 2;
      }
    }

    /**
     * Jumps if last operation carried
     */

  }, {
    key: 'ret_c',
    value: function ret_c() {
      if (this.C() === 1) {
        this._jp(this._pop_nn());
        this._m++;
      } else {
        this._m += 2;
      }
    }

    /**
     * Returns from interruption routine
     */

  }, {
    key: 'reti',
    value: function reti() {
      this._jp(this._pop_nn());
      this._r.ime = 1;
    }

    /**
     * Subtract a from a
     */

  }, {
    key: 'sub_a',
    value: function sub_a() {
      this._sub_n(this._r.a);
    }

    /**
     * Subtract b from a
     */

  }, {
    key: 'sub_b',
    value: function sub_b() {
      this._sub_n(this._r.b);
    }

    /**
     * Subtract c from a
     */

  }, {
    key: 'sub_c',
    value: function sub_c() {
      this._sub_n(this._r.c);
    }

    /**
     * Subtract d from a
     */

  }, {
    key: 'sub_d',
    value: function sub_d() {
      this._sub_n(this._r.d);
    }

    /**
     * Subtract e from a
     */

  }, {
    key: 'sub_e',
    value: function sub_e() {
      this._sub_n(this._r.e);
    }

    /**
     * Subtract h from a
     */

  }, {
    key: 'sub_h',
    value: function sub_h() {
      this._sub_n(this._r.h);
    }

    /**
     * Subtract l from a
     */

  }, {
    key: 'sub_l',
    value: function sub_l() {
      this._sub_n(this._r.l);
    }

    /**
     * Subtract value at memory address hl from a
     */

  }, {
    key: 'sub_0xhl',
    value: function sub_0xhl() {
      this._sub_n(this._0xhl());
    }

    /**
     * Subtract n from a
     * @param n
     */

  }, {
    key: 'sub_n',
    value: function sub_n(n) {
      this._sub_n(n);
      this._m++;
    }

    /**
     * Writes a value n into memory address hl
     * @param {number} n
     */

  }, {
    key: 'ld_0xhl_n',
    value: function ld_0xhl_n(n) {
      this._ld_0xhl_n(n);
      this._m++;
    }

    /**
     * Writes a value n into memory address hl
     * @param {number} n
     * @private
     */

  }, {
    key: '_ld_0xhl_n',
    value: function _ld_0xhl_n(n) {
      this.mmu.writeByteAt(this.hl(), n);
      this._m += 2;
    }

    /**
     * Subtract register value from register a
     * @param value
     * @private
     */

  }, {
    key: '_sub_n',
    value: function _sub_n(value) {
      var carry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;


      this._setN(1);

      var subtract = value + carry;
      var diff = this._r.a - subtract;
      var nybbleA = this._r.a & 0x0f;
      var subNybble = subtract & 0x0f;

      if (diff < 0) {
        this._r.a += 0x100;
        this._setC(1);
      } else {
        this._setC(0);
      }

      this._r.a -= subtract;

      if (subNybble > nybbleA || subNybble === 0 && carry === 1) {
        this._setH(1);
      } else {
        this._setH(0);
      }

      if (this._r.a === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }
      this._m++;
    }

    /**
     * Subtract a and carry flag to a
     */

  }, {
    key: 'sbc_a',
    value: function sbc_a() {
      this._sbc_n(this._r.a);
    }

    /**
     * Subtract b and carry flag to a
     */

  }, {
    key: 'sbc_b',
    value: function sbc_b() {
      this._sbc_n(this._r.b);
    }

    /**
     * Subtract c and carry flag to a
     */

  }, {
    key: 'sbc_c',
    value: function sbc_c() {
      this._sbc_n(this._r.c);
    }

    /**
     * Subtract d and carry flag to a
     */

  }, {
    key: 'sbc_d',
    value: function sbc_d() {
      this._sbc_n(this._r.d);
    }

    /**
     * Subtract e and carry flag to a
     */

  }, {
    key: 'sbc_e',
    value: function sbc_e() {
      this._sbc_n(this._r.e);
    }

    /**
     * Subtract h and carry flag to a
     */

  }, {
    key: 'sbc_h',
    value: function sbc_h() {
      this._sbc_n(this._r.h);
    }

    /**
     * Subtract l and carry flag to a
     */

  }, {
    key: 'sbc_l',
    value: function sbc_l() {
      this._sbc_n(this._r.l);
    }

    /**
     * Subtract n and carry flag to a
     * @param {number} byte
     */

  }, {
    key: 'sbc_n',
    value: function sbc_n(n) {
      this._sbc_n(n);
      this._m++;
    }

    /**
     * Subtract value at memory hl minus carry to a
     */

  }, {
    key: 'sbc_0xhl',
    value: function sbc_0xhl() {
      this._sbc_n(this._0xhl());
    }

    /**
     * Subtract value and carry flag to a
     * @param n
     * @private
     */

  }, {
    key: '_sbc_n',
    value: function _sbc_n(n) {
      this._sub_n(n, this.C());
    }

    /**
     * Adds a to a
     */

  }, {
    key: 'add_a',
    value: function add_a() {
      this._add_r(this._r.a);
    }

    /**
     * Adds b to a
     */

  }, {
    key: 'add_b',
    value: function add_b() {
      this._add_r(this._r.b);
    }

    /**
     * Adds c to a
     */

  }, {
    key: 'add_c',
    value: function add_c() {
      this._add_r(this._r.c);
    }

    /**
     * Adds d to a
     */

  }, {
    key: 'add_d',
    value: function add_d() {
      this._add_r(this._r.d);
    }

    /**
     * Adds e to a
     */

  }, {
    key: 'add_e',
    value: function add_e() {
      this._add_r(this._r.e);
    }

    /**
     * Adds h to a
     */

  }, {
    key: 'add_h',
    value: function add_h() {
      this._add_r(this._r.h);
    }

    /**
     * Adds l to a
     */

  }, {
    key: 'add_l',
    value: function add_l() {
      this._add_r(this._r.l);
    }

    /**
     * Adds value at memory hl to a
     */

  }, {
    key: 'add_0xhl',
    value: function add_0xhl() {
      this._add_r(this._0xhl());
    }

    /**
     * Adds byte to a
     * @param {number} n, 8 bits
     */

  }, {
    key: 'add_n',
    value: function add_n(n) {
      this._add_r(n);
      this._m++;
    }

    /**
     * Adds a value to register a
     * @param {number} value, 8 bits
     * @param {number} carry, 1 bit
     * @private
     */

  }, {
    key: '_add_r',
    value: function _add_r(value) {
      var carry = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;


      this._setN(0);
      var add = value + carry;
      var valueNybble = value & 0x0f;
      var needed = 0x0f - (this._r.a & 0x0f);

      // Half carry
      if (valueNybble > needed || carry === 1 && valueNybble >= needed) {
        this._setH(1);
      } else {
        this._setH(0);
      }

      this._r.a = this._r.a + add;

      // Carry
      if ((this._r.a & 0x100) > 0) {
        this._r.a -= 0x100;
        this._setC(1);
      } else {
        this._setC(0);
      }

      if (this._r.a === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }
      this._m++;
    }

    /**
     * Adds register bc to hl
     */

  }, {
    key: 'add_hl_bc',
    value: function add_hl_bc() {
      this._add_hl_nn(this.bc());
    }

    /**
     * Adds register de to hl
     */

  }, {
    key: 'add_hl_de',
    value: function add_hl_de() {
      this._add_hl_nn(this.de());
    }

    /**
     * Adds register hl to hl
     */

  }, {
    key: 'add_hl_hl',
    value: function add_hl_hl() {
      this._add_hl_nn(this.hl());
    }

    /**
     * Adds stack pointer to hl
     */

  }, {
    key: 'add_hl_sp',
    value: function add_hl_sp() {
      this._add_hl_nn(this.sp());
    }

    /**
     * Adds 16 bits to hl
     * @param nn
     * @private
     */

  }, {
    key: '_add_hl_nn',
    value: function _add_hl_nn(nn) {

      var hl = this.hl();
      var value = hl + nn;

      if ((nn & 0x0fff) > 0x0fff - (hl & 0x0fff)) {
        this._setH(1);
      } else {
        this._setH(0);
      }

      if ((value & 0x10000) > 0) {
        value -= 0x10000;
        this._setC(1);
      } else {
        this._setC(0);
      }

      this._set_hl(value);

      this._setN(0);
      this._m += 2;
    }

    /**
     * Adds a signed byte to the stack pointer
     * Flag H is set if there has been overflow from bit 3 (not 7!)
     * Flag C is set if there has been overflow from bit 7 (not 15!)
     * @param {number} signed byte
     * @private
     */

  }, {
    key: '_add_sp_e',
    value: function _add_sp_e(signed) {
      this._setN(0);this._setZ(0);

      if ((signed & 0x0f) > 0xf - (this._r.sp & 0x000f)) {
        this._setH(1);
      } else {
        this._setH(0);
      }

      if ((signed & 0xff) > 0xff - (this._r.sp & 0x00ff)) {
        this._setC(1);
      } else {
        this._setC(0);
      }

      if (signed > 0x7f) {
        if ((this._r.sp & 0xff00) === 0) {
          this._r.sp += 0xff00;
        } else {
          this._r.sp -= 0x100;
        }
      }

      if (this._r.sp + signed > 0xffff) {
        this._r.sp = this._r.sp + signed - 0x10000;
      } else {
        this._r.sp = this._r.sp + signed;
      }
      if (this._r.sp < 0) {
        this._r.sp = +0x10000;
      }
      this._m += 4;
    }

    /**
     * Loads register b into memory location hl
     */

  }, {
    key: 'ld_0xhl_b',
    value: function ld_0xhl_b() {
      this._ld_0xhl_n(this._r.b);
    }

    /**
     * Loads register c into memory location hl
     */

  }, {
    key: 'ld_0xhl_c',
    value: function ld_0xhl_c() {
      this._ld_0xhl_n(this._r.c);
    }

    /**
     * Loads register d into memory location hl
     */

  }, {
    key: 'ld_0xhl_d',
    value: function ld_0xhl_d() {
      this._ld_0xhl_n(this._r.d);
    }

    /**
     * Loads register e into memory location hl
     */

  }, {
    key: 'ld_0xhl_e',
    value: function ld_0xhl_e() {
      this._ld_0xhl_n(this._r.e);
    }

    /**
     * Loads register h into memory location hl
     */

  }, {
    key: 'ld_0xhl_h',
    value: function ld_0xhl_h() {
      this._ld_0xhl_n(this._r.h);
    }

    /**
     * Loads register l into memory location hl
     */

  }, {
    key: 'ld_0xhl_l',
    value: function ld_0xhl_l() {
      this._ld_0xhl_n(this._r.l);
    }

    /** 
     * Complements register a
     */

  }, {
    key: 'cpl',
    value: function cpl() {
      this._r.a = _utils2.default.cplBin8(this._r.a);
      this._setN(1);this._setH(1);
      this._m++;
    }

    /**
     * Swaps nybbles of a
     */

  }, {
    key: 'swap_a',
    value: function swap_a() {
      this._swap_n('a');
    }

    /**
     * Swaps nybbles of b
     */

  }, {
    key: 'swap_b',
    value: function swap_b() {
      this._swap_n('b');
    }

    /**
     * Swaps nybbles of c
     */

  }, {
    key: 'swap_c',
    value: function swap_c() {
      this._swap_n('c');
    }

    /**
     * Swaps nybbles of d
     */

  }, {
    key: 'swap_d',
    value: function swap_d() {
      this._swap_n('d');
    }

    /**
     * Swaps nybbles of e
     */

  }, {
    key: 'swap_e',
    value: function swap_e() {
      this._swap_n('e');
    }

    /**
     * Swaps nybbles of h
     */

  }, {
    key: 'swap_h',
    value: function swap_h() {
      this._swap_n('h');
    }

    /**
     * Swaps nybbles of l
     */

  }, {
    key: 'swap_l',
    value: function swap_l() {
      this._swap_n('l');
    }

    /**
     * Swaps nybbles of value at memory location hl
     */

  }, {
    key: 'swap_0xhl',
    value: function swap_0xhl() {
      var swapped = _utils2.default.swapNybbles(this._0xhl());

      if (swapped) {
        this._setZ(0);
      } else {
        this._setZ(1);
      }
      this._ld_0xhl_n(swapped);
      this._setN(0);this._setH(0);this._setC(0);
      this._m++;
    }

    /**
     * Swaps nybbles of register r
     * @param {string} r
     * @private
     */

  }, {
    key: '_swap_n',
    value: function _swap_n(r) {
      if (this._r[r] = _utils2.default.swapNybbles(this._r[r])) {
        this._setZ(0);
      } else {
        this._setZ(1);
      }
      this._setN(0);this._setH(0);this._setC(0);
      this._m += 2;
    }

    /**
     * Restarts to address 0x0000
     */

  }, {
    key: 'rst_00',
    value: function rst_00() {
      this._rst_n(0x00);
    }

    /**
     * Restarts to address 0x0008
     */

  }, {
    key: 'rst_08',
    value: function rst_08() {
      this._rst_n(0x08);
    }

    /**
     * Restarts to address 0x0010
     */

  }, {
    key: 'rst_10',
    value: function rst_10() {
      this._rst_n(0x10);
    }

    /**
     * Restarts to address 0x0018
     */

  }, {
    key: 'rst_18',
    value: function rst_18() {
      this._rst_n(0x18);
    }

    /**
     * Restarts to address 0x0020
     */

  }, {
    key: 'rst_20',
    value: function rst_20() {
      this._rst_n(0x20);
    }

    /**
     * Restarts to address 0x0028
     */

  }, {
    key: 'rst_28',
    value: function rst_28() {
      this._rst_n(0x28);
    }

    /**
     * Restarts to address 0x0030
     */

  }, {
    key: 'rst_30',
    value: function rst_30() {
      this._rst_n(0x30);
    }

    /**
     * Restarts to address 0x0038
     */

  }, {
    key: 'rst_38',
    value: function rst_38() {
      this._rst_n(0x38);
    }

    /**
     * Restarts to vblank interrupt routine
     * @private
     */

  }, {
    key: '_rst_40',
    value: function _rst_40() {
      this._rst_n(this.ADDR_VBLANK_INTERRUPT);
    }

    /**
     * Jumps to STAT interrupt routine
     * @private
     */

  }, {
    key: '_rst_48',
    value: function _rst_48() {
      this._rst_n(this.ADDR_STAT_INTERRUPT);
    }

    /**
     * Jumps to Timer Overflow interrupt routine
     * @private
     */

  }, {
    key: '_rst_50',
    value: function _rst_50() {
      this._rst_n(this.ADDR_TIMER_INTERRUPT);
    }

    /**
     * Pushes the pc into stack and jumps to address n
     * @param n
     * @private
     */

  }, {
    key: '_rst_n',
    value: function _rst_n(n) {
      this._push_pc();
      this._jp(n);
    }

    /**
     * Shifts register a left
     */

  }, {
    key: 'sla_a',
    value: function sla_a() {
      this._sla_r(this._set_a, this.a);
    }

    /**
     * Shifts register b left
     */

  }, {
    key: 'sla_b',
    value: function sla_b() {
      this._sla_r(this._set_b, this.b);
    }

    /**
     * Shifts register c left
     */

  }, {
    key: 'sla_c',
    value: function sla_c() {
      this._sla_r(this._set_c, this.c);
    }

    /**
     * Shifts register d left
     */

  }, {
    key: 'sla_d',
    value: function sla_d() {
      this._sla_r(this._set_d, this.d);
    }

    /**
     * Shifts register e left
     */

  }, {
    key: 'sla_e',
    value: function sla_e() {
      this._sla_r(this._set_e, this.e);
    }

    /**
     * Shifts register h left
     */

  }, {
    key: 'sla_h',
    value: function sla_h() {
      this._sla_r(this._set_h, this.h);
    }

    /**
     * Shifts register l left
     */

  }, {
    key: 'sla_l',
    value: function sla_l() {
      this._sla_r(this._set_l, this.l);
    }

    /**
     * Shifts register r left
     * @param {function} setter
     * @param {function} getter
     * @private
     */

  }, {
    key: '_sla_r',
    value: function _sla_r(setter, getter) {
      this._rl_r(setter, getter, 0);
      if (getter.call(this) === 0) {
        this._setZ(1);
      }
      this._m++;
    }

    /**
     * Shifts left the value at memory location hl
     */

  }, {
    key: 'sla_0xhl',
    value: function sla_0xhl() {
      this.rl_0xhl(0);
    }

    /**
     * @param {function} setter
     * @param {function} getter
     * @private
     */

  }, {
    key: '_sra_r',
    value: function _sra_r(setter, getter) {
      this._rr_r(setter, getter, getter.call(this) >> 7);
    }

    /**
     * Shift right register a without modifying bit 7
     */

  }, {
    key: 'sra_a',
    value: function sra_a() {
      this._sra_r(this._set_a, this.a);
      this._m++;
    }

    /**
     * Shift right register b without modifying bit 7
     */

  }, {
    key: 'sra_b',
    value: function sra_b() {
      this._sra_r(this._set_b, this.b);
      this._m++;
    }

    /**
     * Shift right register c without modifying bit 7
     */

  }, {
    key: 'sra_c',
    value: function sra_c() {
      this._sra_r(this._set_c, this.c);
      this._m++;
    }

    /**
     * Shift right register d without modifying bit 7
     */

  }, {
    key: 'sra_d',
    value: function sra_d() {
      this._sra_r(this._set_d, this.d);
      this._m++;
    }

    /**
     * Shift right register e without modifying bit 7
     */

  }, {
    key: 'sra_e',
    value: function sra_e() {
      this._sra_r(this._set_e, this.e);
      this._m++;
    }

    /**
     * Shift right register h without modifying bit 7
     */

  }, {
    key: 'sra_h',
    value: function sra_h() {
      this._sra_r(this._set_h, this.h);
      this._m++;
    }

    /**
     * Shift right register l without modifying bit 7
     */

  }, {
    key: 'sra_l',
    value: function sra_l() {
      this._sra_r(this._set_l, this.l);
      this._m++;
    }

    /**
     * Shift right value at memory location hl without modifying bit 7
     */

  }, {
    key: 'sra_0xhl',
    value: function sra_0xhl() {
      this._sra_r(this._ld_0xhl_n, this.$hl);
      this._m++;
    }

    /**
     * Shifts right the value at memory location hl
     */

  }, {
    key: 'srl_0xhl',
    value: function srl_0xhl() {
      this.rr_0xhl(0);
    }

    /**
     * Shifts register r right
     * @param {function} setter
     * @param {function} getter
     * @private
     */

  }, {
    key: '_srl_r',
    value: function _srl_r(setter, getter) {
      this._rr_r(setter, getter, 0);
      this._m++;
    }

    /**
     * Shifts register a right
     */

  }, {
    key: 'srl_a',
    value: function srl_a() {
      this._srl_r(this._set_a, this.a);
    }

    /**
     * Shifts register b right
     */

  }, {
    key: 'srl_b',
    value: function srl_b() {
      this._srl_r(this._set_b, this.b);
    }

    /**
     * Shifts register c right
     */

  }, {
    key: 'srl_c',
    value: function srl_c() {
      this._srl_r(this._set_c, this.c);
    }

    /**
     * Shifts register d right
     */

  }, {
    key: 'srl_d',
    value: function srl_d() {
      this._srl_r(this._set_d, this.d);
    }

    /**
     * Shifts register e right
     */

  }, {
    key: 'srl_e',
    value: function srl_e() {
      this._srl_r(this._set_e, this.e);
    }

    /**
     * Shifts register h right
     */

  }, {
    key: 'srl_h',
    value: function srl_h() {
      this._srl_r(this._set_h, this.h);
    }

    /**
     * Shifts register l right
     */

  }, {
    key: 'srl_l',
    value: function srl_l() {
      this._srl_r(this._set_l, this.l);
    }

    /**
     * Rotates left a with copy to carry
     */

  }, {
    key: 'rlca',
    value: function rlca() {
      this._rlc_r(this._set_a, this.a);
      this._setZ(0);
    }

    /**
     * Rotates left a with copy to carry
     */

  }, {
    key: 'rlc_a',
    value: function rlc_a() {
      this._rlc_r(this._set_a, this.a);
      this._m++;
    }

    /**
     * Rotates left b with copy to carry
     */

  }, {
    key: 'rlc_b',
    value: function rlc_b() {
      this._rlc_r(this._set_b, this.b);
      this._m++;
    }

    /**
     * Rotates left c with copy to carry
     */

  }, {
    key: 'rlc_c',
    value: function rlc_c() {
      this._rlc_r(this._set_c, this.c);
      this._m++;
    }

    /**
     * Rotates left d with copy to carry
     */

  }, {
    key: 'rlc_d',
    value: function rlc_d() {
      this._rlc_r(this._set_d, this.d);
      this._m++;
    }

    /**
     * Rotates left e with copy to carry
     */

  }, {
    key: 'rlc_e',
    value: function rlc_e() {
      this._rlc_r(this._set_e, this.e);
      this._m++;
    }

    /**
     * Rotates left h with copy to carry
     */

  }, {
    key: 'rlc_h',
    value: function rlc_h() {
      this._rlc_r(this._set_h, this.h);
      this._m++;
    }

    /**
     * Rotates left l with copy to carry
     */

  }, {
    key: 'rlc_l',
    value: function rlc_l() {
      this._rlc_r(this._set_l, this.l);
      this._m++;
    }

    /**
     * Rotates left the value at memory location hl with copy to carry
     */

  }, {
    key: 'rlc_0xhl',
    value: function rlc_0xhl() {
      this._rlc_r(this._ld_0xhl_n, this._0xhl);
    }

    /**
     * Rotates left register with copy to carry
     * @param {function} setter
     * @param {function} getter
     * @private
     */

  }, {
    key: '_rlc_r',
    value: function _rlc_r(setter, getter) {
      var value = getter.call(this);
      var rotated = value << 1;
      var carry = (rotated & 0x100) >> 8;
      value = (rotated & 0xff) + carry;
      setter.call(this, value);

      if (value === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }
      this._setN(0);
      this._setH(0);
      this._setC(carry);
      this._m++;
    }

    /**
     * Rotates right r with copy to carry
     * @param {function} setter
     * @param {function} getter
     * @private
     */

  }, {
    key: '_rrc_r',
    value: function _rrc_r(setter, getter) {
      var value = getter.call(this);

      var carried = value & 0x01;
      var rotated = (value >> 1) + (carried << 7);
      setter.call(this, rotated);

      this._setC(carried);

      if (value === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }

      this._setN(0);
      this._setH(0);
      this._m++;
    }

    /**
     * Rotates right register a with copy to carry
     */

  }, {
    key: 'rrca',
    value: function rrca() {
      this._rrc_r(this._set_a, this.a);
      this._setZ(0);
    }

    /**
     * Rotates right register a with copy to carry
     */

  }, {
    key: 'rrc_a',
    value: function rrc_a() {
      this._rrc_r(this._set_a, this.a);
      this._m++;
    }

    /**
     * Rotates right register b with copy to carry
     */

  }, {
    key: 'rrc_b',
    value: function rrc_b() {
      this._rrc_r(this._set_b, this.b);
      this._m++;
    }

    /**
     * Rotates right register c with copy to carry
     */

  }, {
    key: 'rrc_c',
    value: function rrc_c() {
      this._rrc_r(this._set_c, this.c);
      this._m++;
    }

    /**
     * Rotates right register d with copy to carry
     */

  }, {
    key: 'rrc_d',
    value: function rrc_d() {
      this._rrc_r(this._set_d, this.d);
      this._m++;
    }

    /**
     * Rotates right register e with copy to carry
     */

  }, {
    key: 'rrc_e',
    value: function rrc_e() {
      this._rrc_r(this._set_e, this.e);
      this._m++;
    }

    /**
     * Rotates right register h with copy to carry
     */

  }, {
    key: 'rrc_h',
    value: function rrc_h() {
      this._rrc_r(this._set_h, this.h);
      this._m++;
    }

    /**
     * Rotates right register l with copy to carry
     */

  }, {
    key: 'rrc_l',
    value: function rrc_l() {
      this._rrc_r(this._set_l, this.l);
      this._m++;
    }

    /**
     * Rotates right value at memory location hl with copy to carry
     */

  }, {
    key: 'rrc_0xhl',
    value: function rrc_0xhl() {
      this._rrc_r(this._ld_0xhl_n, this._0xhl);
    }

    /**
     * Adds register a and carry to register a
     */

  }, {
    key: 'adc_a',
    value: function adc_a() {
      this._adc_r(this._r.a);
    }

    /**
     * Adds register b and carry to register a
     */

  }, {
    key: 'adc_b',
    value: function adc_b() {
      this._adc_r(this._r.b);
    }

    /**
     * Adds register c and carry to register a
     */

  }, {
    key: 'adc_c',
    value: function adc_c() {
      this._adc_r(this._r.c);
    }

    /**
     * Adds register d and carry to register a
     */

  }, {
    key: 'adc_d',
    value: function adc_d() {
      this._adc_r(this._r.d);
    }

    /**
     * Adds register e and carry to register a
     */

  }, {
    key: 'adc_e',
    value: function adc_e() {
      this._adc_r(this._r.e);
    }

    /**
     * Adds register h and carry to register a
     */

  }, {
    key: 'adc_h',
    value: function adc_h() {
      this._adc_r(this._r.h);
    }

    /**
     * Adds register l and carry to register a
     */

  }, {
    key: 'adc_l',
    value: function adc_l() {
      this._adc_r(this._r.l);
    }

    /**
     * Adds value at memory hl plus carry to a
     */

  }, {
    key: 'adc_0xhl',
    value: function adc_0xhl() {
      this._adc_r(this._0xhl());
    }

    /**
     * Adds byte n and carry to register a
     * @param {number} n
     */

  }, {
    key: 'adc_n',
    value: function adc_n(n) {
      this._adc_r(n);
      this._m++;
    }

    /**
     * Adds register r and carry to register a
     * @param r
     * @private
     */

  }, {
    key: '_adc_r',
    value: function _adc_r(r) {
      this._add_r(r, this.C());
    }

    /**
     * Decimal Adjust to register a
     * H is always reset after DAA
     * C is set or kept after DAA, but never reset
     * @private
     */

  }, {
    key: '_daa',
    value: function _daa() {

      if (!this.N()) {
        if (this.H() || (this._r.a & 0xf) > 9) this._r.a += 0x06;
        if (this.C() || this._r.a > 0x9f) this._r.a += 0x60;
      } else {
        if (this.H()) this._r.a = this._r.a - 6 & 0xFF;
        if (this.C()) this._r.a -= 0x60;
      }

      if ((this._r.a & 0x100) === 0x100) {
        this._setC(1); // Note DAA never resets C
      }

      this._r.a &= 0xff;

      if (this._r.a === 0) {
        this._setZ(1);
      } else {
        this._setZ(0);
      }
      this._setH(0); // H always reset after DAA
      this._m++;
    }

    /**
     * Halt
     */

  }, {
    key: 'halt',
    value: function halt() {
      this._halt = true;
      this._m++;
    }

    /**
     * @returns {boolean}
     */

  }, {
    key: 'isHalted',
    value: function isHalted() {
      return this._halt;
    }

    /**
     * Stops CPU and LCD
     */

  }, {
    key: '_stop',
    value: function _stop() {
      this._stop = true;
      this._m++;
    }

    /**
     * @returns {boolean}
     */

  }, {
    key: 'isStopped',
    value: function isStopped() {
      return this._stop;
    }

    /**
     * Writes the LSB of stack pointer into address nn, MSB into nn+1
     * @param nn
     */

  }, {
    key: 'ld_nn_sp',
    value: function ld_nn_sp(nn) {
      this.mmu.writeByteAt(nn++, _utils2.default.lsb(this.sp()));
      this.mmu.writeByteAt(nn, _utils2.default.msb(this.sp()));
      this._m += 5;
    }

    /**
     * Loads the stack pointer plus a signed int into hl
     * Sets H if there was overflow from bit 3
     * Sets C if there was overflow from bit 7
     * @param n [-128,127]
     */

  }, {
    key: '_ldhl_sp_n',
    value: function _ldhl_sp_n(n) {
      this._setN(0);this._setZ(0);
      var newValue = this._r.sp;

      if ((n & 0x0f) > 0xf - (newValue & 0x000f)) {
        this._setH(1);
      } else {
        this._setH(0);
      }

      if ((n & 0xff) > 0xff - (newValue & 0x00ff)) {
        this._setC(1);
      } else {
        this._setC(0);
      }

      if (n > 0x7f) {
        if ((newValue & 0xff00) === 0) {
          newValue += 0xff00;
        } else {
          newValue -= 0x100;
        }
      }

      if (newValue + n > 0xffff) {
        newValue = newValue + n - 0x10000;
      } else {
        newValue = newValue + n;
      }
      if (newValue < 0) {
        newValue = +0x10000;
      }

      this.ld_hl_nn(newValue);
    }
  }, {
    key: 'pressA',
    value: function pressA() {
      this._handle_input();
      this.mmu.pressA();
    }
  }, {
    key: 'pressB',
    value: function pressB() {
      this._handle_input();
      this.mmu.pressB();
    }
  }, {
    key: 'pressSTART',
    value: function pressSTART() {
      this._handle_input();
      this.mmu.pressSTART();
    }
  }, {
    key: 'pressSELECT',
    value: function pressSELECT() {
      this._handle_input();
      this.mmu.pressSELECT();
    }
  }, {
    key: 'pressUp',
    value: function pressUp() {
      this._handle_input();
      this.mmu.pressUp();
    }
  }, {
    key: 'pressDown',
    value: function pressDown() {
      this._handle_input();
      this.mmu.pressDown();
    }
  }, {
    key: 'pressLeft',
    value: function pressLeft() {
      this._handle_input();
      this.mmu.pressLeft();
    }
  }, {
    key: 'pressRight',
    value: function pressRight() {
      this._handle_input();
      this.mmu.pressRight();
    }

    /**
     * Handles action upon input
     * @private
     */

  }, {
    key: '_handle_input',
    value: function _handle_input() {
      this._stop = false;
    }
  }]);

  return CPU;
}();

exports.default = CPU;

},{"./logger":12,"./utils":15}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GameRequester = function () {
  function GameRequester() {
    _classCallCheck(this, GameRequester);

    this._games = {
      'load-game': 'roms/load-game.gb'
    };
  }

  /**
   * @param {string} gameName
   * @param {Function} callback
   */


  _createClass(GameRequester, [{
    key: 'request',
    value: function request(gameName, callback) {

      var file = this._games[gameName];

      if (file) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
          if (this.readyState == 4 && this.status == 200) {
            callback.call(this, this.response);
          }
        };
        request.open('GET', file, true);
        request.responseType = 'arraybuffer';
        request.send();
      }
    }
  }]);

  return GameRequester;
}();

exports.default = GameRequester;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var InputHandler = function () {

  /**
   * @param mmu
   * @param $body
   */
  function InputHandler(cpu, $body) {
    var _this = this;

    _classCallCheck(this, InputHandler);

    if (!cpu) throw new Error('Missing CPU');
    if (!$body) throw new Error('Missing DOM body');

    this._cpu = cpu;

    this.KEY_UP = 38;
    this.KEY_LEFT = 37;
    this.KEY_RIGHT = 39;
    this.KEY_DOWN = 40;
    this.KEY_X = 88;
    this.KEY_Z = 90;
    this.KEY_ENTER = 13;
    this.KEY_SPACE = 32;
    this.KEY_CTRL = 17;

    $body.addEventListener('keydown', function (evt) {
      return _this.onKeyDown(evt);
    });
    $body.addEventListener('keyup', function (evt) {
      return _this.onKeyUp(evt);
    });
  }

  /**
   * @param evt
   */


  _createClass(InputHandler, [{
    key: 'onKeyDown',
    value: function onKeyDown(evt) {

      evt.preventDefault();

      switch (evt.keyCode) {

        case this.KEY_UP:
          this._cpu.pressUp();
          break;

        case this.KEY_DOWN:
          this._cpu.pressDown();
          break;

        case this.KEY_LEFT:
          this._cpu.pressLeft();
          break;

        case this.KEY_RIGHT:
          this._cpu.pressRight();
          break;

        case this.KEY_X:
          this._cpu.pressA();
          break;

        case this.KEY_Z:
          this._cpu.pressB();
          break;

        case this.KEY_ENTER:
        case this.KEY_SPACE:
          this._cpu.pressSTART();
          break;

        case this.KEY_CTRL:
          this._cpu.pressSELECT();
          break;
      }
    }

    /**
     * @param evt
     */

  }, {
    key: 'onKeyUp',
    value: function onKeyUp(evt) {

      evt.preventDefault();

      switch (evt.keyCode) {

        case this.KEY_UP:
          this._cpu.mmu.liftUp();
          break;

        case this.KEY_DOWN:
          this._cpu.mmu.liftDown();
          break;

        case this.KEY_LEFT:
          this._cpu.mmu.liftLeft();
          break;

        case this.KEY_RIGHT:
          this._cpu.mmu.liftRight();
          break;

        case this.KEY_X:
          this._cpu.mmu.liftA();
          break;

        case this.KEY_Z:
          this._cpu.mmu.liftB();
          break;

        case this.KEY_ENTER:
        case this.KEY_SPACE:
          this._cpu.mmu.liftSTART();
          break;

        case this.KEY_CTRL:
          this._cpu.mmu.liftSELECT();
          break;
      }
    }
  }]);

  return InputHandler;
}();

exports.default = InputHandler;

},{}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LCD = function () {

  /**
   * @param {MMU|MMUMock} mmu
   * @param {CanvasRenderingContext2D|ContextMock} ctx
   */
  function LCD(mmu, ctx) {
    _classCallCheck(this, LCD);

    // Public constants
    this.TILE_WIDTH = 8;
    this.SHADES = {
      0: [155, 188, 15, 255],
      1: [139, 172, 15, 255],
      2: [48, 98, 48, 255],
      3: [15, 56, 15, 255]
    };

    // Constants
    this._OUT_WIDTH = 256;
    this._OUT_HEIGHT = 256;
    this._HW_WIDTH = 160;
    this._HW_HEIGHT = 144;
    this._MIN_WINDOW_X = this.TILE_WIDTH - 1;
    this._MAX_WINDOW_X = this._HW_WIDTH + this._MIN_WINDOW_X - 1;
    this._TILE_HEIGHT = this.TILE_WIDTH;
    this._MAX_TILE_HEIGHT = 2 * this._TILE_HEIGHT;
    this._H_TILES = this._HW_WIDTH / this.TILE_WIDTH;
    this._V_TILES = this._HW_HEIGHT / this._TILE_HEIGHT;

    this._mmu = mmu;
    this._ctx = ctx;
    this._bgp = null;
    this._bgn = null; // will hold array of 8 bg colour palettes
    this._obg0 = null;
    this._obg1 = null;
    this._objn = null; // will hold array of 8 obj colour palettes
    this._imageData = this._ctx.createImageData(this._HW_WIDTH, this._HW_HEIGHT);
    this._IS_COLOUR = this._mmu.isGameInColor();
    this._bgLineFlags = []; // will contain 160 bit flags, 1 when bg/win is first color palette

    this._clear();
    this._readPalettes();

    this.paint();
  }

  _createClass(LCD, [{
    key: 'getImageData',
    value: function getImageData() {
      return this._imageData;
    }

    /**
     * @param {number} line 0..143
     */

  }, {
    key: 'drawLine',
    value: function drawLine(line) {
      if (line < 0 || line >= this._HW_HEIGHT) {
        _logger2.default.warn('Cannot draw line ' + line);
        return;
      }
      this._bgLineFlags = []; // reset each line
      this._readPalettes();
      this._drawLineBG(line);
      if (this._mmu.isWindowOn()) this._drawLineWindow(line);
      if (this._mmu.areOBJOn()) this._drawLineOBJ(line);
    }

    /**
     * @param {number} coord 0..143
     * @param {number} coordOffset 0..255
     * @returns {number} 0..31
     */

  }, {
    key: 'getVerticalGrid',
    value: function getVerticalGrid(coord, coordOffset) {
      return Math.floor((coord + coordOffset) % this._OUT_HEIGHT / this._TILE_HEIGHT);
    }

    /**
     * Writes (paints) the imageData into the actual HTML canvas (refresh)
     * NOTE: EXPENSIVE, should be called once per frame (not per line)
     */

  }, {
    key: 'paint',
    value: function paint() {
      this._ctx.putImageData(this._imageData, 0, 0);
    }

    /**
     * Draws pixel in image data, given its coords and palette data nb
     *
     * @param {number} x
     * @param {number} y
     * @param {number} paletteDataNb 0-3
     * @param {Array} palette
     * @param {boolean} isOBJ
     */

  }, {
    key: 'drawPixel',
    value: function drawPixel(_ref) {
      var x = _ref.x,
          y = _ref.y,
          paletteDataNb = _ref.paletteDataNb;
      var palette = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._bgp;
      var isOBJ = arguments[2];


      if (paletteDataNb < 0 || paletteDataNb > 3) {
        _logger2.default.error('Unrecognized palette data nb ' + paletteDataNb);
        return;
      }

      if (x < 0 || y < 0 || x >= this._HW_WIDTH || y >= this._HW_HEIGHT) return;

      if (isOBJ) {
        if (paletteDataNb === 0) return;
      } else {
        // bg or window
        if (paletteDataNb === 0) {
          this._bgLineFlags[x] = 1;
        } else {
          this._bgLineFlags[x] = 0;
        }
      }

      this._setPixelData(x, y, palette[paletteDataNb]);
    }

    /** 
     * Clears the LCD by writing transparent pixels
     * @private
     */

  }, {
    key: '_clear',
    value: function _clear() {
      var size = this._HW_WIDTH * this._HW_HEIGHT * 4;
      for (var p = 0; p < size; p++) {
        this._imageData.data[p] = 0;
      }
    }

    /**
     * @param {number} line
     * @private
     */

  }, {
    key: '_drawLineBG',
    value: function _drawLineBG(line) {
      var max = this._OUT_WIDTH;
      var scx = this._mmu.scx();
      var scy = this._mmu.scy();
      if (scx === 0) {
        max = this._HW_WIDTH;
      }
      var tileLine = (line + scy) % this._OUT_HEIGHT % this._TILE_HEIGHT;

      for (var x = 0; x < max; x += this.TILE_WIDTH) {
        var gridX = this._getHorizontalGrid(x);
        var gridY = this.getVerticalGrid(line, scy);
        var tileNumber = this._mmu.getBgCharCode(gridX, gridY);
        var palette = this._bgp;
        if (this._IS_COLOUR) {
          palette = this._bgn[this._mmu.getBgPaletteNb(gridX, gridY)];
        }
        this._drawTileLine({
          tileNumber: tileNumber,
          tileLine: tileLine,
          startX: this._getScrolledX(x, scx)
        }, line, true /* isBG */, palette);
      }
    }

    /**
     * @param x
     * @param scx
     * @returns {number}
     * @private
     */

  }, {
    key: '_getScrolledX',
    value: function _getScrolledX(x, scx) {
      return (x + this._OUT_WIDTH - scx) % this._OUT_WIDTH;
    }

    /**
     * @param {number} line
     * @private
     */

  }, {
    key: '_drawLineOBJ',
    value: function _drawLineOBJ(line) {
      var doubleOBJ = this._mmu.areOBJDouble();

      for (var n = 0; n < this._mmu.MAX_OBJ; n++) {
        var OBJ = this._mmu.getOBJ(n);
        if (LCD._isValidOBJ(OBJ)) {

          var chrCode = OBJ.chrCode;
          if (doubleOBJ && chrCode % 2 !== 0) {
            chrCode -= 1; // nearest even down
          }

          var topTileY = OBJ.y;
          var bottomTileY = OBJ.y + this._TILE_HEIGHT;
          var palette = this._getOBJPalette(OBJ.attr);

          if (doubleOBJ) {
            if (this._isFlipY(OBJ.attr)) {
              // Swap
              topTileY = OBJ.y + this._TILE_HEIGHT;
              bottomTileY = OBJ.y;
            }
            if (this._isOBJInLine(line, bottomTileY)) {
              this._drawTileLine({
                tileNumber: chrCode + 1,
                tileLine: line - (bottomTileY - this._MAX_TILE_HEIGHT),
                startX: OBJ.x - this.TILE_WIDTH,
                OBJAttr: OBJ.attr
              }, line, false /* isBg */, palette);
            }
          }

          if (this._isOBJInLine(line, topTileY)) {
            this._drawTileLine({
              tileNumber: chrCode,
              tileLine: line - (topTileY - this._MAX_TILE_HEIGHT),
              startX: OBJ.x - this.TILE_WIDTH,
              OBJAttr: OBJ.attr
            }, line, false /* isBg */, palette);
          }
        }
      }
    }

    /**
     * @param {number} line
     * @private
     */

  }, {
    key: '_drawLineWindow',
    value: function _drawLineWindow(line) {
      var wy = this._mmu.wy();
      var wx = this._mmu.wx();
      if (wx < this._MIN_WINDOW_X) wx = this._MIN_WINDOW_X;

      if (line - wy < 0 || wx > this._MAX_WINDOW_X) return;

      for (var x = 0; x < this._HW_WIDTH; x += this.TILE_WIDTH) {
        var gridX = this._getHorizontalGrid(x);
        var gridY = this.getVerticalGrid(line - wy, 0);
        var tileNumber = this._mmu.getWindowCharCode(gridX, gridY);
        var palette = this._bgp;

        if (this._IS_COLOUR) {
          palette = this._bgn[this._mmu.getWindowPaletteNb(gridX, gridY)];
        }

        this._drawTileLine({
          tileNumber: tileNumber,
          tileLine: (line - wy) % this._TILE_HEIGHT,
          startX: x + wx - this._MIN_WINDOW_X
        }, line, false /* isBg */, palette);
      }
    }

    /**
     * @param {number} coord 0..255
     * @returns {number} 0..31
     * @private
     */

  }, {
    key: '_getHorizontalGrid',
    value: function _getHorizontalGrid(coord) {
      return Math.floor(coord / this._TILE_HEIGHT);
    }

    /**
     * @param tileNumber
     * @param tileLine
     * @param startX
     * @param OBJAttr
     * @param line
     * @param isBG
     */

  }, {
    key: '_drawTileLine',
    value: function _drawTileLine(_ref2, line, isBG) {
      var tileNumber = _ref2.tileNumber,
          tileLine = _ref2.tileLine,
          startX = _ref2.startX,
          OBJAttr = _ref2.OBJAttr;
      var palette = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this._bgp;


      var isOBJ = OBJAttr !== undefined;
      var intensityVector = this._getIntensityVector(tileNumber, tileLine, isOBJ);

      if (isOBJ) {
        intensityVector = this._handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr);
      }

      for (var i = 0; i < intensityVector.length; i++) {
        var x = startX + i;
        if (isBG) {
          x %= this._OUT_WIDTH;
        }
        if (isOBJ) {
          if (this._hasBgPriority(OBJAttr)) {
            if (this._isBgPixelFirstPaletteColor(x, line)) {
              this.drawPixel({ x: x, y: line, paletteDataNb: intensityVector[i] }, palette, isOBJ);
            }
          } else {
            this.drawPixel({ x: x, y: line, paletteDataNb: intensityVector[i] }, palette, isOBJ);
          }
        } else {
          this.drawPixel({ x: x, y: line, paletteDataNb: intensityVector[i] }, palette, isOBJ);
        }
      }
      return intensityVector;
    }

    /**
     * @param x
     * @param y
     * @returns {boolean} true if the pixel in background is painted with the first colour from
     * the background palette
     * @private
     */

  }, {
    key: '_isBgPixelFirstPaletteColor',
    value: function _isBgPixelFirstPaletteColor(x, y) {
      var data = this._getPixelData(x, y);
      if (this._IS_COLOUR) {
        return this._bgLineFlags[x] === 1;
      } else {
        return data[0] === this._bgp[0][0] && data[1] === this._bgp[0][1] && data[2] === this._bgp[0][2] && data[3] === this._bgp[0][3];
      }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Array} value
     * @private
     */

  }, {
    key: '_setPixelData',
    value: function _setPixelData(x, y, value) {
      this._imageData.data.set(value, (x + y * this._HW_WIDTH) * 4);
    }

    /**
     * @param x
     * @param y
     * @param imageData
     * @returns {Array}
     * @private
     */

  }, {
    key: '_getPixelData',
    value: function _getPixelData(x, y) {
      var index = (x + y * this._HW_WIDTH) * 4;
      return this._imageData.data.slice(index, index + 4);
    }

    /**
     * Reads palettes
     * @private
     */

  }, {
    key: '_readPalettes',
    value: function _readPalettes() {
      if (this._IS_COLOUR) {
        this._bgn = this._transformPalettesFromMemory(this._mmu.getBgPalette);
        this._objn = this._transformPalettesFromMemory(this._mmu.getObjPalette);
      } else {
        this._bgp = this._generatePalette(this._mmu.bgp());
        this._obg0 = this._generatePalette(this._mmu.obg0());
        this._obg1 = this._generatePalette(this._mmu.obg1());
      }
    }

    /**
     * @param {function} mmuCallFn
     * @returns {Array}
     * @private
     */

  }, {
    key: '_transformPalettesFromMemory',
    value: function _transformPalettesFromMemory(mmuCallFn) {
      var array = [];
      for (var p = 0; p < 8; p++) {
        var rgb15Palette = mmuCallFn.call(this._mmu, p);
        var rgba32Palette = rgb15Palette.map(function (i) {
          return LCD.RGB15toRGBA32(i);
        });
        array.push(rgba32Palette);
      }
      return array;
    }

    /**
     * @param source
     * @private
     */

  }, {
    key: '_generatePalette',
    value: function _generatePalette(source) {
      var palette = [];
      var bgpOrder = LCD.paletteToArray(source);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = bgpOrder[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var i = _step.value;

          palette.push(this.SHADES[i]);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return palette;
    }

    /**
     * @param {number} line
     * @param {number} y
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isOBJInLine',
    value: function _isOBJInLine(line, y) {
      var offset = y - this._MAX_TILE_HEIGHT;
      return line >= offset && line < offset + this._TILE_HEIGHT;
    }

    /**
     * @param {number} OBJAttr
     * @returns {Array}
     * @private
     */

  }, {
    key: '_getOBJPalette',
    value: function _getOBJPalette(OBJAttr) {
      if (this._IS_COLOUR) {
        return this._objn[OBJAttr & 0x07];
      } else {
        if ((OBJAttr & this._mmu.MASK_OBJ_ATTR_OBG) === 0) {
          return this._obg0;
        } else {
          return this._obg1;
        }
      }
    }

    /**
     * @param {Array} intensityVector
     * @param {number} tileNumber
     * @param {number} tileLine
     * @param {number} OBJAttr
     * @private
     */

  }, {
    key: '_handleOBJAttributes',
    value: function _handleOBJAttributes(intensityVector, tileNumber, tileLine, OBJAttr) {
      // Flipping order matters
      if (this._isFlipY(OBJAttr)) {
        intensityVector = this._getIntensityVector(tileNumber, this._getVerticalMirrorLine(tileLine), true);
      }
      if (this._isFlipX(OBJAttr)) {
        var copy = intensityVector.slice();
        copy.reverse();
        intensityVector = copy;
      }
      return intensityVector;
    }

    /**
     * @param OBJAttr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_hasBgPriority',
    value: function _hasBgPriority(OBJAttr) {
      return (OBJAttr & this._mmu.MASK_OBJ_ATTR_PRIORITY) === this._mmu.MASK_OBJ_ATTR_PRIORITY;
    }

    /**
     * @param OBJAttr
     * @returns {boolean} true if the object should be flipped vertically
     * @private
     */

  }, {
    key: '_isFlipY',
    value: function _isFlipY(OBJAttr) {
      return (OBJAttr & this._mmu.MASK_OBJ_ATTR_VFLIP) === this._mmu.MASK_OBJ_ATTR_VFLIP;
    }

    /**
     * @param OBJAttr
     * @returns {boolean} true if the object should be flipped horizontally
     * @private
     */

  }, {
    key: '_isFlipX',
    value: function _isFlipX(OBJAttr) {
      return (OBJAttr & this._mmu.MASK_OBJ_ATTR_HFLIP) === this._mmu.MASK_OBJ_ATTR_HFLIP;
    }
  }, {
    key: '_getCharCodeByPx',
    value: function _getCharCodeByPx(x, y) {
      return this._mmu.getBgCharCode(this._getHorizontalGrid(this._getScrolledX(x, this._mmu.scx())), this.getVerticalGrid(y, this._mmu.scy()));
    }

    /**
     * @param tileLine
     * @returns {number}
     * @private
     */

  }, {
    key: '_getVerticalMirrorLine',
    value: function _getVerticalMirrorLine(tileLine) {
      return Math.abs(this._TILE_HEIGHT - 1 - tileLine);
    }

    /**
     * Calculates palette matrix given a tile number.
     * Expensive operation.
     * @param {number} tileNumber
     * @param {number} tileLine
     * @param {boolean} isOBJ
     * @returns {Array}
     * @private
     */

  }, {
    key: '_getIntensityVector',
    value: function _getIntensityVector(tileNumber, tileLine, isOBJ) {
      var tileLineData = void 0;
      if (isOBJ) {
        tileLineData = this._mmu.readOBJData(tileNumber, tileLine);
      } else {
        tileLineData = this._mmu.readBGData(tileNumber, tileLine);
      }
      return LCD.tileToIntensityVector(tileLineData);
    }

    /**
     * Converts a 16 bits tile buffer into array of levels [0-3]
     * Example:
     * 0x0000 -> [0,0,0,0,0,0,0,0]
     * 0xff00 -> [1,1,1,1,1,1,1,1]
     * 0x00ff -> [2,2,2,2,2,2,2,2]
     * 0xffff -> [3,3,3,3,3,3,3,3]
     *
     * @param {Buffer} tileLineData (2 bytes)
     * @returns {Array} intensity vector
     */

  }], [{
    key: 'tileToIntensityVector',
    value: function tileToIntensityVector(tileLineData) {
      var array = [];

      var msb = _utils2.default.toBin8(tileLineData[0]);
      var lsb = _utils2.default.toBin8(tileLineData[1]);

      for (var b = 0; b < 8; b++) {
        array.push((parseInt(lsb[b], 2) << 1) + parseInt(msb[b], 2));
      }
      return array;
    }

    /**
     * @param {Object} OBJ
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isValidOBJ',
    value: function _isValidOBJ(OBJ) {
      if (OBJ == null) return false;
      return OBJ.x !== 0 || OBJ.y !== 0 || OBJ.chrCode !== 0 || OBJ.attr !== 0;
    }

    /**
     * @param byte, example: 11100100
     * @returns {Array} example: [0,1,2,3]
     */

  }, {
    key: 'paletteToArray',
    value: function paletteToArray(byte) {
      var array = [];
      [0, 2, 4, 6].map(function (shift) {
        array.push(byte >> shift & 0x03);
      });
      return array;
    }

    /**
     * @param {Array} rgb15
     * @returns {Array} rgba32
     * @constructor
     */

  }, {
    key: 'RGB15toRGBA32',
    value: function RGB15toRGBA32(rgb15) {
      var rgba24 = rgb15.map(function (i) {
        return i * 527 + 23 >> 6;
      }); // approximation
      rgba24.push(255);
      return rgba24;
    }
  }]);

  return LCD;
}();

exports.default = LCD;

},{"./logger":12,"./utils":15}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Logger = function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, null, [{
    key: 'state',


    /**
     * Logs the current instruction and state of registers
     * @param cpu
     * @param fn
     * @param paramLength
     * @param param
     */
    value: function state(cpu, fn, paramLength, param) {
      if (_config2.default.DEBUG) {
        console.info('[' + _utils2.default.hex4(cpu.pc() - paramLength - 1) + '] ' + _utils2.default.str20(fn.name + ' ' + _utils2.default.hexStr(param)) + ' 0b' + cpu.Z() + cpu.N() + cpu.H() + cpu.C() + '  a:' + _utils2.default.hex2(cpu.a()) + ' bc:' + _utils2.default.hex4(cpu.bc()) + ' de:' + _utils2.default.hex4(cpu.de()) + ' hl:' + _utils2.default.hex4(cpu.hl()) + ' sp:' + _utils2.default.hex4(cpu.sp()) + ' pc:' + _utils2.default.hex4(cpu.pc()) + ' if:' + _utils2.default.hex2(cpu.If()) + ' ie:' + _utils2.default.hex2(cpu.ie()) + ' ly:' + _utils2.default.hex2(cpu.mmu.ly()) + ' lcdc:' + _utils2.default.hex2(cpu.lcdc()) + ' stat:' + _utils2.default.hex2(cpu.stat()));
      }
    }
  }, {
    key: 'beforeCrash',
    value: function beforeCrash(cpu, instructionFn, paramLength, param) {
      _config2.default.DEBUG = true;
      Logger.state(cpu, instructionFn, paramLength, param);
      _config2.default.DEBUG = false;
    }
  }, {
    key: 'warn',
    value: function warn(msg) {
      if (!_config2.default.TEST) {
        console.warn('' + msg);
      }
    }
  }, {
    key: 'info',
    value: function info(msg) {
      if (_config2.default.DEBUG && !_config2.default.TEST) {
        console.info('' + msg);
      }
    }
  }, {
    key: 'error',
    value: function error(msg) {
      if (!_config2.default.TEST) {
        console.error('' + msg);
      }
    }
  }]);

  return Logger;
}();

exports.default = Logger;

},{"./config":7,"./utils":15}],13:[function(require,module,exports){
(function (Buffer){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MMU = function () {

  /**
   * @param {Uint8Array} rom
   * @param {BrowserStorage|StorageMock|undefined} storage
   */
  function MMU(rom, storage) {
    _classCallCheck(this, MMU);

    if (!rom) throw new Error('Missing ROM');

    // Addresses
    this.ADDR_GAME_START = 0x100;
    this.ADDR_NINTENDO_GRAPHIC_START = 0x104;
    this.ADDR_NINTENDO_GRAPHIC_END = 0x133;
    this.ADDR_TITLE_START = 0x134;
    this.ADDR_TITLE_END = 0x142;
    this.ADDR_IS_GB_COLOR = 0x143;
    this.ADDR_IS_SGB = 0x146;
    this.ADDR_CARTRIDGE_TYPE = 0x147;
    this.ADDR_ROM_SIZE = 0x148;
    this.ADDR_RAM_SIZE = 0x149;
    this.ADDR_DESTINATION_CODE = 0x14a;
    this.ADDR_COMPLEMENT_CHECK = 0x14d;

    this.ADDR_MBC1_REG1_START = 0x2000;
    this.ADDR_MBC5_ROMB1_START = 0x3000;
    this.ADDR_ROM_BANK_START = 0x4000;
    this.ADDR_MBC1_REG2_START = 0x4000;
    this.ADDR_MBC1_REG3_START = 0x6000;
    this.ADDR_MBC1_REG3_END = 0x7fff;
    this.ADDR_ROM_BANK_END = 0x7fff;
    this.ADDR_ROM_MAX = this.ADDR_ROM_BANK_END;

    // VRAM
    this.ADDR_VRAM_START = 0x8000;
    this.ADDR_OBJ_DATA_START = 0x8000;
    this.BG_CHAR_DATA_8000 = 0x8000;
    this.BG_CHAR_DATA_8800 = 0x8800;
    this.BG_CHAR_DATA_9000 = 0x9000;
    this.ADDR_DISPLAY_DATA_1 = 0x9800;
    this.ADDR_DISPLAY_DATA_2 = 0x9c00;
    this.ADDR_VRAM_END = 0x9fff;

    // CGB extra RAM
    this.CGB_VRAM_BANK_SIZE = 0x2000; // 8KB

    // External RAM
    this.ADDR_EXT_RAM_START = 0xa000;

    // Working RAM
    this.ADDR_WRAM_START = 0xc000;
    this.ADDR_WRAM_END = 0xdfff;
    this.ADDR_WRAM_CGB_UPPER_BANK_START = 0xd000;
    this.CGB_VRAM_SIZE = 0x8000 - 0x2000; // cgb size - already in dmg
    this.SVBK_MASK_BANK = 0x07;
    this.WRAM_CGB_BANK_SIZE = 0x1000;

    // High working RAM
    this.ADDR_HRAM_END = 0xfffd;

    // OAM
    this.ADDR_OAM_START = 0xfe00;
    this.ADDR_OAM_END = 0xfe9f;

    // IO
    this.ADDR_P1 = 0xff00;
    this.ADDR_SB = 0xff01;
    this.ADDR_SC = 0xff02;
    this.ADDR_DIV = 0xff04;
    this.ADDR_TIMA = 0xff05;
    this.ADDR_TMA = 0xff06;
    this.ADDR_TAC = 0xff07;
    this.ADDR_IF = 0xff0f;
    this.ADDR_LCDC = 0xff40;
    this.ADDR_STAT = 0xff41;
    this.ADDR_SCY = 0xff42;
    this.ADDR_SCX = 0xff43;
    this.ADDR_LY = 0xff44;
    this.ADDR_LYC = 0xff45;
    this.ADDR_DMA = 0xff46;
    this.ADDR_BGP = 0xff47;
    this.ADDR_OBG0 = 0xff48;
    this.ADDR_OBG1 = 0xff49;
    this.ADDR_WY = 0xff4a;
    this.ADDR_WX = 0xff4b;
    this.ADDR_KEY1 = 0xff4d;
    this.ADDR_VBK = 0xff4f;
    this.ADDR_BCPS = 0xff68;
    this.ADDR_BCPD = 0xff69;
    this.ADDR_OCPS = 0xff6a;
    this.ADDR_OCPD = 0xff6b;
    this.ADDR_SVBK = 0xff70;
    this.ADDR_IE = 0xffff;
    this.ADDR_MAX = 0xffff;

    // LCDC
    this.LCDC_ON = 0x80;
    this.LCDC_WINDOW = 0x20;
    this.LCDC_BG = 0x01;
    this.LCDC_LINE_VBLANK = 0x90; // 114

    // P1 masks
    this.MASK_P1_RW = 0xcf;
    this.MASK_P14 = 0x20;
    this.MASK_P10_P13 = 0xf0;
    this.MASK_P1_RIGHT_ON = this.MASK_P1_A_ON = 0xfe;
    this.MASK_P1_LEFT_ON = this.MASK_P1_B_ON = 0xfd;
    this.MASK_P1_UP_ON = this.MASK_P1_SELECT_ON = 0xfb;
    this.MASK_P1_DOWN_ON = this.MASK_P1_START_ON = 0xf7;
    this.MASK_P1_RIGHT_OFF = this.MASK_P1_A_OFF = 0x01;
    this.MASK_P1_LEFT_OFF = this.MASK_P1_B_OFF = 0x02;
    this.MASK_P1_UP_OFF = this.MASK_P1_SELECT_OFF = 0x04;
    this.MASK_P1_DOWN_OFF = this.MASK_P1_START_OFF = 0x08;

    // LCDC masks
    this.MASK_BG_CHAR_DATA = 0x10;
    this.MASK_WINDOW_ON = 0x20;
    this.MASK_WINDOW_OFF = 0xdf;
    this.MASK_OBJ_ON = 0x02;
    this.MASK_OBJ_OFF = 0xfd;
    this.MASK_OBJ_8x16_ON = 0x04;
    this.MASK_OBJ_8x16_OFF = 0xfb;
    this.MASK_BG_ON = 0x01;
    this.MASK_BG_OFF = 0xfe;

    this.MASK_BG_CHAR_DATA_8000 = 0x10;
    this.MASK_BG_CHAR_DATA_8800 = 0xef;
    this.MASK_BG_CODE_AREA_1 = 0xf7;
    this.MASK_BG_CODE_AREA_2 = 0x08;
    this.MASK_WINDOW_CODE_AREA_0 = 0xbf;
    this.MASK_WINDOW_CODE_AREA_1 = 0x40;

    // STAT masks
    this.MASK_STAT_MODE = 0x03;
    this.MASK_STAT_LYC_ON = 0x04;
    this.MASK_STAT_LYC_OFF = 0xfb;
    this.MASK_STAT_LYC_INTERRUPT = 0x40;

    this.MASK_OBJ_ATTR_PRIORITY = 0x80;
    this.MASK_OBJ_ATTR_VFLIP = 0x40;
    this.MASK_OBJ_ATTR_HFLIP = 0x20;
    this.MASK_OBJ_ATTR_OBG = 0x10;
    this.STAT_INTERRUPT_MODE_UNSUPPORTED = 0x38;

    // IF masks
    this.IF_TIMER_ON = 4;
    this.IF_TIMER_OFF = 27;
    this.IF_STAT_ON = 2;
    this.IF_STAT_OFF = 29;

    // Character Data
    this.CHAR_LINE_SIZE = 2;

    // LCD
    this.NUM_LINES = 153;
    this.CHARS_PER_LINE = 32;
    this.VISIBLE_CHARS_PER_LINE = 20;

    // Timer
    this.MASK_TIMER_ON = 0x04;
    this.TAC_MASK_CLOCK = 0x03;

    // OBJ
    this.MAX_OBJ = 40;
    this.BYTES_PER_OBJ = 4;

    // DMA
    this.DMA_LENGTH = 0xa0;

    // Values
    this.IS_GB_COLOR = 0x80;
    this.IS_GBC_ONLY = 0xc0;

    // Cartridge types
    this._ROM_ONLY = 0;
    this._ROM_MBC1 = 1;
    this._ROM_MBC1_RAM = 2;
    this._ROM_MBC1_RAM_BATT = 3;
    this._ROM_MBC2 = 5;
    this._ROM_MBC2_BATTERY = 6;
    this._ROM_RAM = 8;
    this._ROM_RAM_BATTERY = 9;
    this._ROM_MMM01 = 0xb;
    this._ROM_MMM01_SRAM = 0xc;
    this._ROM_MMM01_SRAM_BATT = 0xd;
    this._ROM_MBC3_TIMER_BATT = 0xf;
    this._ROM_MBC3_TIMER_RAM_BATT = 0x10;
    this._ROM_MBC3 = 0x11;
    this._ROM_MBC3_RAM = 0x12;
    this._ROM_MBC3_RAM_BATT = 0x13;
    this._ROM_MBC5 = 0x19;
    this._ROM_MBC5_RAM = 0x1a;
    this._ROM_MBC5_RAM_BATT = 0x1b;
    this._ROM_MBC5_RUMBLE = 0x1c;
    this._ROM_MBC5_RUMBLE_SRAM = 0x1d;
    this._ROM_MBC5_RUMBLE_SRAM_BATT = 0x1e;
    this._POCKET_CAMERA = 0xfc;
    this._BANDAI_TAMA5 = 0xfd;
    this._HUC3 = 0xfe;
    this._HUC1_RAM_BATTERY = 0xff;

    // Rom sizes
    this._32KB = 0;
    this._64KB = 1;
    this._128KB = 2;
    this._256KB = 3;
    this._512KB = 4;
    this._1MB = 5;
    this._1_1MB = 0x52;
    this._1_2MB = 0x53;
    this._1_5MB = 0x54;
    this._2MB = 6;

    // RAM Size
    this.RAM_NONE = 0x0;
    this.RAM_2KB = 0x1;
    this.RAM_8KB = 0x2;
    this.RAM_32KB = 0x3;
    this.RAM_128KB = 0x4;

    // Destination codes
    this.JAPANESE = 0x0;
    this.NON_JAPANESE = 0x1;

    // MBC1
    this.MBC1_ROM_BANK_SIZE = 0x4000;
    this.MBC1_RAM_BANK_SIZE = 0x2000;
    this.MBC1_MAX_ROM_BANK_NB = 0x1f; // 0..31
    this.MBC1_RAM_BANKS = 4;
    this.MBC1_RAM_SIZE = this.MBC1_RAM_BANK_SIZE * this.MBC1_RAM_BANKS;
    this.MBC1_CSRAM_ON = 0x0a;

    // MBC3
    this.MBC3_RAM_BANK_SIZE = this.MBC1_RAM_BANK_SIZE;
    this.MBC3_MAX_ROM_BANK_NB = 0x7f; // 0..127
    this.MBC3_RAM_BANKS = this.MBC1_RAM_BANKS;
    this.MBC3_RAM_SIZE = this.MBC1_RAM_SIZE;
    this.MBC3_CSRAM_ON = this.MBC1_CSRAM_ON;

    // MBC5
    this.MBC5_RAM_BANK_SIZE = this.MBC1_RAM_BANK_SIZE;
    this.MBC5_CSRAM_ON = this.MBC1_CSRAM_ON;
    this.MBC5_RAM_BANKS = 16;
    this.MBC5_RAM_SIZE = this.MBC5_RAM_BANK_SIZE * this.MBC5_RAM_BANKS;

    this.PALETTES_SIZE = 64;

    // Variables
    this._rom = rom;
    this._storage = storage;
    this._extRAM; // init only if there is a Memory Bank Controller
    this._memory = new Uint8Array(this.ADDR_MAX + 1);
    this._CGB_VRAM_bank1 = new Uint8Array(this.CGB_VRAM_BANK_SIZE);
    this._CGB_WRAM = new Uint8Array(this.CGB_VRAM_SIZE);
    this._bgPalettes = new Uint8Array(this.PALETTES_SIZE);
    this._objPalettes = new Uint8Array(this.PALETTES_SIZE);
    this._BgPaletteAddr = 0;
    this._objPaletteAddr = 0;
    this._autoNextBgPalette = false;
    this._autoNextObjPalette = false;
    this._isDMA = false;
    this._buttons = 0x0f; // Buttons unpressed, on HIGH
    this._div = 0x0000; // Internal divider, register DIV is msb
    this._hasMBC1 = false;
    this._hasMBC1RAM = false;
    this._hasMBC3RAM = false;
    this._canAccessMBC1RAM = false;
    this._canAccessMBC3RAM = false;
    this._canAccessMBC5RAM = false;
    this._selectedROMBankNb = 1; // default is bank 1
    this._selectedUpperROMBankNb = 0; // used only if rom > 512 KB
    this._isUpperROMBankSelected = true; // false if RAM
    this._selectedRAMBankNb = 0;

    this.isCartridgeSupported();
    this._initMemory();
    this._initMemoryBankController();
  }

  /**
   * @param {Uint8Array} palette
   * @param paletteNb 0-7
   * @param paletteData 0-3
   * @returns {Array} 15-bit RGB, 5 bit per channel (0-0x1f)
   * @private
   */


  _createClass(MMU, [{
    key: '_getRGB',
    value: function _getRGB(palette, paletteNb, paletteData) {
      var start = paletteNb * 8 + paletteData * 2;
      var l = palette[start];
      var h = palette[start + 1];
      var rgb = [];
      rgb.push(l & 0x1f);
      rgb.push((l >> 5 & 7) + ((h & 3) << 3));
      rgb.push(h >> 2 & 0x1f);
      return rgb;
    }
  }, {
    key: 'setDMA',
    value: function setDMA(isDMA) {
      this._isDMA = isDMA;
    }
  }, {
    key: 'isDMA',
    value: function isDMA() {
      return this._isDMA;
    }
  }, {
    key: 'getExtRAM',
    value: function getExtRAM() {
      return this._extRAM;
    }
  }, {
    key: 'getSavedRAM',
    value: function getSavedRAM() {
      if (!this._storage) return null;
      return this._storage.read(this.getGameTitle());
    }

    /**
     * Flushes the external RAM to permanent storage.
     * This is a costly operation in browsers (localStorage),
     * hence, should only be performed when the user stops playing.
     */

  }, {
    key: 'flushExtRamToStorage',
    value: function flushExtRamToStorage() {
      if (this._hasMBC1RAM || this._hasMBC3RAM || this._hasMBC5RAM) this._storage.write(this.getGameTitle(), this._extRAM);
    }

    /**
     * @private
     */

  }, {
    key: '_initMemoryBankController',
    value: function _initMemoryBankController() {
      var type = this._rom[this.ADDR_CARTRIDGE_TYPE];
      this._hasMBC1 = type === 1 || type === 2 || type === 3;
      this._hasMBC1RAM = type === 2 || type === 3;
      this._hasMBC3 = type === 0x11 || type === 0x12 || type === 0x13;
      this._hasMBC3RAM = type === 0x12 || type === 0x13;
      this._hasMBC5RAM = type === this._ROM_MBC5_RAM || type === this._ROM_MBC5_RAM_BATT;
      this._hasMBC5 = this._hasMBC5RAM || type === this._ROM_MBC5 || type === this._ROM_MBC5_RUMBLE || type === this._ROM_MBC5_RUMBLE_SRAM || type === this._ROM_MBC5_RUMBLE_SRAM_BATT;
      this._initExternalRAM();
    }

    /**
     * @private
     */

  }, {
    key: '_initExternalRAM',
    value: function _initExternalRAM() {
      if (this._hasMBC1RAM || this._hasMBC3RAM || this._hasMBC5RAM) {
        if (this._storage != null) {
          var size = this.MBC1_RAM_SIZE; // same as mbc3
          if (this._hasMBC5RAM) size = this.MBC5_RAM_SIZE;
          this._storage.setExpectedGameSize(size);
        }

        var savedRAM = this.getSavedRAM();
        if (savedRAM != null) {
          this._extRAM = savedRAM;
        } else {
          var _size = this.MBC1_RAM_SIZE; // same as mbc3
          if (this._hasMBC5RAM) _size = this.MBC5_RAM_SIZE;
          this._extRAM = new Uint8Array(_size);
        }
      }
    }

    /**
     * @private
     */

  }, {
    key: '_initMemory',
    value: function _initMemory() {
      this._memory.fill(0); // Buffers are created with random data
      this._bgPalettes.fill(0xff); // default is white

      this._memory[this.ADDR_P1] = 0xff;
      this._memory[0xff04] = 0x00;
      this._memory[0xff05] = 0x00;
      this._memory[0xff06] = 0x00;
      this._memory[0xff07] = 0x00;
      this._memory[0xff10] = 0x80;
      this._memory[0xff11] = 0x80;
      this._memory[0xff12] = 0xf3;
      this._memory[0xff13] = 0xc1;
      this._memory[0xff14] = 0x87;
      this._memory[0xff16] = 0x3f;
      this._memory[0xff17] = 0x00;
      this._memory[0xff19] = 0xbf;
      this._memory[0xff1a] = 0x7f;
      this._memory[0xff1b] = 0xff;
      this._memory[0xff1c] = 0x9f;
      this._memory[0xff1e] = 0xbf;
      this._memory[0xff20] = 0xff;
      this._memory[0xff21] = 0x00;
      this._memory[0xff22] = 0x00;
      this._memory[0xff23] = 0xbf;
      this._memory[0xff24] = 0x77;
      this._memory[0xff25] = 0xf3;
      this._memory[0xff26] = 0x80;
      this._memory[0xff40] = 0x91;
      this._memory[0xff41] = 0x80;
      this._memory[0xff44] = 0x00;
      this._memory[0xff47] = 0xfc;
      this._memory[0xff4f] = 0xfe;
      this._memory[0xff50] = 0x01;
      this._memory[this.ADDR_VBK] = 0xfe;
      this._memory[this.ADDR_SVBK] = 0xf8;
      this._memory[0xfffa] = 0x39;
      this._memory[0xfffb] = 0x01;
      this._memory[0xfffc] = 0x2e;
      this._memory[this.ADDR_IF] = 0x00;
      this._memory[this.ADDR_IE] = 0x01;
    }

    /**
     * @param {number} addr
     * @return {number} byte at memory address
     */

  }, {
    key: 'readByteAt',
    value: function readByteAt(addr) {

      if (addr > this.ADDR_MAX || addr < 0) {
        throw new Error('Cannot read memory address ' + _utils2.default.hexStr(addr));
      }

      switch (addr) {
        case this.ADDR_DMA:
        case this.ADDR_SB:
          throw new Error('Unsupported register ' + _utils2.default.hex4(addr));

        case this.ADDR_KEY1:
          _logger2.default.info('Unsupported register ' + _utils2.default.hex4(addr));
          return 0xff;

        case this.ADDR_SC:
          _logger2.default.info('Unsupported register ' + _utils2.default.hex4(addr));
          break;

        case this.ADDR_P1:
          if ((this._memory[addr] & this.MASK_P14) === 0) {
            return this._memory[addr] & this.MASK_P10_P13 | this._buttons;
          }
      }

      if (this._isOAMAddr(addr) && !this._canAccessOAM()) {
        _logger2.default.info('Cannot read OAM');
        return 0xff;
      }
      if (this._isVRAMAddr(addr)) {
        if (!this._canAccessVRAM()) {
          _logger2.default.info('Cannot read VRAM');
          return 0xff;
        }
        if (this.readByteAt(this.ADDR_VBK) === 0xff) {
          return this._CGB_VRAM_bank1[addr - this.ADDR_VRAM_START];
        }
      }
      if (this._isUpperWRAMAddr(addr)) {
        var WRAMBank = this.readByteAt(this.ADDR_SVBK) & this.SVBK_MASK_BANK;
        if (WRAMBank > 1) {
          // banks 0,1 are stored in _memory, as in DMG
          return this._CGB_WRAM[this._getCGBWRAMAddr(addr, WRAMBank)];
        }
      }
      if ((this._hasMBC1 || this._hasMBC3 || this._hasMBC5) && this._isProgramSwitchAddr(addr)) {
        return this._rom[this._getMBC1ROMAddr(addr)];
      }
      if (this._isExtRAMAddr(addr)) {
        if (this._hasMBC1) {
          return this._readMBC1RAM(addr);
        }
        if (this._hasMBC3) {
          return this._readMBC3RAM(addr);
        }
        if (this._hasMBC5) {
          return this._readMBC5RAM(addr);
        }
      }

      if (addr <= this.ADDR_ROM_MAX) {
        return this._rom[addr];
      }

      return this._memory[addr];
    }

    /**
     * @param addr
     * @returns {number}
     * @private
     */

  }, {
    key: '_readMBC1RAM',
    value: function _readMBC1RAM(addr) {
      if (!this._hasMBC1RAM || !this._canAccessMBC1RAM) {
        return 0xff;
      } else {
        return this._extRAM[this._getMBC1RAMAddr(addr)];
      }
    }

    /**
     * @param addr
     * @returns {number}
     * @private
     */

  }, {
    key: '_readMBC3RAM',
    value: function _readMBC3RAM(addr) {
      if (!this._hasMBC3RAM || !this._canAccessMBC3RAM) {
        return 0xff;
      } else {
        return this._extRAM[this._getMBC3RAMAddr(addr)];
      }
    }

    /**
     * @param addr
     * @returns {number}
     * @private
     */

  }, {
    key: '_readMBC5RAM',
    value: function _readMBC5RAM(addr) {
      if (!this._hasMBC5RAM || !this._canAccessMBC5RAM) {
        return 0xff;
      } else {
        return this._extRAM[this._getMBC5RAMAddr(addr)];
      }
    }

    /**
     * Reads buffer from memory
     * @param {number} addr_start, 16 bits
     * @param {number} addr_end, 16 bits (exclusive)
     */

  }, {
    key: 'readBuffer',
    value: function readBuffer(addr_start, addr_end) {
      return this._memory.slice(addr_start, addr_end);
    }

    /**
     * @param {Uint8Array} buffer
     * @param addr_start
     */

  }, {
    key: 'writeBuffer',
    value: function writeBuffer(buffer, addr_start) {
      if (!addr_start) throw new Error('Must indicate start address');
      this._memory.set(buffer, addr_start);
    }

    /**
     * Returns the buffer given a tile number
     * Tiles are numbered from 0x00 to 0xff
     * @param {number} tile_number
     * @param {number} tile_line
     * @returns {Uint8Array}
     */

  }, {
    key: 'readBGData',
    value: function readBGData(tile_number) {
      var tile_line = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      if (tile_number < 0 || tile_number > 0xff) {
        throw new Error('Cannot read tile ' + tile_number);
      }
      if (tile_line < 0 || tile_line > 7) {
        throw new Error('Invalid tile line ' + tile_line);
      }

      if ((this.lcdc() & this.LCDC_BG) === 0) {
        return this._genEmptyCharLineBuffer();
      }

      var start_addr = this.getBgCharDataStartAddr(tile_number) + tile_line * 2;
      return this._memory.slice(start_addr, start_addr + this.CHAR_LINE_SIZE);
    }

    /**
     * @param tileNumber
     * @param tileLine
     * @returns {Uint8Array}
     */

  }, {
    key: 'readOBJData',
    value: function readOBJData(tileNumber, tileLine) {
      if (tileNumber < 0 || tileNumber > 0xff) {
        throw new Error('OBJ ' + tileNumber + ' out of range');
      }
      if (tileLine < 0 || tileLine > 7) {
        throw new Error('Invalid tile line ' + tile_line);
      }

      if ((this.lcdc() & this.MASK_OBJ_ON) === 0) {
        return this._genEmptyCharLineBuffer();
      }

      var start_addr = this.getOBJCharDataStartAddr(tileNumber) + tileLine * 2;
      return this._memory.slice(start_addr, start_addr + this.CHAR_LINE_SIZE);
    }

    /**
     * @returns {Uint8Array} generates an char-line, empty buffer
     * @private
     */

  }, {
    key: '_genEmptyCharLineBuffer',
    value: function _genEmptyCharLineBuffer() {
      return new Buffer(this.CHAR_LINE_SIZE).fill(0);
    }

    /**
     * @param tile_number
     * @returns {number} address
     */

  }, {
    key: 'getBgCharDataStartAddr',
    value: function getBgCharDataStartAddr(tile_number) {
      if (tile_number < 0 || tile_number > 0xff) throw new Error('BG ' + tile_number + ' out of range');

      if ((this.lcdc() & this.MASK_BG_CHAR_DATA) === 0) {
        var start = this.BG_CHAR_DATA_8000;
        if (tile_number < 0x80) {
          start = this.BG_CHAR_DATA_9000;
        }
        return start + (tile_number << 4);
      } else {
        return this.getOBJCharDataStartAddr(tile_number);
      }
    }

    /**
     * @param tile_number
     * @returns {number} address
     */

  }, {
    key: 'getOBJCharDataStartAddr',
    value: function getOBJCharDataStartAddr(tile_number) {
      if (tile_number < 0 || tile_number > 0xff) throw new Error('OBJ ' + tile_number + ' out of range');
      return this.ADDR_OBJ_DATA_START + (tile_number << 4);
    }

    /**
     * Returns the char code given the x,y lcd coordinates
     * @param {number} gridX
     * @param {number} gridY
     * @returns {number} 0..1024
     */

  }, {
    key: 'getBgCharCode',
    value: function getBgCharCode(gridX, gridY) {
      return this._getCharCode(this._getBgDisplayDataStartAddr(), gridX, gridY);
    }

    /**
     * Returns the Char codegiven the x,y lcd coordinates
     * @param {number} gridX
     * @param {number} gridY
     * @returns {number} 0..1024
     */

  }, {
    key: 'getWindowCharCode',
    value: function getWindowCharCode(gridX, gridY) {
      return this._getCharCode(this._getWindowCodeAreaStartAddr(), gridX, gridY);
    }

    /**
     * @param {number} startAddr
     * @param {number} x between 0 and 31
     * @param {number} y between 0 and 31
     * @returns {number} 0..1024
     * @private
     */

  }, {
    key: '_getCharCode',
    value: function _getCharCode(startAddr, gridX, gridY) {
      if (gridX < 0 || gridX > 0x1f || gridY < 0 || gridY > 0x1f) {
        throw new Error('Cannot read tile at coord ' + gridX + ', ' + gridY);
      }
      var addr = startAddr + gridX + gridY * this.CHARS_PER_LINE;
      return this._memory[addr];
    }

    /**
     * @returns {number} start address of the background display data
     * @private
     */

  }, {
    key: '_getBgDisplayDataStartAddr',
    value: function _getBgDisplayDataStartAddr() {
      if ((this.lcdc() & this.MASK_BG_CODE_AREA_2) === 0) {
        return this.ADDR_DISPLAY_DATA_1;
      } else {
        return this.ADDR_DISPLAY_DATA_2;
      }
    }

    /**
     * @returns {number} start address of the Window Code Area
     * @private
     */

  }, {
    key: '_getWindowCodeAreaStartAddr',
    value: function _getWindowCodeAreaStartAddr() {
      if ((this.lcdc() & this.MASK_WINDOW_CODE_AREA_1) === this.MASK_WINDOW_CODE_AREA_1) {
        return this.ADDR_DISPLAY_DATA_2;
      } else {
        return this.ADDR_DISPLAY_DATA_1;
      }
    }

    /**
     * @returns {boolean} true if OBJ are enabled
     */

  }, {
    key: 'areOBJOn',
    value: function areOBJOn() {
      return (this.lcdc() & this.MASK_OBJ_ON) === this.MASK_OBJ_ON;
    }

    /**
     * @returns {boolean} true if OBJ are double (8x16 pixels), false if 8x8 pixels.
     */

  }, {
    key: 'areOBJDouble',
    value: function areOBJDouble() {
      return (this.lcdc() & this.MASK_OBJ_8x16_ON) === this.MASK_OBJ_8x16_ON;
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC1Register',
    value: function _writeMBC1Register(addr, n) {
      if (this._isMBC1Register0Addr(addr) && this._hasMBC1RAM) {
        this._canAccessMBC1RAM = n === this.MBC1_CSRAM_ON;
      }
      if (this._isMBC1Register1Addr(addr)) {
        this._selectROMBank(n);
      }
      if (this._isMBC1Register2Addr(addr)) {
        if (this._hasMBC1RAM && !this._isUpperROMBankSelected) {
          this._selectRAMBank(n);
        } else {
          this._selectUpperROMBank(n);
        }
      }
      if (this._isMBC1Register3Addr(addr)) {
        this._isUpperROMBankSelected = n === 0;
      }
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC3Register',
    value: function _writeMBC3Register(addr, n) {
      if (this._isMBC3Register0Addr(addr) && this._hasMBC3RAM) {
        this._canAccessMBC3RAM = n === this.MBC3_CSRAM_ON;
      }
      if (this._isMBC3Register1Addr(addr)) {
        this._selectROMBank(n);
      }
      if (this._isMBC3Register2Addr(addr) && this._hasMBC3RAM) {
        this._selectRAMBank(n);
      }
      if (this._isMBC3Register3Addr(addr)) {
        throw new Error('Unsupported MBC3 Timers');
      }
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC5Register',
    value: function _writeMBC5Register(addr, n) {
      if (this._isMBC5RAMGAddr(addr) && this._hasMBC5RAM) {
        this._canAccessMBC5RAM = n === this.MBC5_CSRAM_ON;
      }
      if (this._isMBC5ROMB0Addr(addr)) {
        this._selectROMBank(n);
      }
      if (this._isMBC5RAMBAddr(addr) && this._hasMBC5RAM) {
        this._selectMBC5RAMBank(n);
      }
    }

    /**
     * Writes a byte n into address
     * @param {number} 16 bit address
     * @param {number} byte
     */

  }, {
    key: 'writeByteAt',
    value: function writeByteAt(addr, n) {
      if (addr > this.ADDR_MAX || addr < 0) {
        _logger2.default.warn('Cannot set memory address ' + _utils2.default.hexStr(addr));
        return;
      }
      if (addr <= this.ADDR_ROM_MAX) {
        if (this._hasMBC1) {
          this._writeMBC1Register(addr, n);
        } else if (this._hasMBC3) {
          this._writeMBC3Register(addr, n);
        } else if (this._hasMBC5) {
          this._writeMBC5Register(addr, n);
        } else {
          _logger2.default.warn('Cannot write memory address ' + _utils2.default.hexStr(addr));
        }
        return;
      }

      if (n < 0 || n > 0xff) {
        throw new Error('Cannot write value ' + n + ' in memory');
      }
      if (this._isOAMAddr(addr)) {
        if (!this._canAccessOAM()) {
          _logger2.default.info('Cannot write OAM now');
          return;
        }
      }
      if (this._isVRAMAddr(addr)) {
        if (!this._canAccessVRAM()) {
          _logger2.default.info('Cannot write on VRAM now');
          return;
        }
        if (this.readByteAt(this.ADDR_VBK) === 0xff) {
          this._CGB_VRAM_bank1[addr - this.ADDR_VRAM_START] = n;
          return;
        }
      }
      if (this._isUpperWRAMAddr(addr)) {
        var WRAMBank = this.readByteAt(this.ADDR_SVBK) & this.SVBK_MASK_BANK;
        if (WRAMBank > 1) {
          this._CGB_WRAM[this._getCGBWRAMAddr(addr, WRAMBank)] = n;
          return;
        }
      }

      switch (addr) {
        case this.ADDR_P1:
          n = this._memory[addr] & this.MASK_P1_RW | n;
          break;
        case this.ADDR_VBK:
          n |= 0xfe; // Bits 1-7 always set
          break;
        case this.ADDR_SVBK:
          n |= 0xf8; // Bits 3-7 always set
          break;
        case this.ADDR_STAT:
          n |= 0x80; // Bit 7 is always set
          this._handleStatWrite(n);
          break;
        case this.ADDR_LCDC:
          this._handle_lcdc(n);
          break;
        case this.ADDR_DMA:
          this._handleDMA(n);
          break;
        case this.ADDR_DIV:
          this.setHWDivider(0);
          return;
        case this.ADDR_TAC:
          n &= 0x07; // bit 3-7 unused
          break;
        case this.ADDR_BCPS:
          this._handleBCPS(n);
          return;
        case this.ADDR_BCPD:
          this._handleBCPD(n);
          return;
        case this.ADDR_OCPS:
          this._handleOCPS(n);
          return;
        case this.ADDR_OCPD:
          this._handleOCPD(n);
          return;
      }

      this._memory[addr] = n;

      // Post-write
      switch (addr) {
        case this.ADDR_LY:
        case this.ADDR_LYC:
          this._updateStatLyc();
          break;
      }
      if (this._isExtRAMAddr(addr)) {
        if (this._hasMBC1) {
          this._writeMBC1RAM(addr, n);
        } else if (this._hasMBC3) {
          this._writeMBC3RAM(addr, n);
        } else if (this._hasMBC5RAM) {
          this._writeMBC5RAM(addr, n);
        }
      }
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_handleBCPD',
    value: function _handleBCPD(n) {
      this._bgPalettes[this._BgPaletteAddr] = n;
      if (this._autoNextBgPalette) {
        if (this._BgPaletteAddr < this.PALETTES_SIZE - 1) {
          this._BgPaletteAddr++;
        } else {
          this._BgPaletteAddr = 0;
        }
      }
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_handleOCPD',
    value: function _handleOCPD(n) {
      this._objPalettes[this._objPaletteAddr] = n;
      if (this._autoNextObjPalette) {
        if (this._objPaletteAddr < this.PALETTES_SIZE - 1) {
          this._objPaletteAddr++;
        } else {
          this._objPaletteAddr = 0;
        }
      }
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_handleBCPS',
    value: function _handleBCPS(n) {
      var hl = n & 0x01;
      var paletteData = n >> 1 & 3;
      var paletteNb = n >> 3 & 7;
      this._autoNextBgPalette = n >> 7 === 1;
      this._BgPaletteAddr = paletteNb * 8 + paletteData * 2 + hl;
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_handleOCPS',
    value: function _handleOCPS(n) {
      var hl = n & 0x01;
      var paletteData = n >> 1 & 3;
      var paletteNb = n >> 3 & 7;
      this._autoNextObjPalette = n >> 7 === 1;
      this._objPaletteAddr = paletteNb * 8 + paletteData * 2 + hl;
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC1RAM',
    value: function _writeMBC1RAM(addr, n) {
      if (this._hasMBC1RAM && this._canAccessMBC1RAM) {
        this._extRAM[this._getMBC1RAMAddr(addr)] = n;
      }
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC3RAM',
    value: function _writeMBC3RAM(addr, n) {
      if (this._hasMBC3RAM && this._canAccessMBC3RAM) {
        this._extRAM[this._getMBC3RAMAddr(addr)] = n;
      }
    }

    /**
     * @param addr
     * @param n
     * @private
     */

  }, {
    key: '_writeMBC5RAM',
    value: function _writeMBC5RAM(addr, n) {
      if (this._hasMBC5RAM && this._canAccessMBC5RAM) {
        this._extRAM[this._getMBC5RAMAddr(addr)] = n;
      }
    }

    /**
     * Handles write to STAT register
     * @param {number} n byte
     * @private
     */

  }, {
    key: '_handleStatWrite',
    value: function _handleStatWrite(n) {
      if ((n & this.STAT_INTERRUPT_MODE_UNSUPPORTED) > 0) {
        throw new Error('Unsupported STAT interrupt mode');
      }
    }

    /**
     * @param addr
     * @returns {number} addr in the MBC1 RAM given a MMU addr.
     * Example: 0xa000 corresponds to 0 if RAM bank is zero, 0xa000 to 0x2000 is RAM bank is 1.
     * @private
     */

  }, {
    key: '_getMBC1RAMAddr',
    value: function _getMBC1RAMAddr(addr) {
      return this._selectedRAMBankNb * this.MBC1_RAM_BANK_SIZE + (addr - this.ADDR_EXT_RAM_START);
    }
  }, {
    key: '_getMBC3RAMAddr',
    value: function _getMBC3RAMAddr(addr) {
      return this._getMBC1RAMAddr(addr);
    }
  }, {
    key: '_getMBC5RAMAddr',
    value: function _getMBC5RAMAddr(addr) {
      return this._getMBC1RAMAddr(addr);
    }

    /**
     * @param addr
     * @param {number} WRAMBank 2-7
     * @returns {number}
     * @private
     */

  }, {
    key: '_getCGBWRAMAddr',
    value: function _getCGBWRAMAddr(addr, WRAMBank) {
      return (WRAMBank - 2) * this.WRAM_CGB_BANK_SIZE + (addr - this.ADDR_WRAM_CGB_UPPER_BANK_START);
    }

    /**
     * @param addr
     * @returns {number} addr in the MBC1 ROM given a MMU addr.
     * Example: 0x4000 corresponds to 0x4000 if ROM bank is 1, 0x4000 to 0x8000 is RAM bank is 2, etc
     * @private
     */

  }, {
    key: '_getMBC1ROMAddr',
    value: function _getMBC1ROMAddr(addr) {
      return (this._selectedUpperROMBankNb * 0x20 + this._selectedROMBankNb) * this.MBC1_ROM_BANK_SIZE + (addr - this.ADDR_ROM_BANK_START);
    }

    /**
     * @private
     */

  }, {
    key: '_updateStatLyc',
    value: function _updateStatLyc() {
      if (this.ly() === this.lyc()) {
        this.writeByteAt(this.ADDR_STAT, this.stat() | this.MASK_STAT_LYC_ON);
        if ((this.stat() & this.MASK_STAT_LYC_INTERRUPT) === this.MASK_STAT_LYC_INTERRUPT) {
          this._setIf(this._If() | this.IF_STAT_ON);
        }
      } else {
        this.writeByteAt(this.ADDR_STAT, this.stat() & this.MASK_STAT_LYC_OFF);
      }
    }

    /**
     * @param {number} addr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isBgCodeArea',
    value: function _isBgCodeArea(addr) {
      return addr >= this.ADDR_DISPLAY_DATA_1 && addr <= this.ADDR_VRAM_END;
    }

    /**
     * @param addr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isMBC1Register0Addr',
    value: function _isMBC1Register0Addr(addr) {
      return addr >= 0 && addr < this.ADDR_MBC1_REG1_START;
    }
  }, {
    key: '_isMBC3Register0Addr',
    value: function _isMBC3Register0Addr(addr) {
      return this._isMBC1Register0Addr(addr);
    }
  }, {
    key: '_isMBC5RAMGAddr',
    value: function _isMBC5RAMGAddr(addr) {
      return this._isMBC1Register0Addr(addr);
    }

    /**
     * @param addr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isMBC1Register1Addr',
    value: function _isMBC1Register1Addr(addr) {
      return addr >= this.ADDR_MBC1_REG1_START && addr < this.ADDR_ROM_BANK_START;
    }
  }, {
    key: '_isMBC3Register1Addr',
    value: function _isMBC3Register1Addr(addr) {
      return this._isMBC1Register1Addr(addr);
    }
  }, {
    key: '_isMBC5ROMB0Addr',
    value: function _isMBC5ROMB0Addr(addr) {
      return addr >= this.ADDR_MBC1_REG1_START && addr < this.ADDR_MBC5_ROMB1_START;
    }

    /**
     * @param addr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isMBC1Register2Addr',
    value: function _isMBC1Register2Addr(addr) {
      return addr >= this.ADDR_MBC1_REG2_START && addr < this.ADDR_MBC1_REG3_START;
    }
  }, {
    key: '_isMBC3Register2Addr',
    value: function _isMBC3Register2Addr(addr) {
      return this._isMBC1Register2Addr(addr);
    }
  }, {
    key: '_isMBC5RAMBAddr',
    value: function _isMBC5RAMBAddr(addr) {
      return this._isMBC1Register2Addr(addr);
    }

    /**
     * @param addr
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_isMBC1Register3Addr',
    value: function _isMBC1Register3Addr(addr) {
      return addr >= this.ADDR_MBC1_REG3_START && addr <= this.ADDR_MBC1_REG3_END;
    }
  }, {
    key: '_isMBC3Register3Addr',
    value: function _isMBC3Register3Addr(addr) {
      return this._isMBC1Register3Addr(addr);
    }

    /**
     * Selects a ROM bank
     * @param n byte
     * @private
     */

  }, {
    key: '_selectROMBank',
    value: function _selectROMBank(n) {
      this._selectedROMBankNb = n % this.getNbOfROMBanks();
      if (this._selectedROMBankNb === 0) {
        this._selectedROMBankNb = 1;
      }
    }

    /**
     * Selects the upper ROM bank
     * @param n
     * @private
     */

  }, {
    key: '_selectUpperROMBank',
    value: function _selectUpperROMBank(n) {
      this._selectedUpperROMBankNb = n;
    }

    /**
     * Selects a RAM bank
     * @param {number} bankNb [0,3]
     * @private
     */

  }, {
    key: '_selectRAMBank',
    value: function _selectRAMBank(bankNb) {
      this._selectedRAMBankNb = bankNb % this.MBC1_RAM_BANKS;
    }

    /**
     * Selects a RAM bank
     * @param {number} bankNb [0,15]
     * @private
     */

  }, {
    key: '_selectMBC5RAMBank',
    value: function _selectMBC5RAMBank(bankNb) {
      this._selectedRAMBankNb = bankNb % this.MBC5_RAM_BANKS;
    }

    /**
     * Hardware mock interface for CPU
     * @param n
     */

  }, {
    key: 'setHWDivider',
    value: function setHWDivider(n) {
      this._div = (this._div + n) % 0xffff;
      this._memory[this.ADDR_DIV] = _utils2.default.msb(this._div);
    }

    /**
     * @param n
     * @private
     */

  }, {
    key: '_handleDMA',
    value: function _handleDMA(n) {
      if (n <= this.ADDR_ROM_MAX >> 8) {
        throw new Error('No DMA allowed from ROM area in DMG');
      }
      var sourceStart = n << 8;
      var sourceEnd = sourceStart + this.DMA_LENGTH;

      var source = this.readBuffer(sourceStart, sourceEnd);
      this.writeBuffer(source, this.ADDR_OAM_START);

      this._isDMA = true;
    }

    /**
     * @param addr
     * @returns {boolean} true if addr is in OAM range
     * @private
     */

  }, {
    key: '_isOAMAddr',
    value: function _isOAMAddr(addr) {
      return addr >= this.ADDR_OAM_START && addr <= this.ADDR_OAM_END;
    }

    /**
     * @param addr
     * @returns {boolean} true if addr is in VRAM range
     * @private
     */

  }, {
    key: '_isVRAMAddr',
    value: function _isVRAMAddr(addr) {
      return addr >= this.ADDR_VRAM_START && addr <= this.ADDR_VRAM_END;
    }

    /**
     * @param addr
     * @returns {boolean} true if addr is in WRAM range
     * @private
     */

  }, {
    key: '_isUpperWRAMAddr',
    value: function _isUpperWRAMAddr(addr) {
      return addr >= this.ADDR_WRAM_CGB_UPPER_BANK_START && addr <= this.ADDR_WRAM_END;
    }

    /**
     * @param addr
     * @returns {boolean} true if addr is in External RAM range
     * @private
     */

  }, {
    key: '_isExtRAMAddr',
    value: function _isExtRAMAddr(addr) {
      return addr >= this.ADDR_EXT_RAM_START && addr < this.ADDR_WRAM_START;
    }

    /**
     * @param addr
     * @returns {boolean} true if add is in Program Switching Area (for ROM banking)
     * @private
     */

  }, {
    key: '_isProgramSwitchAddr',
    value: function _isProgramSwitchAddr(addr) {
      return addr >= this.ADDR_ROM_BANK_START && addr < this.ADDR_VRAM_START;
    }

    /**
     * @returns {boolean} true OAM is accessible
     * @private
     */

  }, {
    key: '_canAccessOAM',
    value: function _canAccessOAM() {
      var mode = this.getLCDMode();
      return !this._isDMA && mode !== 2 && mode !== 3;
    }

    /**
     * @returns {boolean} true if VRAM is accessible
     * @private
     */

  }, {
    key: '_canAccessVRAM',
    value: function _canAccessVRAM() {
      return this.getLCDMode() !== 3;
    }

    /**
     * @returns {number} LCD Mode: [0,3]
     */

  }, {
    key: 'getLCDMode',
    value: function getLCDMode() {
      return this.stat() & this.MASK_STAT_MODE;
    }

    /**
     * Sets LCD Mode
     * @param {number} mode [0,3]
     */

  }, {
    key: 'setLCDMode',
    value: function setLCDMode(mode) {
      if (mode > 3 || mode < 0) return;
      this._memory[this.ADDR_STAT] &= 0xfc;
      this._memory[this.ADDR_STAT] += mode;
    }
  }, {
    key: '_handle_lcdc',


    /**
     * Handles updates to LCD Control Register (LCDC)
     * @param n
     * @private
     */
    value: function _handle_lcdc(n) {
      switch (n & this.LCDC_ON) {
        case 0:
          this._handle_lcd_off();
          break;
      }
    }

    /**
     * Handles actions when LCD turns off
     * @private
     */

  }, {
    key: '_handle_lcd_off',
    value: function _handle_lcd_off() {
      this.setLy(0x00);
      this.setLCDMode(0);
    }

    /**
     * Sets value on interrupt request register
     * @param value
     */

  }, {
    key: '_setIf',
    value: function _setIf(value) {
      this._memory[this.ADDR_IF] = value;
    }

    /**
     * @returns {number} IF register
     * @private
     */

  }, {
    key: '_If',
    value: function _If() {
      return this._memory[this.ADDR_IF];
    }

    /**
     * @return {string} game title
     */

  }, {
    key: 'getGameTitle',
    value: function getGameTitle() {
      var characters = this._rom.subarray(this.ADDR_TITLE_START, this.ADDR_TITLE_END + 1);
      var title = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = characters[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var c = _step.value;

          if (c >= 0x20 && c < 0x7f) {
            // Readable ASCII chars
            title.push(String.fromCharCode(c));
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return title.join('');
    }

    /**
     * @return {boolean} true if game is in color
     */

  }, {
    key: 'isGameInColor',
    value: function isGameInColor() {
      var isColor = this._rom[this.ADDR_IS_GB_COLOR];
      return isColor === this.IS_GB_COLOR || isColor === this.IS_GBC_ONLY;
    }

    /**
     * @returns {boolean} true if ROM is for Super Game Boy
     */

  }, {
    key: 'isGameSuperGB',
    value: function isGameSuperGB() {
      return this._rom[this.ADDR_IS_SGB];
    }

    /**
     * @returns {boolean} cartridge is supported
     */

  }, {
    key: 'isCartridgeSupported',
    value: function isCartridgeSupported() {
      var type = this._rom[this.ADDR_CARTRIDGE_TYPE];
      switch (type) {
        // TODO: support most cartridges
        case this._ROM_ONLY:
        case this._ROM_MBC1:
        case this._ROM_MBC1_RAM:
        case this._ROM_MBC1_RAM_BATT:
        case this._ROM_MBC3:
        case this._ROM_MBC3_RAM:
        case this._ROM_MBC3_RAM_BATT:
        case this._ROM_MBC5:
        case this._ROM_MBC5_RAM:
        case this._ROM_MBC5_RAM_BATT:
          return true;
        default:
          _logger2.default.warn('Cartridge type ' + _utils2.default.hex2(type) + ' unknown');
          return false;
      }
    }

    /**
     * @returns {string} ROM size
     */

  }, {
    key: 'getRomSize',
    value: function getRomSize() {
      switch (this._rom[this.ADDR_ROM_SIZE]) {
        case this._32KB:
          return '32KB';
        case this._64KB:
          return '64KB';
        case this._128KB:
          return '128KB';
        case this._256KB:
          return '256KB';
        case this._512KB:
          return '512KB';
        case this._1MB:
          return '1MB';
        case this._1_1MB:
          return '1.1MB';
        case this._1_2MB:
          return '1.2MB';
        case this._1_5MB:
          return '1.5MB';
        case this._2MB:
          return '2MB';
        default:
          throw new Error('Rom size unknown');
      }
    }

    /**
     * @returns {string} RAM size
     */

  }, {
    key: 'getRAMSize',
    value: function getRAMSize() {
      switch (this._rom[this.ADDR_RAM_SIZE]) {
        case this.RAM_NONE:
          return 'None';
        case this.RAM_2KB:
          return '2KB';
        case this.RAM_8KB:
          return '8KB';
        case this.RAM_32KB:
          return '32KB';
        case this.RAM_128KB:
          return '128KB';
        default:
          throw new Error('RAM size unknown');
      }
    }

    /**
     * @returns {string} destination code
     */

  }, {
    key: 'getDestinationCode',
    value: function getDestinationCode() {
      if (this._rom[this.ADDR_DESTINATION_CODE] === this.JAPANESE) {
        return 'Japanese';
      } else if (this._rom[this.ADDR_DESTINATION_CODE] === this.NON_JAPANESE) {
        return 'Non-Japanese';
      } else {
        throw new Error('Destination code unknown');
      }
    }

    /**
     * @returns {Uint8Array} nintendo graphic logo
     */

  }, {
    key: 'getNintendoGraphicBuffer',
    value: function getNintendoGraphicBuffer() {
      return this._rom.subarray(this.ADDR_NINTENDO_GRAPHIC_START, this.ADDR_NINTENDO_GRAPHIC_END + 1);
    }

    /**
     * Computes ROM checksum and verifies if correct.
     *
     * Checksum is computed by summing all bytes in the cartridge
     * from 0x134 to 0x14d plus 25. Checksum is correct if the least
     * significant byte is 0x00.
     *
     * @return {boolean} true if checksum is correct.
     */

  }, {
    key: 'isChecksumCorrect',
    value: function isChecksumCorrect() {
      var addr = this.ADDR_TITLE_START;
      var count = 0;
      while (addr <= this.ADDR_COMPLEMENT_CHECK) {
        count += this._rom[addr];
        addr++;
      }
      return (count + 25 & 0xff) === 0;
    }

    /**
     * Returns the value of LCD Control register
     * @returns {number}
     */

  }, {
    key: 'lcdc',
    value: function lcdc() {
      return this.readByteAt(this.ADDR_LCDC);
    }

    /**
     * LCDC Status Flag
     * @returns {number}
     */

  }, {
    key: 'stat',
    value: function stat() {
      return this.readByteAt(this.ADDR_STAT);
    }

    /**
     * LCDC Y-Coordinate (read-only)
     * @returns {number}
     */

  }, {
    key: 'ly',
    value: function ly() {
      return this.readByteAt(this.ADDR_LY);
    }

    /**
     * Sets value at register LY (emulates hardware)
     * @param {number} line
     */

  }, {
    key: 'setLy',
    value: function setLy(line) {
      this.writeByteAt(this.ADDR_LY, line);
    }

    /**
     * Increments register LY by 1. Resets after 153.
     */

  }, {
    key: 'incrementLy',
    value: function incrementLy() {
      var ly = this.ly();
      if (ly >= this.NUM_LINES) {
        ly = 0;
      } else {
        ly++;
      }
      this.setLy(ly);
    }

    /**
     * @returns {number} LYC register
     */

  }, {
    key: 'lyc',
    value: function lyc() {
      return this.readByteAt(this.ADDR_LYC);
    }

    /**
     * @returns {boolean} true if LY === LYC
     */

  }, {
    key: 'lyEqualsLyc',
    value: function lyEqualsLyc() {
      return (this.stat() & this.MASK_STAT_LYC_ON) >> 2 === 1;
    }

    /**
     * Bank register for LCD display RAM.
     * Always zero in DMG.
     */

  }, {
    key: 'vbk',
    value: function vbk() {
      return this.readByteAt(this.ADDR_VBK);
    }

    /**
     * @returns {number} P1
     */

  }, {
    key: 'p1',
    value: function p1() {
      return this.readByteAt(this.ADDR_P1);
    }
  }, {
    key: 'pressRight',
    value: function pressRight() {
      this._memory[this.ADDR_P1] &= this.MASK_P1_RIGHT_ON;
    }
  }, {
    key: 'liftRight',
    value: function liftRight() {
      this._memory[this.ADDR_P1] |= this.MASK_P1_RIGHT_OFF;
    }
  }, {
    key: 'pressLeft',
    value: function pressLeft() {
      this._memory[this.ADDR_P1] &= this.MASK_P1_LEFT_ON;
    }
  }, {
    key: 'liftLeft',
    value: function liftLeft() {
      this._memory[this.ADDR_P1] |= this.MASK_P1_LEFT_OFF;
    }
  }, {
    key: 'pressUp',
    value: function pressUp() {
      this._memory[this.ADDR_P1] &= this.MASK_P1_UP_ON;
    }
  }, {
    key: 'liftUp',
    value: function liftUp() {
      this._memory[this.ADDR_P1] |= this.MASK_P1_UP_OFF;
    }
  }, {
    key: 'pressDown',
    value: function pressDown() {
      this._memory[this.ADDR_P1] &= this.MASK_P1_DOWN_ON;
    }
  }, {
    key: 'liftDown',
    value: function liftDown() {
      this._memory[this.ADDR_P1] |= this.MASK_P1_DOWN_OFF;
    }
  }, {
    key: 'pressA',
    value: function pressA() {
      this._buttons &= this.MASK_P1_A_ON;
    }
  }, {
    key: 'liftA',
    value: function liftA() {
      this._buttons |= this.MASK_P1_A_OFF;
    }
  }, {
    key: 'pressB',
    value: function pressB() {
      this._buttons &= this.MASK_P1_B_ON;
    }
  }, {
    key: 'liftB',
    value: function liftB() {
      this._buttons |= this.MASK_P1_B_OFF;
    }
  }, {
    key: 'pressSELECT',
    value: function pressSELECT() {
      this._buttons &= this.MASK_P1_SELECT_ON;
    }
  }, {
    key: 'liftSELECT',
    value: function liftSELECT() {
      this._buttons |= this.MASK_P1_SELECT_OFF;
    }
  }, {
    key: 'pressSTART',
    value: function pressSTART() {
      this._buttons &= this.MASK_P1_START_ON;
    }
  }, {
    key: 'liftSTART',
    value: function liftSTART() {
      this._buttons |= this.MASK_P1_START_OFF;
    }

    /**
     * @param objNb
     * @returns {{y: number, x: number, chrCode: number, attr: number}}
     */

  }, {
    key: 'getOBJ',
    value: function getOBJ(objNb) {
      if (objNb < 0 || objNb > this.MAX_OBJ - 1) throw new Error('OBJ number out of range');

      var addr = this.ADDR_OAM_START + objNb * this.BYTES_PER_OBJ;
      return {
        y: this.readByteAt(addr),
        x: this.readByteAt(addr + 1),
        chrCode: this.readByteAt(addr + 2),
        attr: this.readByteAt(addr + 3)
      };
    }

    /**
     * @returns {number} BackGround Palette
     */

  }, {
    key: 'bgp',
    value: function bgp() {
      return this.readByteAt(this.ADDR_BGP);
    }

    /**
     * @returns {number} Object Palette 0
     */

  }, {
    key: 'obg0',
    value: function obg0() {
      return this.readByteAt(this.ADDR_OBG0);
    }

    /**
     * @returns {number} Object Palette 1
     */

  }, {
    key: 'obg1',
    value: function obg1() {
      return this.readByteAt(this.ADDR_OBG1);
    }

    /**
     * @param paletteNb
     * @returns {Array[Array]}
     */

  }, {
    key: 'getBgPalette',
    value: function getBgPalette(paletteNb) {
      return this._getPalette(this._bgPalettes, paletteNb);
    }

    /**
     * @param paletteNb
     */

  }, {
    key: 'getObjPalette',
    value: function getObjPalette(paletteNb) {
      return this._getPalette(this._objPalettes, paletteNb);
    }

    /**
     * @param palette
     * @param paletteNb
     * @private
     */

  }, {
    key: '_getPalette',
    value: function _getPalette(palette, paletteNb) {
      var result = [];
      for (var i = 0; i < 4; i++) {
        result.push(this._getRGB(palette, paletteNb, i));
      }
      return result;
    }

    /**
     * MBC1 mode: 0 is 2MB ROM/8KB RAM, 1 is 512KB ROM/32KB RAM
     * @returns {number}
     */

  }, {
    key: 'getMBC1Mode',
    value: function getMBC1Mode() {
      // TODO: implement
      return 0;
    }

    /**
     * @returns {number} number of banks (integer)
     */

  }, {
    key: 'getNbOfROMBanks',
    value: function getNbOfROMBanks() {
      if (this._hasMBC1 || this._hasMBC3 || this._hasMBC5) {
        return this._rom.length / this.MBC1_ROM_BANK_SIZE;
      }
      return 0;
    }
  }, {
    key: 'getSelectedROMBankNb',
    value: function getSelectedROMBankNb() {
      return this._selectedROMBankNb;
    }
  }, {
    key: 'getSelectedUpperROMBankNb',
    value: function getSelectedUpperROMBankNb() {
      return this._selectedUpperROMBankNb;
    }
  }, {
    key: 'getSelectedRAMBankNb',
    value: function getSelectedRAMBankNb() {
      return this._selectedRAMBankNb;
    }
  }, {
    key: 'scx',
    value: function scx() {
      return this.readByteAt(this.ADDR_SCX);
    }
  }, {
    key: 'scy',
    value: function scy() {
      return this.readByteAt(this.ADDR_SCY);
    }

    /**
     * @returns {boolean} true if Window should be displayed
     */

  }, {
    key: 'isWindowOn',
    value: function isWindowOn() {
      return (this.lcdc() & this.MASK_WINDOW_ON) === this.MASK_WINDOW_ON;
    }

    /**
     * @returns {number} Window Y-coord register
     */

  }, {
    key: 'wy',
    value: function wy() {
      return this.readByteAt(this.ADDR_WY);
    }

    /**
     * @returns {number} Window X-coord register
     */

  }, {
    key: 'wx',
    value: function wx() {
      return this.readByteAt(this.ADDR_WX);
    }

    /**
     * @param gridX
     * @param gridY
     */

  }, {
    key: 'getBgPaletteNb',
    value: function getBgPaletteNb(gridX, gridY) {
      var addr = this._getBgDisplayDataStartAddr() + gridX + gridY * this.CHARS_PER_LINE;
      return this._CGB_VRAM_bank1[addr - this.ADDR_VRAM_START] & 0x07;
    }

    /**
     * @param gridX
     * @param gridY
     */

  }, {
    key: 'getWindowPaletteNb',
    value: function getWindowPaletteNb(gridX, gridY) {
      var addr = this._getWindowCodeAreaStartAddr() + gridX + gridY * this.CHARS_PER_LINE;
      return this._CGB_VRAM_bank1[addr - this.ADDR_VRAM_START] & 0x07;
    }
  }]);

  return MMU;
}();

exports.default = MMU;

}).call(this,require("buffer").Buffer)
},{"./logger":12,"./utils":15,"buffer":3,"fs":2}],14:[function(require,module,exports){
'use strict';

var _cpu = require('./cpu');

var _cpu2 = _interopRequireDefault(_cpu);

var _mmu = require('./mmu');

var _mmu2 = _interopRequireDefault(_mmu);

var _lcd = require('./lcd');

var _lcd2 = _interopRequireDefault(_lcd);

var _inputHandler = require('./inputHandler');

var _inputHandler2 = _interopRequireDefault(_inputHandler);

var _gameRequester = require('./gameRequester');

var _gameRequester2 = _interopRequireDefault(_gameRequester);

var _browserStorage = require('./browserStorage');

var _browserStorage2 = _interopRequireDefault(_browserStorage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Cache DOM references
var $cartridge = document.getElementById('cartridge');
var $body = document.querySelector('body');
var $ctx = document.querySelector('canvas').getContext('2d');
var $title = document.querySelector('title');

// Constants
var MAX_FPS = 60;
var INTERVAL = 1000 / MAX_FPS;

var now = void 0;
var then = Date.now();
var delta = void 0;
var frames = 0;
var ref = then;
var cpu = void 0,
    mmu = void 0;
var gameRequester = new _gameRequester2.default();

/**
 * Handles file selection
 * @param evt
 */
function handleFileSelect(evt) {

  ga('send', 'event', 'UI', 'click', 'load game');

  var file = evt.target.files[0]; // FileList object

  var reader = new FileReader();

  reader.onload = function (event) {

    $cartridge.blur();
    init(event.target.result);
  };

  if (file) {
    reader.readAsArrayBuffer(file);
    ga('send', 'event', 'Emulator', 'load', file.name);
  }
}

/**
 * @param {ArrayBuffer} arrayBuffer
 */
function init(arrayBuffer) {
  mmu = new _mmu2.default(new Uint8Array(arrayBuffer), new _browserStorage2.default(window.localStorage));
  var bootstrap = true;
  if (!mmu.isCartridgeSupported()) {
    bootstrap = window.confirm('This game is not supported. Do you want to continue? Your browser may crash.');
  }
  if (bootstrap) {
    var lcd = new _lcd2.default(mmu, $ctx);
    cpu = new _cpu2.default(mmu, lcd);
    new _inputHandler2.default(cpu, $body);
    frame();
  }
}

/**
 * Main loop
 */
function frame() {
  try {
    window.requestAnimationFrame(frame);
    now = Date.now();
    delta = now - then;

    if (delta > INTERVAL) {
      // fps limitation logic, Kindly borrowed from Rishabh
      // http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe
      then = now - delta % INTERVAL;
      if (++frames > MAX_FPS) {
        updateTitle(Math.floor(frames * 1000 / (new Date() - ref) / 60 * 100));
        frames = 0;
        ref = new Date();
      }
      cpu.frame();
      cpu.paint();
    }
  } catch (e) {
    console.error(e.stack);
  }
}

function updateTitle(speed) {
  $title.innerText = 'ESboy ' + speed + '%';
}

function saveGame() {
  if (mmu) mmu.flushExtRamToStorage();
}

function attachListeners() {
  $cartridge.addEventListener('change', handleFileSelect, false);
  $cartridge.addEventListener('click', function (evt) {
    this.value = null; // reset chosen file
    saveGame();
  }, false);

  window.addEventListener('unload', saveGame); // user closes tab or window
}

attachListeners();

gameRequester.request('load-game', init);

},{"./browserStorage":6,"./cpu":8,"./gameRequester":9,"./inputHandler":10,"./lcd":11,"./mmu":13}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = function () {
  function Utils() {
    _classCallCheck(this, Utils);
  }

  _createClass(Utils, null, [{
    key: 'str20',


    /**
     * Pads with spaces to fill 20 characters.
     * @param string
     * @returns {string}
     */
    value: function str20(string) {
      return string + ' '.repeat(20 - string.length);
    }

    /**
     * @param number
     * @returns {string} hexadecimal, example: 0xab
     */

  }, {
    key: 'hexStr',
    value: function hexStr(number) {
      if (number == null) return '';
      return '0x' + number.toString(16);
    }

    /**
     * @param {number} number
     * @returns {string} 4 hex, example: '0x0abc'
     */

  }, {
    key: 'hex4',
    value: function hex4(number) {
      if (number == null) return '0x0000';
      var hex = number.toString(16);

      return '0x' + ('0'.repeat(4 - hex.length) + hex);
    }

    /**
     * @param {number} number
     * @returns {string} 2 hex, example: '0x0abc'
     */

  }, {
    key: 'hex2',
    value: function hex2(number) {
      if (number == null) return '0x00';
      var hex = number.toString(16);
      if (hex.length < 2) {
        hex = '0' + hex;
      }
      return '0x' + hex;
    }

    /**
     * @param {number} number, unsigned 8 bits
     * @returns {number} number, signed 8 bits
     */

  }, {
    key: 'uint8ToInt8',
    value: function uint8ToInt8(number) {
      if ((number & 0x80) > 0) {
        number -= 0x100;
      }
      return number;
    }

    /**
     * @param word 16 bits
     * @returns {number} least significant 8 bits
     */

  }, {
    key: 'lsb',
    value: function lsb(word) {
      return word & 0x00ff;
    }

    /**
     * @param word 16 bits
     * @returns {number} most significant 8 bits
     */

  }, {
    key: 'msb',
    value: function msb(word) {
      return (word & 0xff00) >> 8;
    }
  }, {
    key: 'toBin8',
    value: function toBin8(number) {
      var binary = number.toString(2);
      return '0'.repeat(8 - binary.length) + binary; // pad
    }
  }, {
    key: 'toFsStamp',
    value: function toFsStamp() {
      var date = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Date();

      return date.toISOString().replace(/\.|:/g, '-');
    }

    /**
     * Complements bit of a 8 bit number
     * @param number
     * @returns {number}
     */

  }, {
    key: 'cplBin8',
    value: function cplBin8(number) {
      var binStr = Utils.toBin8(number);
      var complStr = '';
      for (var b = 0; b < binStr.length; b++) {
        if (binStr[b] === '1') {
          complStr += '0';
        } else if (binStr[b] === '0') {
          complStr += '1';
        }
      }
      return parseInt(complStr, 2);
    }
  }, {
    key: 'bitMask',
    value: function bitMask(bit) {
      if (bit > 7) throw new Error('Bit must be [0,7]');

      switch (bit) {
        case 0:
          return 254;
        case 1:
          return 253;
        case 2:
          return 251;
        case 3:
          return 247;
        case 4:
          return 239;
        case 5:
          return 223;
        case 6:
          return 191;
        case 7:
          return 127;
      }
    }

    /**
     * Swaps nybbles in a byte
     * @param byte
     * @returns {number}
     */

  }, {
    key: 'swapNybbles',
    value: function swapNybbles(byte) {
      if (byte > 0xff) throw new Error('Not a byte');
      if (byte == null) throw new Error('No byte');
      return (byte >> 4 & 0x0f) + (byte << 4 & 0xf0);
    }
  }]);

  return Utils;
}();

exports.default = Utils;

},{}]},{},[14]);
