pointer-stream
==============

Convenient, concise, streaming interface for scale, drag & movement.
A single API for mouse and touch events in 3.3k gzipped (9k minified)

[Live Example](http://james-forbes.com/pointer-stream)


Quick Start
-----------


#### Installation

`npm install pointer-stream`


Drop `pointer-stream.min.js` in your html file.

```html
<script src="node_modules/pointer-stream/pointer-stream.min.js"></script>
```

Or using browserify:

```js
var PointerStream = require('pointer-stream')
```

#### Usage

```js
const pointer = PointerStream({
	offset: { x: 0, y: 0 }
	,scale: { min: 1, max: 40 }
})

// subscribe to changes in scale
pointer.scale.map(function(scale){
	container.style.transform = 'scale('+scale+')'
})

// translate your container
pointer.coords.map(function({x,y}){
	container.style.transform = 'translate('+x+'px,'+y+'px)'
})

// clean up the pointer events, so they can be gc'd
pointer.end(true)

```

Advanced Use
------------

All the streams used are [flyd](https://github.com/paldepind/flyd) streams.
You can use any of the operators flyd supports, *and* you can use
Fantasy land compatible libraries like [Ramda](https://github.com/ramda/ramda)
to transform the streams in advanced ways.

```js

// If any of these streams return True
// `hovering` will return false

const hovering = R.pipe(
	R.always([
		pointer.dragging
		,pointer.pinching
		,pointer.wheeling
	])
	,R.anyPass
	,R.complement
)
```

There are many low level streams exposed that can be composed to
create more advanced, specific streams.


Transform Origin and Offset
---------------------------

`coords` is a convenience stream for translating a container.

It updates whenever a drag or scale event occurs.  If you find the
container translation behaviour is a little off, you can try
adding a transform origin rule to your element:


```css
#container {
	transform-origin: 'top left'
}
```

If your container is offset at all, you can pass a value to
`pointer.settings.offset({ x,y })`.

Subsequent events will be translated based on coords updating.

---


Interface
---------

Type signature of the `PointerStream`
constructor.

```js
{ {offset:{x,y}, scale:{min,max} }} =>

	{ mousedown: stream Number
	, movement: stream { x: Number, y: Number }
	, move: stream { x: Number, y: Number }
	, dragging: stream Boolean
	, pinching: stream Number
	, wheeling: stream Number
	, scale: stream Number
	, coords: stream { x: Number, y: Number }
	, end: stream Boolean?
	, settings:
		{ scale: { min: Number, max: Number }
		, offset: { x: stream Number, y: stream Number}
		}
	}

```

API
---

Note: Unless otherwise stated, all streams respond to touch and mouse.  Even streams like `mousemove`.
The idea is, you can abstract away whether an event came from the mouse or
a finger, without having to learn non standard event names.

#### mousedown

`stream Number`

An integer that increments on every mouse move event.  Used internally
to determine whether a drag is occuring.

Could potentially be used to create a `long-press` stream

#### movement

`stream {x,y}`

The amount we have moved since the previous event.  Used internally
to create the `coords` stream.

#### move

`stream {x,y}`

The current position of either the finger or the mouse.
In the case of multiple pointers, `move` will be the center
of the first two fingers in the `touches` array.


#### dragging

`stream Boolean`

True if the mouse is click+dragging or if a finger is panning.

#### pinching

`stream Boolean`

This stream is specific to touch.

True if two fingers are pinch/zooming.

#### wheeling

`stream Boolean`

This stream is specific to the mouse.

True if the mouse wheel is moving.  Used internally to dispatch to a
specific scale handler.


#### scale

`stream Number`

The current scale of the container.  Increments when zooming in
and decrements when zooming out.

#### end

`stream Boolean?`

Pass `true` into this stream to clean up the pointer instance.

```js
pointer.end(true)
```

All streams will cease to emit new values and will be garbage collected.

#### settings.scale {min,max}

Specify the minimum and maximum scale.  This will clamp the scale
on subsequent events.

#### settings.offset {x,y}

The current offset of your container.  Allows you to inform
a `pointer` instance if your container has moved.
This allows the library to calibrate `coords` `move` and `movement`
