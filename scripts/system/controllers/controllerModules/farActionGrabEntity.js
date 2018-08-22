"use strict";

//  farActionGrabEntity.js
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

/* jslint bitwise: true */

/* global Script, Controller, RIGHT_HAND, LEFT_HAND, Mat4, MyAvatar, Vec3, Camera, Quat,
   getGrabPointSphereOffset, getEnabledModuleByName, makeRunningValues, Entities,
   enableDispatcherModule, disableDispatcherModule, entityIsDistanceGrabbable, entityIsGrabbable,
   makeDispatcherModuleParameters, MSECS_PER_SEC, HAPTIC_PULSE_STRENGTH, HAPTIC_PULSE_DURATION,
   PICK_MAX_DISTANCE, COLORS_GRAB_SEARCHING_HALF_SQUEEZE, COLORS_GRAB_SEARCHING_FULL_SQUEEZE, COLORS_GRAB_DISTANCE_HOLD,
   DEFAULT_SEARCH_SPHERE_DISTANCE, TRIGGER_OFF_VALUE, TRIGGER_ON_VALUE, ZERO_VEC, ensureDynamic,
   getControllerWorldLocation, projectOntoEntityXYPlane, ContextOverlay, HMD, Reticle, Overlays, isPointingAtUI
   Picks, makeLaserLockInfo Xform, makeLaserParams, AddressManager, getEntityParents, Selection, DISPATCHER_HOVERING_LIST
*/

Script.include("/~/system/libraries/controllerDispatcherUtils.js");
Script.include("/~/system/libraries/controllers.js");
Script.include("/~/system/libraries/Xform.js");

(function() {
    var GRABBABLE_PROPERTIES = [
        "position",
        "registrationPoint",
        "rotation",
        "gravity",
        "collidesWith",
        "dynamic",
        "collisionless",
        "locked",
        "name",
        "shapeType",
        "parentID",
        "parentJointIndex",
        "density",
        "dimensions",
        "userData"
    ];

    var MARGIN = 25;

    function TargetObject(entityID, entityProps) {
        this.entityID = entityID;
        this.entityProps = entityProps;
        this.targetEntityID = null;
        this.targetEntityProps = null;
        this.previousCollisionStatus = null;
        this.madeDynamic = null;

        this.makeDynamic = function() {
            if (this.targetEntityID) {
                var newProps = {
                    dynamic: true,
                    collisionless: true
                };
                this.previousCollisionStatus = this.targetEntityProps.collisionless;
                Entities.editEntity(this.targetEntityID, newProps);
                this.madeDynamic = true;
            }
        };

        this.restoreTargetEntityOriginalProps = function() {
            if (this.madeDynamic) {
                var props = {};
                props.dynamic = false;
                props.collisionless = this.previousCollisionStatus;
                var zeroVector = {x: 0, y: 0, z:0};
                props.localVelocity = zeroVector;
                props.localRotation = zeroVector;
                Entities.editEntity(this.targetEntityID, props);
            }
        };

        this.getTargetEntity = function() {
            var parentPropsLength = this.parentProps.length;
            if (parentPropsLength !== 0) {
                var targetEntity = {
                    id: this.parentProps[parentPropsLength - 1].id,
                    props: this.parentProps[parentPropsLength - 1]};
                this.targetEntityID = targetEntity.id;
                this.targetEntityProps = targetEntity.props;
                return targetEntity;
            }
            this.targetEntityID = this.entityID;
            this.targetEntityProps = this.entityProps;
            return {
                id: this.entityID,
                props: this.entityProps};
        };
    }

    function FarActionGrabEntity(hand) {
        var _this = this;
        this.hand = hand;
        this.grabbedThingID = null;
        this.targetObject = null;
        this.actionID = null; // action this script created...
        this.entityToLockOnto = null;
        this.potentialEntityWithContextOverlay = false;
        this.entityWithContextOverlay = false;
        this.contextOverlayTimer = false;
        this.previousCollisionStatus = false;
        this.locked = false;
        this.highlightedEntity = null;
        this.reticleMinX = MARGIN;
        this.reticleMaxX;
        this.reticleMinY = MARGIN;
        this.reticleMaxY;

        var ACTION_TTL = 15; // seconds

        var DISTANCE_HOLDING_RADIUS_FACTOR = 3.5; // multiplied by distance between hand and object
        var DISTANCE_HOLDING_ACTION_TIMEFRAME = 0.1; // how quickly objects move to their new position
        var DISTANCE_HOLDING_UNITY_MASS = 1200; //  The mass at which the distance holding action timeframe is unmodified
        var DISTANCE_HOLDING_UNITY_DISTANCE = 6; //  The distance at which the distance holding action timeframe is unmodified

        this.parameters = makeDispatcherModuleParameters(
            550,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100);
            //makeLaserParams(this.hand, false));


        this.handToController = function() {
            return (this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand;
        };

        this.distanceGrabTimescale = function(mass, distance) {
            var timeScale = DISTANCE_HOLDING_ACTION_TIMEFRAME * mass /
                DISTANCE_HOLDING_UNITY_MASS * distance /
                DISTANCE_HOLDING_UNITY_DISTANCE;
            if (timeScale < DISTANCE_HOLDING_ACTION_TIMEFRAME) {
                timeScale = DISTANCE_HOLDING_ACTION_TIMEFRAME;
            }
            return timeScale;
        };

        this.getMass = function(dimensions, density) {
            return (dimensions.x * dimensions.y * dimensions.z) * density;
        };

        this.startFarGrabAction = function (controllerData, grabbedProperties) {
            var controllerLocation = controllerData.controllerLocations[this.hand];
            var worldControllerPosition = controllerLocation.position;
            var worldControllerRotation = controllerLocation.orientation;

            // transform the position into room space
            var worldToSensorMat = Mat4.inverse(MyAvatar.getSensorToWorldMatrix());
            var roomControllerPosition = Mat4.transformPoint(worldToSensorMat, worldControllerPosition);

            var now = Date.now();

            // add the action and initialize some variables
            this.currentObjectPosition = grabbedProperties.position;
            this.currentObjectRotation = grabbedProperties.rotation;
            this.currentObjectTime = now;
            this.currentCameraOrientation = Camera.orientation;

            this.grabRadius = this.grabbedDistance;
            this.grabRadialVelocity = 0.0;

            // offset between controller vector at the grab radius and the entity position
            var targetPosition = Vec3.multiply(this.grabRadius, Quat.getUp(worldControllerRotation));
            targetPosition = Vec3.sum(targetPosition, worldControllerPosition);
            this.offsetPosition = Vec3.subtract(this.currentObjectPosition, targetPosition);

            // compute a constant based on the initial conditions which we use below to exaggerate hand motion
            // onto the held object
            this.radiusScalar = Math.log(this.grabRadius + 1.0);
            if (this.radiusScalar < 1.0) {
                this.radiusScalar = 1.0;
            }

            // compute the mass for the purpose of energy and how quickly to move object
            this.mass = this.getMass(grabbedProperties.dimensions, grabbedProperties.density);
            var distanceToObject = Vec3.length(Vec3.subtract(MyAvatar.position, grabbedProperties.position));
            var timeScale = this.distanceGrabTimescale(this.mass, distanceToObject);
            this.linearTimeScale = timeScale;
            this.actionID = Entities.addAction("far-grab", this.grabbedThingID, {
                targetPosition: this.currentObjectPosition,
                linearTimeScale: timeScale,
                targetRotation: this.currentObjectRotation,
                angularTimeScale: timeScale,
                tag: "far-grab-" + MyAvatar.sessionUUID,
                ttl: ACTION_TTL
            });
            if (this.actionID === Uuid.NULL) {
                this.actionID = null;
            }

            if (this.actionID !== null) {
                var args = [this.hand === RIGHT_HAND ? "right" : "left", MyAvatar.sessionUUID];
                Entities.callEntityMethod(this.grabbedThingID, "startDistanceGrab", args);
            }

            Controller.triggerHapticPulse(HAPTIC_PULSE_STRENGTH, HAPTIC_PULSE_DURATION, this.hand);
            this.previousRoomControllerPosition = roomControllerPosition;
        };

        this.continueDistanceHolding = function(controllerData) {
            var controllerLocation = controllerData.controllerLocations[this.hand];
            var worldControllerPosition = controllerLocation.position;
            var worldControllerRotation = controllerLocation.orientation;

            // also transform the position into room space
            var worldToSensorMat = Mat4.inverse(MyAvatar.getSensorToWorldMatrix());
            var roomControllerPosition = Mat4.transformPoint(worldToSensorMat, worldControllerPosition);

            var grabbedProperties = Entities.getEntityProperties(this.grabbedThingID, GRABBABLE_PROPERTIES);
            var now = Date.now();
            var deltaObjectTime = (now - this.currentObjectTime) / MSECS_PER_SEC; // convert to seconds
            this.currentObjectTime = now;

            // the action was set up when this.distanceHolding was called.  update the targets.
            var radius = Vec3.distance(this.currentObjectPosition, worldControllerPosition) *
                this.radiusScalar * DISTANCE_HOLDING_RADIUS_FACTOR;
            if (radius < 1.0) {
                radius = 1.0;
            }

            var roomHandDelta = Vec3.subtract(roomControllerPosition, this.previousRoomControllerPosition);
            var worldHandDelta = Mat4.transformVector(MyAvatar.getSensorToWorldMatrix(), roomHandDelta);
            var handMoved = Vec3.multiply(worldHandDelta, radius);
            this.currentObjectPosition = Vec3.sum(this.currentObjectPosition, handMoved);

            var args = [this.hand === RIGHT_HAND ? "right" : "left", MyAvatar.sessionUUID];
            Entities.callEntityMethod(this.grabbedThingID, "continueDistanceGrab", args);

            //  Update radialVelocity
            var lastVelocity = Vec3.multiply(worldHandDelta, 1.0 / deltaObjectTime);
            var delta = Vec3.normalize(Vec3.subtract(grabbedProperties.position, worldControllerPosition));
            var newRadialVelocity = Vec3.dot(lastVelocity, delta);

            var VELOCITY_AVERAGING_TIME = 0.016;
            var blendFactor = deltaObjectTime / VELOCITY_AVERAGING_TIME;
            if (blendFactor < 0.0) {
                blendFactor = 0.0;
            } else if (blendFactor > 1.0) {
                blendFactor = 1.0;
            }
            this.grabRadialVelocity = blendFactor * newRadialVelocity + (1.0 - blendFactor) * this.grabRadialVelocity;

            var RADIAL_GRAB_AMPLIFIER = 10.0;
            if (Math.abs(this.grabRadialVelocity) > 0.0) {
                this.grabRadius = this.grabRadius + (this.grabRadialVelocity * deltaObjectTime *
                                                     this.grabRadius * RADIAL_GRAB_AMPLIFIER);
            }

            // don't let grabRadius go all the way to zero, because it can't come back from that
            var MINIMUM_GRAB_RADIUS = 0.1;
            if (this.grabRadius < MINIMUM_GRAB_RADIUS) {
                this.grabRadius = MINIMUM_GRAB_RADIUS;
            }
            var newTargetPosition = Vec3.multiply(this.grabRadius, Quat.getUp(worldControllerRotation));
            newTargetPosition = Vec3.sum(newTargetPosition, worldControllerPosition);
            newTargetPosition = Vec3.sum(newTargetPosition, this.offsetPosition);

            // XXX
            // this.maybeScale(grabbedProperties);

            var distanceToObject = Vec3.length(Vec3.subtract(MyAvatar.position, this.currentObjectPosition));

            this.linearTimeScale = (this.linearTimeScale / 2);
            if (this.linearTimeScale <= DISTANCE_HOLDING_ACTION_TIMEFRAME) {
                this.linearTimeScale = DISTANCE_HOLDING_ACTION_TIMEFRAME;
            }
            var success = Entities.updateAction(this.grabbedThingID, this.actionID, {
                targetPosition: newTargetPosition,
                linearTimeScale: this.linearTimeScale,
                targetRotation: this.currentObjectRotation,
                angularTimeScale: this.distanceGrabTimescale(this.mass, distanceToObject),
                ttl: ACTION_TTL
            });
            if (!success) {
                print("continueDistanceHolding -- updateAction failed: " + this.actionID);
                this.actionID = null;
            }

            this.previousRoomControllerPosition = roomControllerPosition;
        };

        this.endFarGrabAction = function () {
            ensureDynamic(this.grabbedThingID);
            this.distanceHolding = false;
            this.distanceRotating = false;
            Entities.deleteAction(this.grabbedThingID, this.actionID);

            var args = [this.hand === RIGHT_HAND ? "right" : "left", MyAvatar.sessionUUID];
            Entities.callEntityMethod(this.grabbedThingID, "releaseGrab", args);
            if (this.targetObject) {
                this.targetObject.restoreTargetEntityOriginalProps();
            }
            this.actionID = null;
            this.grabbedThingID = null;
            this.targetObject = null;
            this.potentialEntityWithContextOverlay = false;
        };

        this.updateRecommendedArea = function() {
            var dims = Controller.getViewportDimensions();
            this.reticleMaxX = dims.x - MARGIN;
            this.reticleMaxY = dims.y - MARGIN;
        };

        this.calculateNewReticlePosition = function(intersection) {
            this.updateRecommendedArea();
            var point2d = HMD.overlayFromWorldPoint(intersection);
            point2d.x = Math.max(this.reticleMinX, Math.min(point2d.x, this.reticleMaxX));
            point2d.y = Math.max(this.reticleMinY, Math.min(point2d.y, this.reticleMaxY));
            return point2d;
        };

        this.notPointingAtEntity = function(controllerData) {
            var intersection = controllerData.rayPicks[this.hand];
            var entityProperty = Entities.getEntityProperties(intersection.objectID);
            var entityType = entityProperty.type;
            var hudRayPick = controllerData.hudRayPicks[this.hand];
            var point2d = this.calculateNewReticlePosition(hudRayPick.intersection);
            if ((intersection.type === Picks.INTERSECTED_ENTITY && entityType === "Web") ||
                intersection.type === Picks.INTERSECTED_OVERLAY || Window.isPointOnDesktopWindow(point2d)) {
                return true;
            }
            return false;
        };

        this.distanceRotate = function(otherFarGrabModule) {
            this.distanceRotating = true;
            this.distanceHolding = false;

            var worldControllerRotation = getControllerWorldLocation(this.handToController(), true).orientation;
            var controllerRotationDelta =
                Quat.multiply(worldControllerRotation, Quat.inverse(this.previousWorldControllerRotation));
            // Rotate entity by twice the delta rotation.
            controllerRotationDelta = Quat.multiply(controllerRotationDelta, controllerRotationDelta);

            // Perform the rotation in the translation controller's action update.
            otherFarGrabModule.currentObjectRotation = Quat.multiply(controllerRotationDelta,
                otherFarGrabModule.currentObjectRotation);

            this.previousWorldControllerRotation = worldControllerRotation;
        };

        this.prepareDistanceRotatingData = function(controllerData) {
            var intersection = controllerData.rayPicks[this.hand];

            var controllerLocation = getControllerWorldLocation(this.handToController(), true);
            var worldControllerPosition = controllerLocation.position;
            var worldControllerRotation = controllerLocation.orientation;

            var grabbedProperties = Entities.getEntityProperties(intersection.objectID, GRABBABLE_PROPERTIES);
            this.currentObjectPosition = grabbedProperties.position;
            this.grabRadius = intersection.distance;

            // Offset between controller vector at the grab radius and the entity position.
            var targetPosition = Vec3.multiply(this.grabRadius, Quat.getUp(worldControllerRotation));
            targetPosition = Vec3.sum(targetPosition, worldControllerPosition);
            this.offsetPosition = Vec3.subtract(this.currentObjectPosition, targetPosition);

            // Initial controller rotation.
            this.previousWorldControllerRotation = worldControllerRotation;
        };

        this.destroyContextOverlay = function(controllerData) {
            if (this.entityWithContextOverlay) {
                ContextOverlay.destroyContextOverlay(this.entityWithContextOverlay);
                this.entityWithContextOverlay = false;
                this.potentialEntityWithContextOverlay = false;
            }
        };

        this.targetIsNull = function() {
            var properties = Entities.getEntityProperties(this.grabbedThingID);
            if (Object.keys(properties).length === 0 && this.distanceHolding) {
                return true;
            }
            return false;
        };

        this.handLine1 = Uuid.NULL;
        this.handLine2 = Uuid.NULL;

        this.updateHandLine = function (ctrlrPick) {
            var triggerVal = Controller.getValue((this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            if (Uuid.isEqual(this.handLine1, Uuid.NULL)) {
                // We don't have a line yet...
                // This is the segment that originates from the hand controller and ends at the LERP between start and end.
                this.handLine1 = Overlays.addOverlay("line3d",
                    {
                        name: "handLine1",
                        color: EXP3_FARGRAB_LOADED_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        position: ctrlrPick.searchRay.position,
                        glow: 1,
                        lineWidth: 0.06,
                        visible: false
                    });
            }
            if (Uuid.isEqual(this.handLine2, Uuid.NULL)) {
                // This is the segment that originates from the LERP between overall line's start and end, and the endpoint
                this.handLine2 = Overlays.addOverlay("line3d",
                    {
                        name: "handLine2",
                        color: EXP3_FARGRAB_LOADING_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        position: ctrlrPick.searchRay.position,
                        glow: 1,
                        lineWidth: 0.06,
                        visible: false
                    });
            }

            if (this.grabbedThingID) {
                var props = Entities.getEntityProperties(this.grabbedThingID, ["position"]);
                Overlays.editOverlay(this.handLine1, {
                    position: ctrlrPick.searchRay.origin,
                    endParentID: this.grabbedThingID,
                    endPoint: props.position,
                    color: BRIGHT_TEAL,                 // Color for actually having grabbed something.
                    visible: true
                });
                Overlays.editOverlay(this.handLine2, {
                    visible: false
                });
            } else if (ctrlrPick.intersects) {
                var startPos = ctrlrPick.searchRay.origin;
                var endPos = ctrlrPick.intersection;
                var progressPos = (triggerVal > 0) ? lerp(startPos, endPos, triggerVal) : startPos;
                var tmp = Vec3.subtract(ctrlrPick.intersection, ctrlrPick.searchRay.origin);
                var dir = ctrlrPick.searchRay.direction;
                var angle = toDegrees(Vec3.getAngle(dir, tmp));
                // We have an endpoint
                Overlays.editOverlay(this.handLine1, {
                    position: startPos,
                    endParentID: null,
                    endPoint: progressPos,
                    color: YELLOW,                      // Color that slowly fills line.
                    lineWidth: 0.08,
                    visible: (triggerVal < 0.01) ? false : true
                });
                Overlays.editOverlay(this.handLine2, {
                    position: progressPos,
                    endPoint: endPos,
                    color: BRIGHT_TEAL,                 // Color the recedes in line.
                    visible: true
                });
            } else {
                Overlays.editOverlay(this.handLine1, {
                    position: ctrlrPick.searchRay.origin,
                    endPoint: Vec3.sum(ctrlrPick.searchRay.origin, Vec3.multiply(10, ctrlrPick.searchRay.direction)),
                    endParentID: null,
                    color: LIGHT_TEAL,                  // Color for no intersection.
                    lineWidth: 0.06,
                    visible: true
                });

                Overlays.editOverlay(this.handLine2, {
                    visible: false
                });
            }
        };

        // Lazy utility function for disabling both lasers.
        this.setLasersVisibility = function (viz) {
            Overlays.editOverlay(this.handLine1, { visible: viz });
            Overlays.editOverlay(this.handLine2, { visible: viz });
        }

        this.getOtherModule = function () {
            var otherModule = this.hand === RIGHT_HAND ? leftFarActionGrabEntity : rightFarActionGrabEntity;
            return otherModule;
        };

        this.goodToStart = false;

        this.headAngularVelocity = 0;
        this.handLinearVelocity = Vec3.ZERO;
        this.lastHMDOrientation = Quat.IDENTITY;

        this.wasPointing = false;

        this.delay = 0;

        this.active = false;

        this.updateBoundsChecks = function () {
            var handPose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            var handRotation = Quat.multiply(MyAvatar.orientation, (this.hand == LEFT_HAND) ? MyAvatar.leftHandPose.rotation : MyAvatar.rightHandPose.rotation);
            var cameraOrientation = Quat.getFront(Camera.orientation);
            var handOrientation = Quat.getUp(handRotation);
            var rotBetween = Quat.rotationBetween(cameraOrientation, handOrientation);
            var pitchRotation = cancelYawAndRoll(rotBetween);
            var yawRotation = cancelPitchAndRoll(rotBetween);
            var angleBetweenHorizontal = toDegrees(Quat.angle(yawRotation));
            var angleBetweenVertical = toDegrees(Quat.angle(pitchRotation));

            this.outOfBounds = ((angleBetweenHorizontal >= EXP3_FARGRAB_HORIZONTAL_BEAM_OFF_ANGLE) || (angleBetweenVertical >= EXP3_FARGRAB_VERTICAL_BEAM_OFF_ANGLE));
            this.inBounds = ((angleBetweenHorizontal <= EXP3_FARGRAB_HORIZONTAL_BEAM_ON_ANGLE) && (angleBetweenVertical <= EXP3_FARGRAB_VERTICAL_BEAM_ON_ANGLE));
        }

        this.isPointing = function () {
            return Controller.getValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightIndexPoint : Controller.Standard.LeftIndexPoint);
        }

        this.handSteady = function (controllerData) {
            return ((EXP3_USE_CTRLR_VELOCITY) ? (Vec3.length(controllerData.handLinearVelocity[this.hand]) <= EXP3_MAX_CTRLR_VELOCITY) : true);
        }

        this.headSteady = function (controllerData) {
            return ((EXP3_USE_HEAD_VELOCITY) ? (controllerData.headAngularVelocity < EXP3_HEAD_MAX_ANGULAR_VELOCITY) : true);
        }

        this.inBounds = false;
        this.outOfBounds = false;

        this.isReady = function (controllerData, deltaTime) {
            if (!EXP3_USE_FARGRAB || !HMD.active) {
                this.setLasersVisibility(false);
                return makeRunningValues(false, [], []);
            }

            this.distanceHolding = false;
            this.distanceRotating = false;
            var otherModule = this.getOtherModule();

            // Controller Exp3 activation criteria.
            var headPick = controllerData.rayPicks[AVATAR_HEAD];        // Head raypick.
            var ctrlrPick = controllerData.rayPicks[this.hand];         // Raypick for this hand.
            var rot = controllerData.controllerRotAngles[this.hand];   // Rotation of wrist relative to controller's Z-axis
            
            // Is the index finger pointing?
            var pointing = this.isPointing();

            // Use correct rotation.
            var correctRotation = (EXP3_USE_CTRLR_ROTATION) ? (rot > CONTROLLER_EXP3_FARGRAB_MIN_ANGLE && rot <= CONTROLLER_EXP3_FARGRAB_MAX_ANGLE) : true;

            // Head stability requirement (rotational velocity)
            var correctHeadAngularVelocity = this.headSteady(controllerData);

            // Hand stability requirement (linear velocity)
            var correctControllerLinearVelocity = this.handSteady(controllerData);

            this.updateBoundsChecks();

            // Kill the beam if the controller pointing vector is too far from the look vector.
            if (this.outOfBounds) {
                this.wasPointing = false;
                this.setLasersVisibility(false);
                this.delay = 0;
                this.goodToStart = false;
                return makeRunningValues(false, [], []);
            }

            if (!this.goodToStart && pointing && correctRotation && correctHeadAngularVelocity && correctControllerLinearVelocity && this.inBounds) {
                // Check that teleport isn't active...
                //var teleport = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightTeleporter" : "LeftTeleporter");
                //if (teleport) {
                //    if (teleport.goodToStart) {
                //        teleport.goodToStart = false;
                //        teleport.hideParabola();
                //    }
                //}

                this.goodToStart = true;
                this.wasPointing = true;
                return makeRunningValues(false, [], []);
            } else if (this.goodToStart) {
                // Timed kill conditions.
                //if (this.wasPointing && !pointing) {
                //    this.delay += deltaTime;
                //    if (this.delay >= EXP3_NOT_POINTING_TIMEOUT) {
                //        this.wasPointing = false;
                //        this.setLasersVisibility(false);
                //        this.delay = 0;
                //        this.goodToStart = false;
                //        return makeRunningValues(false, [], []);
                //    }
                //}

                this.setLasersVisibility(true);
                this.updateHandLine(ctrlrPick);

                // If the trigger's pulled, start the action. If not, don't.
                if (controllerData.triggerClicks[this.hand]) {
                    this.prepareDistanceRotatingData(controllerData);
                    this.active = true;
                    this.delay = 0;
                    this.wasPointing = false;
                    return makeRunningValues(true, [], []);
                } else {
                    return makeRunningValues(false, [], []);
                }
            } else {
                // If the activation criteria for turning on the beams wasn't met...
                this.delay = 0;
                this.destroyContextOverlay();
                this.setLasersVisibility(false);
                return makeRunningValues(false, [], []);
            }
        };

        this.run = function (controllerData) {
            this.delay = 0;
            this.updateHandLine(controllerData.rayPicks[this.hand]);
            var handRotation = controllerData.controllerRotAngles[this.hand];
            var correctRotation = (this.ROTATION_ENABLED) ? (handRotation > CONTROLLER_EXP3_FARGRAB_MIN_ANGLE && handRotation <= CONTROLLER_EXP3_FARGRAB_MAX_ANGLE) : true;    // Strip out the ternary operator for final version.
            if (controllerData.triggerValues[this.hand] < TRIGGER_OFF_VALUE ||
                this.notPointingAtEntity(controllerData) || this.targetIsNull()) {
                this.endFarGrabAction();
                Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                    this.highlightedEntity);
                this.highlightedEntity = null;
                this.setLasersVisibility(false);
                this.goodToStart = false;
                this.wasPointing = false;
                this.active = false;
                return makeRunningValues(false, [], []);
            }
            this.intersectionDistance = controllerData.rayPicks[this.hand].distance;

            var otherModuleName =this.hand === RIGHT_HAND ? "LeftFarActionGrabEntity" : "RightFarActionGrabEntity";
            var otherFarGrabModule = getEnabledModuleByName(otherModuleName);

            // gather up the readiness of the near-grab modules
            var nearGrabNames = [
                this.hand === RIGHT_HAND ? "RightScaleAvatar" : "LeftScaleAvatar",
                this.hand === RIGHT_HAND ? "RightFarTriggerEntity" : "LeftFarTriggerEntity",
                this.hand === RIGHT_HAND ? "RightNearActionGrabEntity" : "LeftNearActionGrabEntity",
                this.hand === RIGHT_HAND ? "RightNearParentingGrabEntity" : "LeftNearParentingGrabEntity",
                this.hand === RIGHT_HAND ? "RightNearParentingGrabOverlay" : "LeftNearParentingGrabOverlay"
            ];

            var nearGrabReadiness = [];
            for (var i = 0; i < nearGrabNames.length; i++) {
                var nearGrabModule = getEnabledModuleByName(nearGrabNames[i]);
                var ready = nearGrabModule ? nearGrabModule.isReady(controllerData) : makeRunningValues(false, [], []);
                nearGrabReadiness.push(ready);
            }

            if (this.actionID) {
                // if we are doing a distance grab and the object or tablet gets close enough to the controller,
                // stop the far-grab so the near-grab or equip can take over.
                for (var k = 0; k < nearGrabReadiness.length; k++) {
                    if (nearGrabReadiness[k].active && (nearGrabReadiness[k].targets[0] === this.grabbedThingID
                        || HMD.tabletID && nearGrabReadiness[k].targets[0] === HMD.tabletID)) {
                        this.endFarGrabAction();
                        this.setLasersVisibility(false);
                        this.wasPointing = false;
                        this.active = false;
                        return makeRunningValues(false, [], []);
                    }
                }

                this.continueDistanceHolding(controllerData);
            } else {
                // if we are doing a distance search and this controller moves into a position
                // where it could near-grab something, stop searching.
                for (var j = 0; j < nearGrabReadiness.length; j++) {
                    if (nearGrabReadiness[j].active) {
                        this.endFarGrabAction();
                        this.wasPointing = false;
                        this.active = false;
                        return makeRunningValues(false, [], []);
                    }
                }

                var rayPickInfo = controllerData.rayPicks[this.hand];
                if (rayPickInfo.type === Picks.INTERSECTED_ENTITY) {
                    if (controllerData.triggerClicks[this.hand]) {
                    //if (this.buttonValue === 0) {
                        var entityID = rayPickInfo.objectID;
                        Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                            this.highlightedEntity);
                        this.highlightedEntity = null;
                        var targetProps = Entities.getEntityProperties(entityID, [
                            "dynamic", "shapeType", "position",
                            "rotation", "dimensions", "density",
                            "userData", "locked", "type", "href"
                        ]);
                        if (targetProps.href !== "") {
                            AddressManager.handleLookupString(targetProps.href);
                            this.wasPointing = false;
                            this.active = false;
                            return makeRunningValues(false, [], []);
                        }

                        this.targetObject = new TargetObject(entityID, targetProps);
                        this.targetObject.parentProps = getEntityParents(targetProps);

                        if (this.contextOverlayTimer) {
                            Script.clearTimeout(this.contextOverlayTimer);
                        }
                        this.contextOverlayTimer = false;
                        if (entityID === this.entityWithContextOverlay) {
                            this.destroyContextOverlay();
                        } else {
                            Selection.removeFromSelectedItemsList("contextOverlayHighlightList", "entity", entityID);
                        }

                        var targetEntity = this.targetObject.getTargetEntity();
                        entityID = targetEntity.id;
                        targetProps = targetEntity.props;

                        if (entityIsGrabbable(targetProps) || entityIsGrabbable(this.targetObject.entityProps)) {
                            if (!entityIsDistanceGrabbable(targetProps)) {
                                this.targetObject.makeDynamic();
                            }

                            if (!this.distanceRotating) {
                                this.grabbedThingID = entityID;
                                this.grabbedDistance = rayPickInfo.distance;
                            }

                            if (otherFarGrabModule.grabbedThingID === this.grabbedThingID &&
                                otherFarGrabModule.distanceHolding) {
                                this.prepareDistanceRotatingData(controllerData);
                                this.distanceRotate(otherFarGrabModule);
                            } else {
                                this.distanceHolding = true;
                                this.distanceRotating = false;
                                this.startFarGrabAction(controllerData, targetProps);
                            }
                        }
                    } else {
                        var targetEntityID = rayPickInfo.objectID;
                        if (this.highlightedEntity !== targetEntityID) {
                            Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                                this.highlightedEntity);
                            var selectionTargetProps = Entities.getEntityProperties(targetEntityID, [
                                "dynamic", "shapeType", "position",
                                "rotation", "dimensions", "density",
                                "userData", "locked", "type", "href"
                            ]);

                            var selectionTargetObject = new TargetObject(targetEntityID, selectionTargetProps);
                            selectionTargetObject.parentProps = getEntityParents(selectionTargetProps);
                            var selectionTargetEntity = selectionTargetObject.getTargetEntity();

                            if (entityIsGrabbable(selectionTargetEntity.props) ||
                                entityIsGrabbable(selectionTargetObject.entityProps)) {

                                Selection.addToSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity", rayPickInfo.objectID);
                            }
                            this.highlightedEntity = rayPickInfo.objectID;
                        }

                        if (!this.entityWithContextOverlay) {
                            var _this = this;

                            if (_this.potentialEntityWithContextOverlay !== rayPickInfo.objectID) {
                                if (_this.contextOverlayTimer) {
                                    Script.clearTimeout(_this.contextOverlayTimer);
                                }
                                _this.contextOverlayTimer = false;
                                _this.potentialEntityWithContextOverlay = rayPickInfo.objectID;
                            }

                            if (!_this.contextOverlayTimer) {
                                _this.contextOverlayTimer = Script.setTimeout(function () {
                                    if (!_this.entityWithContextOverlay &&
                                        _this.contextOverlayTimer &&
                                        _this.potentialEntityWithContextOverlay === rayPickInfo.objectID) {
                                        var props = Entities.getEntityProperties(rayPickInfo.objectID);
                                        var pointerEvent = {
                                            type: "Move",
                                            id: _this.hand + 1, // 0 is reserved for hardware mouse
                                            pos2D: projectOntoEntityXYPlane(rayPickInfo.objectID, rayPickInfo.intersection, props),
                                            pos3D: rayPickInfo.intersection,
                                            normal: rayPickInfo.surfaceNormal,
                                            direction: Vec3.subtract(ZERO_VEC, rayPickInfo.surfaceNormal),
                                            button: "Secondary"
                                        };
                                        if (ContextOverlay.createOrDestroyContextOverlay(rayPickInfo.objectID, pointerEvent)) {
                                            _this.entityWithContextOverlay = rayPickInfo.objectID;
                                        }
                                    }
                                    _this.contextOverlayTimer = false;
                                }, 500);
                            }
                        }
                    }
                } else if (this.distanceRotating) {
                    this.distanceRotate(otherFarGrabModule);
                } else if (this.highlightedEntity) {
                    Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity", this.highlightedEntity);
                    this.highlightedEntity = null;
                }
            }
            return this.exitIfDisabled(controllerData);
        };

        this.exitIfDisabled = function(controllerData) {
            var moduleName = this.hand === RIGHT_HAND ? "RightDisableModules" : "LeftDisableModules";
            var disableModule = getEnabledModuleByName(moduleName);
            if (disableModule) {
                if (disableModule.disableModules) {
                    this.endFarGrabAction();
                    Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                        this.highlightedEntity);
                    this.highlightedEntity = null;
                    this.active = false;
                    this.wasPointing = false;
                    return makeRunningValues(false, [], []);
                }
            }
            var grabbedThing = (this.distanceHolding || this.distanceRotating) ? this.targetObject.entityID : null;
            var offset = this.calculateOffset(controllerData);
            var laserLockInfo = makeLaserLockInfo(grabbedThing, false, this.hand, offset);
            return makeRunningValues(true, [], [], laserLockInfo);
        };

        this.calculateOffset = function(controllerData) {
            if (this.distanceHolding || this.distanceRotating) {
                var targetProps = Entities.getEntityProperties(this.targetObject.entityID, [
                    "position",
                    "rotation"
                ]);
                var zeroVector = { x: 0, y: 0, z:0, w: 0 };
                var intersection = controllerData.rayPicks[this.hand].intersection;
                var intersectionMat = new Xform(zeroVector, intersection);
                var modelMat = new Xform(targetProps.rotation, targetProps.position);
                var modelMatInv = modelMat.inv();
                var xformMat = Xform.mul(modelMatInv, intersectionMat);
                var offsetMat = Mat4.createFromRotAndTrans(xformMat.rot, xformMat.pos);
                return offsetMat;
            }
            return undefined;
        };
    }

    var leftFarActionGrabEntity = new FarActionGrabEntity(LEFT_HAND);
    var rightFarActionGrabEntity = new FarActionGrabEntity(RIGHT_HAND);

    enableDispatcherModule("LeftFarActionGrabEntity", leftFarActionGrabEntity);
    enableDispatcherModule("RightFarActionGrabEntity", rightFarActionGrabEntity);

    function cleanup() {
        disableDispatcherModule("LeftFarActionGrabEntity");
        disableDispatcherModule("RightFarActionGrabEntity");
        Overlays.deleteOverlay(this.handLine1);
        Overlays.deleteOverlay(this.handLine2);
    }
    Script.scriptEnding.connect(cleanup);
}());
