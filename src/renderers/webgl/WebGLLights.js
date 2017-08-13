/**
 * @author mrdoob / http://mrdoob.com/
 */

import { Color } from '../../math/Color';
import { Matrix4 } from '../../math/Matrix4';
import { Vector2 } from '../../math/Vector2';
import { Vector3 } from '../../math/Vector3';

function UniformsCache() {

	var lights = {};

	return {

		get: function ( light ) {

			if ( lights[ light.id ] !== undefined ) {

				return lights[ light.id ];

			}

			var uniforms;

			switch ( light.type ) {

				case 'DirectionalLight':
					uniforms = {
						direction: new Vector3(),
						color: new Color(),

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2()
					};
					break;

				case 'SpotLight':
					uniforms = {
						position: new Vector3(),
						direction: new Vector3(),
						color: new Color(),
						distance: 0,
						coneCos: 0,
						penumbraCos: 0,
						decay: 0,

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2()
					};
					break;

				case 'PointLight':
					uniforms = {
						position: new Vector3(),
						color: new Color(),
						distance: 0,
						decay: 0,

						shadow: false,
						shadowBias: 0,
						shadowRadius: 1,
						shadowMapSize: new Vector2(),
						shadowCameraNear: 1,
						shadowCameraFar: 1000
					};
					break;

				case 'HemisphereLight':
					uniforms = {
						direction: new Vector3(),
						skyColor: new Color(),
						groundColor: new Color()
					};
					break;

				case 'RectAreaLight':
					uniforms = {
						color: new Color(),
						position: new Vector3(),
						halfWidth: new Vector3(),
						halfHeight: new Vector3()
						// TODO (abelnation): set RectAreaLight shadow uniforms
					};
					break;

			}

			uniforms.mask = light.channel.mask;
			lights[ light.id ] = uniforms;

			return uniforms;

		}

	};

}

function WebGLLights() {

	var cache = new UniformsCache();

	var state = {

		hash: '',

		ambients: [], //used for light mask

		ambient: [ 0, 0, 0 ],
		directional: [],
		directionalShadowMap: [],
		directionalShadowMatrix: [],
		spot: [],
		spotShadowMap: [],
		spotShadowMatrix: [],
		rectArea: [],
		point: [],
		pointShadowMap: [],
		pointShadowMatrix: [],
		hemi: []

	};

	var vector3 = new Vector3();
	var matrix4 = new Matrix4();
	var matrix42 = new Matrix4();

	function filterItems( items, channel ) {

		return items.filter( function ( item ) {

			return item === null || channel.test( item );

		} );

	}

	function getLightsByChannel( channel ) {

		var ambient = [ 0, 0, 0 ];

		this.state.ambients
			.forEach( function ( light ) {

				if ( channel.test( light ) ) {

					ambient[ 0 ] += light.r;
					ambient[ 1 ] += light.g;
					ambient[ 2 ] += light.b;

				}

			} );

		var directionals = filterItems( this.state.directional, channel ),
			directionalShadowMap = filterItems( this.state.directionalShadowMap, channel ),
			directionalShadowMatrix = filterItems( this.state.directionalShadowMatrix, channel ),

			spots = filterItems( this.state.spot, channel ),
			spotShadowMap = filterItems( this.state.spotShadowMap, channel ),
			spotShadowMatrix = filterItems( this.state.spotShadowMatrix, channel ),

			points = filterItems( this.state.point, channel ),
			pointShadowMap = filterItems( this.state.pointShadowMap, channel ),
			pointShadowMatrix = filterItems( this.state.pointShadowMatrix, channel ),

			rectArea = filterItems( this.state.rectArea, channel ),
			hemi = filterItems( this.state.hemi, channel );



		return {
			ambient: ambient,
			directional: directionals,
			directionalShadowMap: directionalShadowMap,
			directionalShadowMatrix: directionalShadowMatrix,
			spot: spots,
			spotShadowMap: spotShadowMap,
			spotShadowMatrix: spotShadowMatrix,
			rectArea: rectArea,
			point: points,
			pointShadowMap: pointShadowMap,
			pointShadowMatrix: pointShadowMatrix,
			hemi: hemi,

			hash: [ channel.mask, directionals.length, points.length, spots.length, rectArea.length, hemi.length ].join( ',' ),
		};

	}

	function setup( lights, shadows, camera ) {

		var r = 0, g = 0, b = 0;

		var ambientLength = 0;

		var directionalLength = 0;
		var pointLength = 0;
		var spotLength = 0;
		var rectAreaLength = 0;
		var hemiLength = 0;

		var viewMatrix = camera.matrixWorldInverse;

		for ( var i = 0, l = lights.length; i < l; i ++ ) {

			var light = lights[ i ];

			var color = light.color;
			var intensity = light.intensity;
			var distance = light.distance;

			var shadowMap = ( light.shadow && light.shadow.map ) ? light.shadow.map.texture : null;

			if ( shadowMap ) {

				shadowMap.mask = light.channel.mask;
				light.shadow.matrix.mask = light.channel.mask;

			}

			if ( light.isAmbientLight ) {

				r += color.r * intensity;
				g += color.g * intensity;
				b += color.b * intensity;

				state.ambients[ ambientLength ++ ] = {
					mask: light.channel.mask,
					r: r,
					g: g,
					b: b,
				};

			} else if ( light.isDirectionalLight ) {

				var uniforms = cache.get( light );

				uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
				uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				vector3.setFromMatrixPosition( light.target.matrixWorld );
				uniforms.direction.sub( vector3 );
				uniforms.direction.transformDirection( viewMatrix );

				uniforms.shadow = light.castShadow;

				if ( light.castShadow ) {

					var shadow = light.shadow;

					uniforms.shadowBias = shadow.bias;
					uniforms.shadowRadius = shadow.radius;
					uniforms.shadowMapSize = shadow.mapSize;

				}

				state.directionalShadowMap[ directionalLength ] = shadowMap;
				state.directionalShadowMatrix[ directionalLength ] = light.shadow.matrix;
				state.directional[ directionalLength ] = uniforms;

				directionalLength ++;

			} else if ( light.isSpotLight ) {

				var uniforms = cache.get( light );

				uniforms.position.setFromMatrixPosition( light.matrixWorld );
				uniforms.position.applyMatrix4( viewMatrix );

				uniforms.color.copy( color ).multiplyScalar( intensity );
				uniforms.distance = distance;

				uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				vector3.setFromMatrixPosition( light.target.matrixWorld );
				uniforms.direction.sub( vector3 );
				uniforms.direction.transformDirection( viewMatrix );

				uniforms.coneCos = Math.cos( light.angle );
				uniforms.penumbraCos = Math.cos( light.angle * ( 1 - light.penumbra ) );
				uniforms.decay = ( light.distance === 0 ) ? 0.0 : light.decay;

				uniforms.shadow = light.castShadow;

				if ( light.castShadow ) {

					var shadow = light.shadow;

					uniforms.shadowBias = shadow.bias;
					uniforms.shadowRadius = shadow.radius;
					uniforms.shadowMapSize = shadow.mapSize;

				}

				state.spotShadowMap[ spotLength ] = shadowMap;
				state.spotShadowMatrix[ spotLength ] = light.shadow.matrix;
				state.spot[ spotLength ] = uniforms;

				spotLength ++;

			} else if ( light.isRectAreaLight ) {

				var uniforms = cache.get( light );

				// (a) intensity controls irradiance of entire light
				uniforms.color
					.copy( color )
					.multiplyScalar( intensity / ( light.width * light.height ) );

				// (b) intensity controls the radiance per light area
				// uniforms.color.copy( color ).multiplyScalar( intensity );

				uniforms.position.setFromMatrixPosition( light.matrixWorld );
				uniforms.position.applyMatrix4( viewMatrix );

				// extract local rotation of light to derive width/height half vectors
				matrix42.identity();
				matrix4.copy( light.matrixWorld );
				matrix4.premultiply( viewMatrix );
				matrix42.extractRotation( matrix4 );

				uniforms.halfWidth.set( light.width * 0.5, 0.0, 0.0 );
				uniforms.halfHeight.set( 0.0, light.height * 0.5, 0.0 );

				uniforms.halfWidth.applyMatrix4( matrix42 );
				uniforms.halfHeight.applyMatrix4( matrix42 );

				// TODO (abelnation): RectAreaLight distance?
				// uniforms.distance = distance;

				state.rectArea[ rectAreaLength ] = uniforms;

				rectAreaLength ++;

			} else if ( light.isPointLight ) {

				var uniforms = cache.get( light );

				uniforms.position.setFromMatrixPosition( light.matrixWorld );
				uniforms.position.applyMatrix4( viewMatrix );

				uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
				uniforms.distance = light.distance;
				uniforms.decay = ( light.distance === 0 ) ? 0.0 : light.decay;

				uniforms.shadow = light.castShadow;

				if ( light.castShadow ) {

					var shadow = light.shadow;

					uniforms.shadowBias = shadow.bias;
					uniforms.shadowRadius = shadow.radius;
					uniforms.shadowMapSize = shadow.mapSize;
					uniforms.shadowCameraNear = shadow.camera.near;
					uniforms.shadowCameraFar = shadow.camera.far;

				}

				state.pointShadowMap[ pointLength ] = shadowMap;
				state.pointShadowMatrix[ pointLength ] = light.shadow.matrix;
				state.point[ pointLength ] = uniforms;

				pointLength ++;

			} else if ( light.isHemisphereLight ) {

				var uniforms = cache.get( light );

				uniforms.direction.setFromMatrixPosition( light.matrixWorld );
				uniforms.direction.transformDirection( viewMatrix );
				uniforms.direction.normalize();

				uniforms.skyColor.copy( light.color ).multiplyScalar( intensity );
				uniforms.groundColor.copy( light.groundColor ).multiplyScalar( intensity );

				state.hemi[ hemiLength ] = uniforms;

				hemiLength ++;

			}

		}

		state.ambient[ 0 ] = r;
		state.ambient[ 1 ] = g;
		state.ambient[ 2 ] = b;

		state.ambients.length = ambientLength;
		state.directional.length = directionalLength;
		state.spot.length = spotLength;
		state.rectArea.length = rectAreaLength;
		state.point.length = pointLength;
		state.hemi.length = hemiLength;

		// TODO (sam-g-steel) why aren't we using join
		state.hash = directionalLength + ',' + pointLength + ',' + spotLength + ',' + rectAreaLength + ',' + hemiLength + ',' + shadows.length;

	}

	return {
		getLightsByChannel: getLightsByChannel,
		setup: setup,
		state: state
	};

}


export { WebGLLights };
