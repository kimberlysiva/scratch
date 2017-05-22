  AFRAME.registerComponent('shadow-material', {
      schema: {
          opacity: {default: 0.5}
      },
      init: function () {
          this.material = this.el.getOrCreateObject3D('mesh').material = new THREE.ShadowMaterial();
      },
      update: function () {
          this.material.opacity = this.data.opacity;
      }
  });

  AFRAME.registerComponent('mysunmoon', {
      schema: {
          sunshadow: {default: false},
          moonshadow: {default: false},
          shadowtarget: {type: 'selector'},
          shadowradius: {default: 1.0},
          shadowresolution: {default: 2048}
      },

      init: function () {
          var el = this.el;

          if (!el.isArgon) {
              console.warn('sunmoon should be attached to an <ar-scene>.');
          }
          // requires that you've included 
          if (THREE.SunMoonLights) {
              // this needs geoposed content, so subscribe to geolocation updates
              if (el.isArgon) {
                this.el.subscribeGeolocation();
              }        
              this.sunMoonLights = new THREE.MySunMoonLights();
              window.CESIUM_BASE_URL='https://samples-develop.argonjs.io/resources/cesium/';
          }
      },

      remove: function () {
          var el = this.el;
          if (el.isArgon && this.sunMoonLights) {
              this.sunMoonLights = null;
              this.el.removeObject3D('sunmoon');
          }
      },

      update: function () {
          var el = this.el;
          var data = this.data;

          if (el.isArgon) {
            if (data) {
              this.el.setObject3D('sunmoon', this.sunMoonLights.lights);
              var shadowtarget = data.shadowtarget ? data.shadowtarget.object3D : null;
              if (data.sunshadow) {
                  this.sunMoonLights.enableSunShadows(shadowtarget, data.shadowradius, data.shadowresolution);
              } else {
                  this.sunMoonLights.disableSunShadows();
              }
              if (data.moonshadow) {
                  this.sunMoonLights.enableMoonShadows(shadowtarget, data.shadowradius, data.shadowresolution);
              } else {
                  this.sunMoonLights.disableMoonShadows();
              }
            } else {
              this.el.removeObject3D('sunmoon');
            }
          }
      },

      tick: function () {
        if (this.data && this.sunMoonLights) {
          var context = this.el.argonApp.context;
          this.sunMoonLights.update(context.time,context.defaultReferenceFrame);
        }
      }
  });

  var Cesium = Argon.Cesium;
  var Cartesian3 = Cesium.Cartesian3;
  var JulianDate = Cesium.JulianDate;

  if (typeof(THREE) !== 'undefined') {

      // if we're using THREE, let's create an object that we can use to retrieve 
      // directional lights associated with the  

      THREE.MySunMoonLights = function () {
          // get the natural light entities, make them available
          this.entities = Argon.GetSunMoon();

          // make the moon a dimmer, bluish light.  Not really correct, but a start
          var moonlight = new THREE.DirectionalLight(0x9999aa, 0.25);
          var sunlight = new THREE.DirectionalLight(0xffffff, 1.0);
          this.moon = moonlight;
          this.sun = sunlight;

          // make the lights visible from outside
          lights = new THREE.Object3D();
          this.lights = lights;
          
          // shadows
          var lightDistance = 1;
          var shadowTarget = null;
          var shadowTargetWorldPosition = new THREE.Vector3();
          var showDebugShadowFrustum = false;

          var lastTime = null;
          this.update = function(date, frame) {
              if (!lastTime || JulianDate.secondsDifference(date,lastTime) > 1) {            
                  if (!lastTime) {
                      lastTime = date.clone();
                  }
                  else {
                      date.clone(lastTime)
                  }

                  var positions = Argon.UpdateSunMoon(date, frame);
                  if (shadowTarget != null) {
                      shadowTarget.getWorldPosition(shadowTargetWorldPosition);
                  }

                  var translation = positions.moon;
                  Cartesian3.normalize(translation, translation);
                  Cartesian3.multiplyByScalar(translation, lightDistance, translation);
                  if (shadowTarget != null) {
                      // position the light in relation to the target
                      Cartesian3.add(translation, shadowTargetWorldPosition, translation);
                  }
                  moonlight.position.set(translation.x, translation.y, translation.z);
                  if (translation.y > 0) {
                      lights.remove(moonlight);
                      lights.add(moonlight);
                  } else {
                      lights.remove(moonlight);
                  }

                  translation = positions.sun;
                  Cartesian3.normalize(translation, translation);
                  Cartesian3.multiplyByScalar(translation, lightDistance, translation);
                  if (shadowTarget != null) {
                      // position the light in relation to the target
                      Cartesian3.add(translation, shadowTargetWorldPosition, translation);
                  }
                  sunlight.position.set(translation.x, translation.y, translation.z);
                  if (translation.y > 0) {
                      lights.remove(sunlight);
                      lights.add(sunlight);
                  } else {
                      lights.remove(sunlight);
                  }
              }
          }

          this.enableSunShadows = function(target, radius, resolution) {
              this.configureShadowCamera(sunlight, target, radius, resolution);
          }

          this.disableSunShadows = function() {
              sunlight.castShadow = false;
          }

          this.enableMoonShadows = function(target, radius, resolution) {
              this.configureShadowCamera(moonlight, target, radius, resolution);
          }

          this.disableMoonShadows = function() {
              moonlight.castShadow = false;
          }
          
          this.configureShadowCamera = function(light, target, radius, resolution) {
              var nearPlane = 0.1;
              
              // set the light to follow the target (this only updates the light's direction, NOT its position)
              // note we update the light's position when we get a new sun/moon position
              if (target != null) light.target = target;
              shadowTarget = target;
            
              // the light's position is updated less frequently than the target position
              // this means you don't want a tight frustum around the target (the shadows will jump with the sun/moon position tick)
              // BUT, you also don't want the light positioned too far away, because this causes shadow misalignment (floating point error?)
              var minLightDistance = 10;
              lightDistance = Math.max(nearPlane + radius, minLightDistance);
              
              light.castShadow = true;
              light.shadow.camera.near = nearPlane;
              light.shadow.camera.far = lightDistance + radius;
              light.shadow.camera.top = radius;
              light.shadow.camera.right = radius;
              light.shadow.camera.bottom = -radius;
              light.shadow.camera.left = -radius;
              light.shadow.mapSize.height = resolution;
              light.shadow.mapSize.width = resolution;
              if (showDebugShadowFrustum) {
                  var arScene = document.querySelector('ar-scene');
                  arScene.setObject3D('cameraHelper', new THREE.CameraHelper(light.shadow.camera));
              }
          }
      }
  }