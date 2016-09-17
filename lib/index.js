/* global window */
var mergeWith = function(t){
	return function(a, b){
		return [].concat(
			Object.keys(a),
			Object.keys(b)
		)
		.reduce(function(p,k){
			p[k] = p[k] || t(a[k], b[k])
			return p
		}, {})
	}
}

var merge = mergeWith(function(a,b){
	return b || a
})

var add = function(a,b){ return a + b }
var subtract = function(a,b){ return a - b }

var always = function(v){
	return function(){
		return v
	}
}

var mapObj = function(t,o){
	return Object.keys(o)
		.reduce(function(p,k){
			p[k] = t(o[k])
			return p
		}, {})
}

var clamp = function(min, max, value){
	return Math.max(Math.min(value, max), min)
}

var f = require('flyd')
var stream = f.stream
var scan = f.scan
var on = f.on
var endsOn = f.endsOn

var endsOn_ = f.curryN(2, endsOn)
var initialCoords = { x:0 , y:0 }

/**
 *	Sets up the zoompoint as the centre of a radius
 *	created by 2 pointers.
 *
 *	Just like onscale_mousewheel, sets up some state
 *	and then passes it down to onscale() in a uniform format.
 */
function onscale_fingers(state, a, b){

	var x = [a.pageX, b.pageX]
		.sort(subtract).map(function(v){ return v - state.settings.offset().x })
	var y = [a.pageY, b.pageY]
		.sort(subtract).map(function(v){ return v - state.settings.offset().y })


	var dx = x[1] - x[0]
	var dy = y[1] - y[0]
	var d = Math.hypot(dx,dy)

	if(state.pinching() == 1){
		state.touchRadius(d)
	} else {
		var zoompoint =
			{ x: x[1] - dx / 2
			, y: y[1] - dy / 2
			}

		var newScale = state.initialPinchScale() * d / state.touchRadius()

		onscale(state, zoompoint, newScale)
	}
}

/**
 *  A lot like, onscale_fingers().
 *  It sets up some state, and then passes it on scale.
 *
 *  Mousewheel just {inc,dec}rements
 *  a number, unlike fingers, which uses the ratio of changes
 *  in the radius caused by the fingers.
 *
 *  This function sets toggles state.wheeling while it updates
 *  the other userfacing streams, so a user could make decisions
 *  about how they want to react to a scale event.
 */
function onscale_mousewheel(state, e){
	if(Math.abs(e.wheelDeltaX) < 1e-1){
		// now we tell everyone we are scrolling the mouse wheel
		// so our coords stream doesn't ignore these movements
		state.wheeling(true)

			var zoompoint =
				{ x: e.pageX - state.settings.offset().x
				, y: e.pageY - state.settings.offset().y
				}

			// scale more quickly the higher the scale gets
			var next = 0.01 + state.scale() * 1e-1
			var nextScale = state.scale()
				+ (
					e.wheelDeltaY > 0
					? - next
					: + next
				)

			onscale(state, zoompoint, nextScale)

			// sync the pinch scale with the mousewheel scaling
			// otherwise, switching from 1 to the other can cause jumps in scale
			state.initialPinchScale(state.scale())

		state.wheeling(false)
	}
}

/**
 * Calculates how much to move the viewport in order to keep
 * the zoompoint in the same position (as a ratio) between zooms
 *
 * The scale itself, is calculated upstream -
 * this tells the user how much they need to shift
 * their container to retain the screen position across scales.
 */
function onscale(state, zoompoint, nextScale){
	var scale =
		{ current: state.scale()
		, next: clamp(
				state.settings.scale.min, state.settings.scale.max, nextScale
			)
		}

	// 1. how far into the *current* viewport, the zoompoint is, as a ratio
	// 2. how far into the *new* viewport, the zoompoint is as a ratio
	// 3. the correct translation to the new viewport, so those ratios are equal
	//
	// In order to get 1. and 2.
	// We need to know the zoompoint coordinates from the perspective
	// of each viewport, the translation coords are always in world.

	var bounds = {
		w: window.innerWidth - state.settings.offset().x
		,h: window.innerHeight - state.settings.offset().y
	}

	var viewports = {
		current: {
			// origin of current viewport (0,0)
			// in world coordinates (x,y)
			x: state.coords().x , y: state.coords().y

			// the dimensions of the viewport, in world coordinates
			,w: bounds.w / scale.current
			,h: bounds.h / scale.current
		}
		,next: {
			x: state.coords().x, y: state.coords().y
			,w: bounds.w / scale.next
			,h: bounds.h / scale.next
		}
	}

	var ratios =
		// the ratio the zoom point is into the viewport
		// 0.5 would be the mouse half way through
		// the viewport (but not the window!)
		{ current:
			{ x: (zoompoint.x - viewports.current.x) / viewports.current.w
			, y: (zoompoint.y - viewports.current.y) / viewports.current.h
			}

		// the next viewport will be slightly bigger or slightly smaller
		// so its ratio will be slightly bigger or smaller
		// we can use the ratio to translate the viewport so our zoompoint
		// doesn't drift as we scale
		, next:
			{ x: (zoompoint.x - viewports.next.x) / viewports.next.w
			, y: (zoompoint.y - viewports.next.y) / viewports.next.h
			}
		}

	// we now have the ratios that allow us to compare
	// how much the zoompoint would drift
	// but our code above, assumes both viewports have the same origin
	// this means the container that is being scaled
	// must have transform-origin set to "top left"
	//
	// with that out of the way, lets figure out how to
	// compensate for the scale drift
	// we find the difference between the two ratios,
	// and we multiply that difference
	// by the dimensions of the new viewport
	var zoomDrift =
		{ x: (ratios.next.x - ratios.current.x) * viewports.current.w * -1
		, y: (ratios.next.y - ratios.current.y) * viewports.current.h * -1
		}



	// apply the zoom drift to the container
	// so our zoom point is always in the same "spot"
	// at whatever zoom level
	state.movement(zoomDrift)
	state.move(zoompoint)

	// apply our new scale so the container can update
	state.scale(scale.next)
}

/**
 * By incrementing, it would be quite trivial
 * to create a custom longtap/click stream
 * in userland
 */
function onmousedown(state){
	state.mousedown(state.mousedown()+1)
}

/**
 * Reset mousedown, dragging and pinching.
 * Save the pinchScale so we have a base scale
 * to work with next time
 */
function onmouseup(state, e){
	state.mousedown(0)
	state.dragging(false)
	if(e.touches && e.touches.length){
		state.pinching(0)
		state.initialPinchScale( state.scale() )
	}
}

/**
 *	Manages a few states.  Dragging, mouse position.
 *	Triggers pinch zoom, if there are many touches.
 *
 *	Otherwise it treats a dragging finger, just like
 *	a click and drag gesture with a mouse
 */
function onmousemove(state, e){

	/**
	 * Fig 1.
	 * This may seem unnecessary to check if the state is pinching.
	 * Seeing as we are the onces that set it.
	 *
	 * But its important to remember that this handler will accept
	 * events from both the mouse and fingers.  And if the mouse happens to be
	 * on screen when someone decides to pinch, it will conflict and jump
	 * to the mouse's coordinates; if the condtion in Fig 1. is not present
	 */

	var touches = e.touches || []
	var event = touches[0] || e

	if(touches.length > 1){
		// +1 how long have we been pinching for?
		state.pinching(state.pinching()+1)
		onscale_fingers(state, e.touches[0], e.touches[1])

	} else if( !state.pinching() ) { // Fig 1.

		var x = event.pageX - state.settings.offset().x
		var y = event.pageY - state.settings.offset().y

		if(state.mousedown() > 1){

			state.dragging(state.mousedown())
			var movement =
				{ x: x - state.move().x
				, y: y - state.move().y
				}
			state.movement(movement)
		}

		state.move({ x:x, y:y })
	}

	// It is possible to move the mouse without having the mouse down
	// We only want to increment, if we are already incrementing.
	state.mousedown(
		state.mousedown()
		+ (
			state.mousedown() > 0
			? 1
			: 0
		)
	)
	e.preventDefault()
}

function streamFromEvent(container, event, endStream){
	var s = stream()
	container.addEventListener(event,s)
	on(function(){
		container.removeEventListener(event,s)
	}, s.end )
	return endsOn(endStream, s)
}

var defaultOptions = {
	offset: { x:0 , y:0 }
	,scale: { min:0.5, max:40 }
	,coords: { min: { x: -Infinity, y: -Infinity}, max: { x: Infinity, y: Infinity } }
}
function Pointer(options){
	options = options || defaultOptions
	options.offset = options.offset || defaultOptions.offset
	options.scale = options.scale || defaultOptions.scale
	options.manualActivation = options.manualActivation || false
	options.container = options.container || always(window)
	options.coords = options.coords || defaultOptions.coords

	var x = options.offset.x
	var y = options.offset.y
	var min = options.scale.min
	var max = options.scale.max
	/**
	 * Pass `true` into this stream and it will
	 * destroy all event lsiteners and internal streams
	 */
	var end = stream()

	var offset = stream({
		x:x
		,y:y
	})

	/*
	* A stream of numbers that increments for every
	* mousemove event.
	* Resets to 0 on mouseup/touchend
	*/
	var mousedown = stream(0)

	/**
	 * A stream of increment translations.
	 * Useful if you want to apply incremental translations
	 * in sync with coords updating.
	 */
	var movement = stream(initialCoords)

	/**
	 * The last known coordinates of the pointer as a stream
	 */
	var move = stream(initialCoords)

	/**
	 * A stream of booleans indicating whether we are currently dragging
	 */

	var dragging = stream(false)
	/**
	 * A stream of booleans indicating whether we are currently pinching
	 */
	var pinching = stream(0)

	/**
	 * A stream of booleans indicating whether we are currently wheeling
	 */
	var wheeling = stream(0)

	/**
	 * A stream of the current scale of the viewport.
	 * Responds to mouse wheel and pinchzoom
	 */
	var scale = stream(1)

	/**
	 *	The viewport scale at the end of the last pinch gesture.
	 *	Used internally, but exposed because why not?
	 */
	var initialPinchScale = stream(1)

	/**
	 *	The radius of the circle created by the first two touches in
	 *  in the event.touches array.
	 *
	 *	Used internally to calculate the scale.
	 */
	var touchRadius = stream(1)


	/**
	 * A predicate true if we are either dragging or zooming
	 */
	var notHover = function() {

		return [dragging,pinching,wheeling]
			.some(function(s){
				return s()
			})
	}

	/**
	*	The coords you should translate your canvas or container
	*	Adds all movements to a vector when either dragging or zooming
	*	These coords are global, so you should apply them _before_ scaling
	*/
	var coords = scan(
		function(p, n) {
			if( notHover() ){
				return {
					x: clamp(options.coords.min.x, options.coords.max.x, p.x + n.x)
					,y: clamp(options.coords.min.y, options.coords.max.y, p.y + n.y)
				}
			} else {
				return p
			}

		}
		,initialCoords
		,movement
	)

	/**
	 *	All the state streams that get passed to the event handlers.
	 *	This is also the public API of the pointer instance.
	 */

	var state =
		merge(
			{
				settings: {
					scale: { min:min, max:max }, offset:offset
					,coords: options.coords
				}

				/**
				 * Create a stream for event.
				 * The event stream will be destroyed when the end stream
				 * receives `true` as a value.
				 *
				 * Also passes in the state to each handler.
				 */
				,activateListeners: function(){
					;[
						,[onmousedown, 'mousedown']
						,[onmouseup, 'mouseup']
						,[onmouseup, 'mouseleave']
						,[onmousemove, 'mousemove']
						,[onmouseup, 'touchend']
						,[onmousedown, 'touchstart']
						,[onmousemove, 'touchmove']
					]
					.concat(
						options.disable_mousewheel
							? []
							: [[onscale_mousewheel, 'mousewheel']]
					)
					.map(function(pair){
						var handler = pair[0]
						var eventName = pair[1]
						var container = options.container()
						return streamFromEvent(container, eventName, end).map(
							function(e){ return handler(state, e) }
						)
					})
				}
			}
			,mapObj(endsOn_(end), {
				mousedown:mousedown
				,movement:movement
				,move:move
				,dragging:dragging
				,pinching:pinching
				,wheeling:wheeling
				,scale:scale
				,initialPinchScale:initialPinchScale
				,touchRadius:touchRadius
				,coords:coords
				,end:end

			})
		)

	if( !options.manualActivation ){
		state.activateListeners()
	}

	/**
	 * Give the user access to coords, scale and other streams.
	 */
	return state

}

global.PointerStream = Pointer
module.exports = Pointer

