"use strict";

// Created by james b. pollack @imgntn on 7/2/2016
// Copyright 2016 High Fidelity, Inc.
//
//  Creates a beam and target and then teleports you there.  Release when its close to you to cancel.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

/* jslint bitwise: true */

/* global Script, Entities, MyAvatar, Controller, RIGHT_HAND, LEFT_HAND,
   enableDispatcherModule, disableDispatcherModule, Messages, makeDispatcherModuleParameters, makeRunningValues, Vec3,
   HMD, Uuid, AvatarList, Picks, Pointers, PickType
*/

Script.include("/~/system/libraries/Xform.js");
Script.include("/~/system/libraries/controllerDispatcherUtils.js");
Script.include("/~/system/libraries/controllers.js");

(function() { // BEGIN LOCAL_SCOPE

    var TARGET_MODEL_URL = Script.resolvePath("../../assets/models/teleport-destination.fbx");
    var SEAT_MODEL_URL = Script.resolvePath("../../assets/models/teleport-seat.fbx");

    var TARGET_MODEL_DIMENSIONS = {
        x: 1.15,
        y: 0.5,
        z: 1.15
    };

    var COLORS_TELEPORT_SEAT = {
        red: 255,
        green: 0,
        blue: 170
    };

    var COLORS_TELEPORT_CAN_TELEPORT = {
        red: 97,
        green: 247,
        blue: 255
    };

    var COLORS_TELEPORT_CANCEL = {
        red: 255,
        green: 184,
        blue: 73
    };

    var handInfo = {
        right: {
            controllerInput: Controller.Standard.RightHand
        },
        left: {
            controllerInput: Controller.Standard.LeftHand
        }
    };

    var cancelPath = {
        color: COLORS_TELEPORT_CANCEL,
        alpha: 1,
        width: 0.025
    };
    var teleportPath = {
        color: COLORS_TELEPORT_CAN_TELEPORT,
        alpha: 1,
        width: 0.025
    };
    var seatPath = {
        color: COLORS_TELEPORT_SEAT,
        alpha: 1,
        width: 0.025
    };
    var teleportEnd = {
        type: "model",
        url: TARGET_MODEL_URL,
        dimensions: TARGET_MODEL_DIMENSIONS,
        ignorePickIntersection: true
    };
    var seatEnd = {
        type: "model",
        url: SEAT_MODEL_URL,
        dimensions: TARGET_MODEL_DIMENSIONS,
        ignorePickIntersection: true
    };


    var teleportRenderStates = [{name: "cancel", path: cancelPath},
        {name: "teleport", path: teleportPath, end: teleportEnd},
        {name: "seat", path: seatPath, end: seatEnd}];

    var DEFAULT_DISTANCE = 8.0;
    var teleportDefaultRenderStates = [{name: "cancel", distance: DEFAULT_DISTANCE, path: cancelPath}];

    var ignoredEntities = [];


    var TELEPORTER_STATES = {
        IDLE: 'idle',
        TARGETTING: 'targetting',
        TARGETTING_INVALID: 'targetting_invalid'
    };

    var TARGET = {
        NONE: 'none', // Not currently targetting anything
        INVISIBLE: 'invisible', // The current target is an invvsible surface
        INVALID: 'invalid', // The current target is invalid (wall, ceiling, etc.)
        SURFACE: 'surface', // The current target is a valid surface
        SEAT: 'seat' // The current target is a seat
    };

    var speed = 12.0;
    var accelerationAxis = {x: 0.0, y: -5.0, z: 0.0};

    function Teleporter(hand) {
        var _this = this;
        this.hand = hand;
        this.buttonValue = 0;
        this.disabled = false; // used by the 'Hifi-Teleport-Disabler' message handler
        this.active = false;
        this.state = TELEPORTER_STATES.IDLE;
        this.currentTarget = TARGET.INVALID;
        this.currentResult = null;

        this.getOtherModule = function() {
            var otherModule = this.hand === RIGHT_HAND ? leftTeleporter : rightTeleporter;
            return otherModule;
        };

        this.teleportParabolaHandVisible = Pointers.createPointer(PickType.Parabola, {
            joint: (_this.hand === RIGHT_HAND) ? "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" : "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND",
            dirOffset: { x: 0, y: 1, z: 0.1 },
            posOffset: { x: (_this.hand === RIGHT_HAND) ? 0.03 : -0.03, y: 0.2, z: 0.02 },
            filter: Picks.PICK_ENTITIES,
            faceAvatar: true,
            scaleWithAvatar: true,
            centerEndY: false,
            speed: speed,
            accelerationAxis: accelerationAxis,
            rotateAccelerationWithAvatar: true,
            renderStates: teleportRenderStates,
            defaultRenderStates: teleportDefaultRenderStates,
            maxDistance: 8.0
        });
        this.teleportParabolaHandInvisible = Pointers.createPointer(PickType.Parabola, {
            joint: (_this.hand === RIGHT_HAND) ? "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" : "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND",
            dirOffset: { x: 0, y: 1, z: 0.1 },
            posOffset: { x: (_this.hand === RIGHT_HAND) ? 0.03 : -0.03, y: 0.2, z: 0.02 },
            filter: Picks.PICK_ENTITIES | Picks.PICK_INCLUDE_INVISIBLE,
            faceAvatar: true,
            scaleWithAvatar: true,
            centerEndY: false,
            speed: speed,
            accelerationAxis: accelerationAxis,
            rotateAccelerationWithAvatar: true,
            renderStates: teleportRenderStates,
            maxDistance: 8.0
        });
        this.teleportParabolaHeadVisible = Pointers.createPointer(PickType.Parabola, {
            joint: "Avatar",
            filter: Picks.PICK_ENTITIES,
            faceAvatar: true,
            scaleWithAvatar: true,
            centerEndY: false,
            speed: speed,
            accelerationAxis: accelerationAxis,
            rotateAccelerationWithAvatar: true,
            renderStates: teleportRenderStates,
            defaultRenderStates: teleportDefaultRenderStates,
            maxDistance: 8.0
        });
        this.teleportParabolaHeadInvisible = Pointers.createPointer(PickType.Parabola, {
            joint: "Avatar",
            filter: Picks.PICK_ENTITIES | Picks.PICK_INCLUDE_INVISIBLE,
            faceAvatar: true,
            scaleWithAvatar: true,
            centerEndY: false,
            speed: speed,
            accelerationAxis: accelerationAxis,
            rotateAccelerationWithAvatar: true,
            renderStates: teleportRenderStates,
            maxDistance: 8.0
        });

        this.cleanup = function() {
            Pointers.removePointer(this.teleportParabolaHandVisible);
            Pointers.removePointer(this.teleportParabolaHandInvisible);
            Pointers.removePointer(this.teleportParabolaHeadVisible);
            Pointers.removePointer(this.teleportParabolaHeadInvisible);
            Overlays.deleteOverlay(this.headLaser1);
            Overlays.deleteOverlay(this.headLaser2);
            Overlays.deleteOverlay(this.handLaser1);
            Overlays.deleteOverlay(this.handLaser2);
        };

        this.buttonPress = function(value) {
            _this.buttonValue = value;
        };

        this.parameters = makeDispatcherModuleParameters(
            80,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100);

        this.enterTeleport = function() {
            this.state = TELEPORTER_STATES.TARGETTING;
        };

        this.timer = 0;
        
        // Two lines per head and hand, each a segment, showing progress of wait time for action.
        this.headLine1 = Uuid.NULL;
        this.handLine1 = Uuid.NULL;

        this.headLine2 = Uuid.NULL;
        this.handline2 = Uuid.NULL;

        this.updateHandLine = function (ctrlrPick) {
            if (Uuid.isEqual(this.handLine1, Uuid.NULL)) {
                // We don't have a line yet...
                // This is the segment that originates from the hand controller and ends at the LERP between start and end.
                this.handLine1 = Overlays.addOverlay("line3d",
                    {
                        name: "handLine1",
                        color: EXP3_LINE3D_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        visible: true,
                        position: ctrlrPick.searchRay.position
                    });

                // This is the segment that originates from the LERP between overall line's start and end, and the endpoint.
                this.handLine2 = Overlays.addOverlay("line3d",
                    {
                        name: "handLine2",
                        color: EXP3_LOADING_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        visible: true,
                        position: ctrlrPick.searchRay.position
                    });
            }
            if (ctrlrPick.intersects) {
                var startPos = ctrlrPick.searchRay.origin;
                var endPos = ctrlrPick.intersection;
                var localT = normalizeRange(0, EXP3_STARE_THRESHOLD, this.timer);
                var progressPos = lerp(startPos, endPos, localT);
                // We have an endpoint
                Overlays.editOverlay(this.handLine1, {
                    position: startPos,
                    endPoint: progressPos,
                    color: EXP3_LINE3D_COLOR
                });
                Overlays.editOverlay(this.handLine2, {
                    position: progressPos,
                    endPoint: endPos,
                    color: EXP3_LOADING_COLOR
                });
            } else {
                // No endpoint
                Overlays.editOverlay(this.handLine1, {
                    position: ctrlrPick.searchRay.origin,
                    endPoint: Vec3.sum(ctrlrPick.searchRay.origin, Vec3.multiply(10, ctrlrPick.searchRay.direction)),
                    color: EXP3_LINE3D_NO_INTERSECTION
                });
            }
        };

        this.updateHeadLine = function (headPick) {
            if (Uuid.isEqual(this.headLine1, Uuid.NULL)) {
                // We don't have a line yet...
                // This is the segment that originates from the "head" and ends at the LERP between start and end.
                this.headLine1 = Overlays.addOverlay("line3d",
                    {
                        name: "headLine",
                        color: EXP3_LINE3D_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        visible: true,
                        position: headPick.searchRay.position
                    });

                // This is the segment that originates from the LERP between overall line's start and end, and the endpoint.
                this.headLine2 = Overlays.addOverlay("line3d",
                    {
                        name: "headLine2",
                        color: EXP3_LOADING_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        visible: true,
                        position: headPick.searchRay.position
                    })
            }
            // If we've got an intersection from the head, we know we've got an endpoint.
            if (headPick.intersects) {
                var startPos = headPick.searchRay.origin;
                var endPos = headPick.intersection;
                var localT = normalizeRange(0, EXP3_STARE_THRESHOLD, this.timer);
                var progressPos = lerp(startPos, endPos, localT);
                // We have an endpoint
                Overlays.editOverlay(this.headLine1, {
                    position: startPos,
                    endPoint: progressPos,
                    color: EXP3_LINE3D_COLOR
                });
                Overlays.editOverlay(this.headLine2, {
                    position: progressPos,
                    endPoint: endPos,
                    color: EXP3_LOADING_COLOR
                });
            } else {
                // No endpoint
                Overlays.editOverlay(this.headLine1, {
                    position: headPick.searchRay.origin,
                    endPoint: Vec3.sum(headPick.searchRay.origin, Vec3.multiply(10, headPick.searchRay.direction)),
                    color: EXP3_LINE3D_NO_INTERSECTION
                });
            }
        };


        // Utility function to hide the two segments of the head laser.
        this.setHeadLineVisibility = function (viz) {
            Overlays.editOverlay(this.headLine1, { visible: viz });
            Overlays.editOverlay(this.headLine2, { visible: viz });
        };

        // Utility function to hide the two segments of the hand laser.
        this.setHandLineVisibility = function (viz) {
            Overlays.editOverlay(this.handLine1, { visible: viz });
            Overlays.editOverlay(this.handLine2, { visible: viz });
        };

        // Lazy utility function for disabling both lasers.
        this.setLasersVisibility = function (viz) {
            this.setHandLineVisibility(viz);
            this.setHeadLineVisibility(false);
        }

        this.isReady = function(controllerData, deltaTime) {
            var otherModule = this.getOtherModule();

            // Controller Exp3 activation criteria.
            var headPick = controllerData.rayPicks[AVATAR_HEAD];        // Head raypick.
            var ctrlrPick = controllerData.rayPicks[this.hand];         // Raypick for this hand.
            if (ctrlrPick.intersects && !otherModule.active) {
                // Get the vectors for head and hand controller.
                var ctrlrVec = Vec3.subtract(ctrlrPick.intersection, ctrlrPick.searchRay.origin);
                var headVec = Vec3.subtract(headPick.intersection, headPick.searchRay.origin);

                // headDist is used to determine distance between intersection and
                // the avatar's look vector.
                var headDist = vecInDirWithMagOf(headVec, ctrlrVec);

                var distance = Vec3.length(Vec3.subtract(headDist, ctrlrVec));
                if (distance <= (ctrlrPick.distance * EXP3_DISTANCE_RATIO)) {
                    this.setLasersVisibility(true);
                    this.updateHeadLine(headPick);
                    this.updateHandLine(ctrlrPick);
                    // If the timer is at or exceeds the amount of time we should gaze to activate...
                    if (this.timer >= EXP3_STARE_THRESHOLD) {
                        // Activate the module.
                        this.active = true;                     // Set the module to active.
                        this.enterTeleport();                   // Activate teleport.
                        otherModule.timer = 0.0;                // Reset the other module's timer.
                        this.timer = 0.0;                       // Reset the timer.
                        this.setLasersVisibility(false);        // Hide the lasers. Maybe destroy instead?
                        return makeRunningValues(true, [], []);
                    } else {
                        // Increment the timer.
                        this.timer += deltaTime;
                        return makeRunningValues(false, [], []);
                    }
                }
                this.setLasersVisibility(false);
            }

            /*if (!this.disabled && this.buttonValue !== 0 && !otherModule.active) {
                this.active = true;
                this.enterTeleport();
                return makeRunningValues(true, [], []);
            }
            */
            this.timer = 0;
            return makeRunningValues(false, [], []);
        };

        this.run = function(controllerData, deltaTime) {
            // Get current hand pose information to see if the pose is valid
            var pose = Controller.getPoseValue(handInfo[(_this.hand === RIGHT_HAND) ? 'right' : 'left'].controllerInput);
            var mode = pose.valid ? _this.hand : 'head';
            if (!pose.valid) {
                Pointers.disablePointer(_this.teleportParabolaHandVisible);
                Pointers.disablePointer(_this.teleportParabolaHandInvisible);
                Pointers.enablePointer(_this.teleportParabolaHeadVisible);
                Pointers.enablePointer(_this.teleportParabolaHeadInvisible);
            } else {
                Pointers.enablePointer(_this.teleportParabolaHandVisible);
                Pointers.enablePointer(_this.teleportParabolaHandInvisible);
                Pointers.disablePointer(_this.teleportParabolaHeadVisible);
                Pointers.disablePointer(_this.teleportParabolaHeadInvisible);
            }

            // We do up to 2 picks to find a teleport location.
            // There are 2 types of teleport locations we are interested in:
            //   1. A visible floor. This can be any entity surface that points within some degree of "up"
            //   2. A seat. The seat can be visible or invisible.
            //
            //  * In the first pass we pick against visible and invisible entities so that we can find invisible seats.
            //    We might hit an invisible entity that is not a seat, so we need to do a second pass.
            //  * In the second pass we pick against visible entities only.
            //
            var result;
            if (mode === 'head') {
                result = Pointers.getPrevPickResult(_this.teleportParabolaHeadInvisible);
            } else {
                result = Pointers.getPrevPickResult(_this.teleportParabolaHandInvisible);
            }

            var teleportLocationType = getTeleportTargetType(result);
            if (teleportLocationType === TARGET.INVISIBLE) {
                if (mode === 'head') {
                    result = Pointers.getPrevPickResult(_this.teleportParabolaHeadVisible);
                } else {
                    result = Pointers.getPrevPickResult(_this.teleportParabolaHandVisible);
                }
                teleportLocationType = getTeleportTargetType(result);
            }

            if (teleportLocationType === TARGET.NONE) {
                // Use the cancel default state
                this.setTeleportState(mode, "cancel", "");
            } else if (teleportLocationType === TARGET.INVALID || teleportLocationType === TARGET.INVISIBLE) {
                this.setTeleportState(mode, "", "cancel");
            } else if (teleportLocationType === TARGET.SURFACE) {
                this.setTeleportState(mode, "teleport", "");
            } else if (teleportLocationType === TARGET.SEAT) {
                this.setTeleportState(mode, "", "seat");
            }
            return this.teleport(result, teleportLocationType);
        };

        this.teleport = function(newResult, target) {
            var result = newResult;
            if (_this.buttonValue === 0) {
                return makeRunningValues(true, [], []);
            }

            if (target === TARGET.NONE || target === TARGET.INVALID) {
                // Do nothing
            } else if (target === TARGET.SEAT) {
                Entities.callEntityMethod(result.objectID, 'sit');
            } else if (target === TARGET.SURFACE) {
                var offset = getAvatarFootOffset();
                result.intersection.y += offset;
                MyAvatar.goToLocation(result.intersection, true, HMD.orientation, false);
                HMD.centerUI();
                MyAvatar.centerBody();
            }

            this.disableLasers();
            this.active = false;
            return makeRunningValues(false, [], []);
        };

        this.disableLasers = function() {
            Pointers.disablePointer(_this.teleportParabolaHandVisible);
            Pointers.disablePointer(_this.teleportParabolaHandInvisible);
            Pointers.disablePointer(_this.teleportParabolaHeadVisible);
            Pointers.disablePointer(_this.teleportParabolaHeadInvisible);
        };

        this.setTeleportState = function(mode, visibleState, invisibleState) {
            if (mode === 'head') {
                Pointers.setRenderState(_this.teleportParabolaHeadVisible, visibleState);
                Pointers.setRenderState(_this.teleportParabolaHeadInvisible, invisibleState);
            } else {
                Pointers.setRenderState(_this.teleportParabolaHandVisible, visibleState);
                Pointers.setRenderState(_this.teleportParabolaHandInvisible, invisibleState);
            }
        };

        this.setIgnoreEntities = function(entitiesToIgnore) {
            Pointers.setIgnoreItems(this.teleportParabolaHandVisible, entitiesToIgnore);
            Pointers.setIgnoreItems(this.teleportParabolaHandInvisible, entitiesToIgnore);
            Pointers.setIgnoreItems(this.teleportParabolaHeadVisible, entitiesToIgnore);
            Pointers.setIgnoreItems(this.teleportParabolaHeadInvisible, entitiesToIgnore);
        };
    }

    // related to repositioning the avatar after you teleport
    var FOOT_JOINT_NAMES = ["RightToe_End", "RightToeBase", "RightFoot"];
    var DEFAULT_ROOT_TO_FOOT_OFFSET = 0.5;
    function getAvatarFootOffset() {

        // find a valid foot jointIndex
        var footJointIndex = -1;
        var i, l = FOOT_JOINT_NAMES.length;
        for (i = 0; i < l; i++) {
            footJointIndex = MyAvatar.getJointIndex(FOOT_JOINT_NAMES[i]);
            if (footJointIndex !== -1) {
                break;
            }
        }
        if (footJointIndex !== -1) {
            // default vertical offset from foot to avatar root.
            var footPos = MyAvatar.getAbsoluteDefaultJointTranslationInObjectFrame(footJointIndex);
            if (footPos.x === 0 && footPos.y === 0 && footPos.z === 0.0) {
                // if footPos is exactly zero, it's probably wrong because avatar is currently loading, fall back to default.
                return DEFAULT_ROOT_TO_FOOT_OFFSET * MyAvatar.scale;
            } else {
                return -footPos.y;
            }
        } else {
            return DEFAULT_ROOT_TO_FOOT_OFFSET * MyAvatar.scale;
        }
    }

    var mappingName, teleportMapping;

    function parseJSON(json) {
        try {
            return JSON.parse(json);
        } catch (e) {
            return undefined;
        }
    }
    // When determininig whether you can teleport to a location, the normal of the
    // point that is being intersected with is looked at. If this normal is more
    // than MAX_ANGLE_FROM_UP_TO_TELEPORT degrees from your avatar's up, then
    // you can't teleport there.
    var MAX_ANGLE_FROM_UP_TO_TELEPORT = 70;
    function getTeleportTargetType(result) {
        if (result.type === Picks.INTERSECTED_NONE) {
            return TARGET.NONE;
        }

        var props = Entities.getEntityProperties(result.objectID, ['userData', 'visible']);
        var data = parseJSON(props.userData);
        if (data !== undefined && data.seat !== undefined) {
            var avatarUuid = Uuid.fromString(data.seat.user);
            if (Uuid.isNull(avatarUuid) || !AvatarList.getAvatar(avatarUuid).sessionUUID) {
                return TARGET.SEAT;
            } else {
                return TARGET.INVALID;
            }
        }

        if (!props.visible) {
            return TARGET.INVISIBLE;
        }

        var surfaceNormal = result.surfaceNormal;
        var angle = Math.acos(Vec3.dot(surfaceNormal, Quat.getUp(MyAvatar.orientation))) * (180.0 / Math.PI);

        if (angle > MAX_ANGLE_FROM_UP_TO_TELEPORT) {
            return TARGET.INVALID;
        } else {
            return TARGET.SURFACE;
        }
    }

    function registerMappings() {
        mappingName = 'Hifi-Teleporter-Dev-' + Math.random();
        teleportMapping = Controller.newMapping(mappingName);

        teleportMapping.from(Controller.Standard.RightPrimaryThumb).peek().to(rightTeleporter.buttonPress);
        teleportMapping.from(Controller.Standard.LeftPrimaryThumb).peek().to(leftTeleporter.buttonPress);
    }

    var leftTeleporter = new Teleporter(LEFT_HAND);
    var rightTeleporter = new Teleporter(RIGHT_HAND);

    enableDispatcherModule("LeftTeleporter", leftTeleporter);
    enableDispatcherModule("RightTeleporter", rightTeleporter);
    registerMappings();
    Controller.enableMapping(mappingName);

    function cleanup() {
        teleportMapping.disable();
        leftTeleporter.cleanup();
        rightTeleporter.cleanup();
        disableDispatcherModule("LeftTeleporter");
        disableDispatcherModule("RightTeleporter");
    }
    Script.scriptEnding.connect(cleanup);

    var handleTeleportMessages = function(channel, message, sender) {
        if (sender === MyAvatar.sessionUUID) {
            if (channel === 'Hifi-Teleport-Disabler') {
                if (message === 'both') {
                    leftTeleporter.disabled = true;
                    rightTeleporter.disabled = true;
                }
                if (message === 'left') {
                    leftTeleporter.disabled = true;
                    rightTeleporter.disabled = false;
                }
                if (message === 'right') {
                    leftTeleporter.disabled = false;
                    rightTeleporter.disabled = true;
                }
                if (message === 'none') {
                    leftTeleporter.disabled = false;
                    rightTeleporter.disabled = false;
                }
            } else if (channel === 'Hifi-Teleport-Ignore-Add' &&
                       !Uuid.isNull(message) &&
                       ignoredEntities.indexOf(message) === -1) {
                ignoredEntities.push(message);
                leftTeleporter.setIgnoreEntities(ignoredEntities);
                rightTeleporter.setIgnoreEntities(ignoredEntities);
            } else if (channel === 'Hifi-Teleport-Ignore-Remove' && !Uuid.isNull(message)) {
                var removeIndex = ignoredEntities.indexOf(message);
                if (removeIndex > -1) {
                    ignoredEntities.splice(removeIndex, 1);
                    leftTeleporter.setIgnoreEntities(ignoredEntities);
                    rightTeleporter.setIgnoreEntities(ignoredEntities);
                }
            }
        }
    };

    Messages.subscribe('Hifi-Teleport-Disabler');
    Messages.subscribe('Hifi-Teleport-Ignore-Add');
    Messages.subscribe('Hifi-Teleport-Ignore-Remove');
    Messages.messageReceived.connect(handleTeleportMessages);

}()); // END LOCAL_SCOPE
