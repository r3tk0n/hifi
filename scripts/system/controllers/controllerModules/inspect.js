"use strict";

//  inspect.js
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

    function InspectEntity(hand) {
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
        this.triggerClicked = false;
        this.justStartedRunning = false;

        var ACTION_TTL = 15; // seconds

        var DISTANCE_HOLDING_RADIUS_FACTOR = 3.5; // multiplied by distance between hand and object
        var DISTANCE_HOLDING_ACTION_TIMEFRAME = 0.1; // how quickly objects move to their new position
        var DISTANCE_HOLDING_UNITY_MASS = 1200; //  The mass at which the distance holding action timeframe is unmodified
        var DISTANCE_HOLDING_UNITY_DISTANCE = 6; //  The distance at which the distance holding action timeframe is unmodified

        this.parameters = makeDispatcherModuleParameters(
            540,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100,
            makeLaserParams(this.hand, true));

        this.handToController = function() {
            return (this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand;
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

        this.isReady = function (controllerData) {
            if (HMD.active) {
                if (this.notPointingAtEntity(controllerData)) {
                    return makeRunningValues(false, [], []);
                }

                this.distanceHolding = false;
                this.distanceRotating = false;
                var rot = controllerData.controllerRotAngles[this.hand];
                var triggerPress = controllerData.triggerValues[this.hand];
                var pressedEnough = (triggerPress >= TRIGGER_OFF_VALUE);
                var correctRotation = (rot >= CONTROLLER_EXP2_INSPECT_MIN_ANGLE && rot < CONTROLLER_EXP2_INSPECT_MAX_ANGLE);

                if (pressedEnough && correctRotation) {
                    if (this.triggerClicked && !controllerData.triggerClicks[this.hand]) {
                        this.prepareDistanceRotatingData(controllerData);
                        this.justStartedRunning = true;
                        return makeRunningValues(true, [], []);
                    }
                    this.triggerClicked = controllerData.triggerClicks[this.hand];
                } else {
                    this.destroyContextOverlay();
                    this.triggerClicked = false;
                    return makeRunningValues(false, [], []);
                }
            }
            this.triggerClicked = false;
            return makeRunningValues(false, [], []);
        };

        this.run = function (controllerData) {
            if (!this.justStartedRunning && !this.triggerClicked) {
                this.highlightedEntity = null;
                this.justStartedRunning = true;
                this.triggerClicked = controllerData.triggerClicks[this.hand];
                return makeRunningValues(false, [], []);
            }
            if (controllerData.triggerValues[this.hand] < TRIGGER_OFF_VALUE ||
                this.notPointingAtEntity(controllerData)) {
                Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                    this.highlightedEntity);
                this.highlightedEntity = null;
                this.triggerClicked = false;
                return makeRunningValues(false, [], []);
            }
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

            // if we are doing a distance search and this controller moves into a position
            // where it could near-grab something, stop searching.
            for (var j = 0; j < nearGrabReadiness.length; j++) {
                if (nearGrabReadiness[j].active) {
                    this.triggerClicked = false;
                    return makeRunningValues(false, [], []);
                }
            }
            
            var rayPickInfo = controllerData.rayPicks[this.hand];
            if (rayPickInfo.type === Picks.INTERSECTED_ENTITY) {
                if (controllerData.triggerClicks[this.hand]) {
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
                        this.triggerClicked = false;
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
            } else if (this.highlightedEntity) {
                Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity", this.highlightedEntity);
                this.highlightedEntity = null;
            }
            return this.exitIfDisabled(controllerData);
        }

        this.exitIfDisabled = function(controllerData) {
            var moduleName = this.hand === RIGHT_HAND ? "RightDisableModules" : "LeftDisableModules";
            var disableModule = getEnabledModuleByName(moduleName);
            if (disableModule) {
                if (disableModule.disableModules) {
                    Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity",
                        this.highlightedEntity);
                    this.highlightedEntity = null;
                    this.triggerClicked = false;
                    this.justStartedRunning = false;
                    return makeRunningValues(false, [], []);
                }
            }
            this.triggerClicked = controllerData.triggerClicks[this.hand];
            return makeRunningValues(true, [], []);
        };

    }

    var leftInspectEntity = new InspectEntity(LEFT_HAND);
    var rightInspectEntity = new InspectEntity(RIGHT_HAND);

    enableDispatcherModule("LeftInspectEntity", leftInspectEntity);
    enableDispatcherModule("RightInspectEntity", rightInspectEntity);

    function cleanup() {
        disableDispatcherModule("LeftInspectEntity");
        disableDispatcherModule("RightInspectEntity");
    }
    Script.scriptEnding.connect(cleanup);

}());
