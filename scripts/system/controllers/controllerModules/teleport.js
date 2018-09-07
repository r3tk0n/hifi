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
        width: 0.0125
    };
    var teleportPath = {
        color: COLORS_TELEPORT_CAN_TELEPORT,
        alpha: 1,
        width: 0.0125
    };
    var seatPath = {
        color: COLORS_TELEPORT_SEAT,
        alpha: 1,
        width: 0.0125
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

    var speed = 9.3;
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
            //joint: (_this.hand === RIGHT_HAND) ? "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" : "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND",
            joint: (this.hand === RIGHT_HAND) ? "RightHand" : "LeftHand",
            dirOffset: { x: 0, y: 1, z: 0.1 },
            //posOffset: { x: (_this.hand === RIGHT_HAND) ? 0.03 : -0.03, y: 0.2, z: 0.02 },
            posOffset: getFingertipOffset(_this.hand),
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
            //joint: (_this.hand === RIGHT_HAND) ? "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" : "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND",
            joint: (this.hand === RIGHT_HAND) ? "RightHand" : "LeftHand",
            dirOffset: { x: 0, y: 1, z: 0.1 },
            //posOffset: { x: (_this.hand === RIGHT_HAND) ? 0.03 : -0.03, y: 0.2, z: 0.02 },
            posOffset: getFingertipOffset(_this.hand),
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
        };

        this.axisButtonStateX = 0; // Left/right axis button pressed.
        this.axisButtonStateY = 0; // Up/down axis button pressed.
        this.BUTTON_TRANSITION_DELAY = 100; // Allow time for transition from direction buttons to touch-pad.

        this.axisButtonChangeX = function (value) {
            if (value !== 0) {
                _this.axisButtonStateX = value;
            } else {
                // Delay direction button release until after teleport possibly pressed.
                Script.setTimeout(function () {
                    _this.axisButtonStateX = value;
                }, _this.BUTTON_TRANSITION_DELAY);
            }
        };

        this.axisButtonChangeY = function (value) {
            if (value !== 0) {
                _this.axisButtonStateY = value;
            } else {
                // Delay direction button release until after teleport possibly pressed.
                Script.setTimeout(function () {
                    _this.axisButtonStateY = value;
                }, _this.BUTTON_TRANSITION_DELAY);
            }
        };

        this.teleportLocked = function () {
            // Lock teleport if in advanced movement mode and have just transitioned from pressing a direction button.
            return Controller.getValue(Controller.Hardware.Application.AdvancedMovement)
                && (_this.axisButtonStateX !== 0 || _this.axisButtonStateY !== 0);
        };

        this.buttonPress = function (value) {
            if (value === 0 || !_this.teleportLocked()) {
                _this.buttonValue = value;
            }
        };

        this.parameters = makeDispatcherModuleParameters(
            80,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100);

        this.enterTeleport = function() {
            this.state = TELEPORTER_STATES.TARGETTING;
        };

        this.lastRotation = Quat.IDENTITY;
        this.headAngularVelocity = 0;
        this.lastHMDOrientation = Quat.IDENTITY;

        this.outsideDeactivationBounds = function () {
            // Angle for tests as per Phillip's numbers:
            var handPose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            var handRotation = Quat.multiply(MyAvatar.orientation, (this.hand == LEFT_HAND) ? MyAvatar.leftHandPose.rotation : MyAvatar.rightHandPose.rotation);
            var angleBetween = toDegrees(Quat.angle(Quat.cancelOutRollAndPitch((Quat.rotationBetween(Quat.getFront(Camera.orientation), Quat.getUp(handRotation))))));
            return (angleBetween >= EXP3_TELEPORT_BEAM_OFF_ANGLE);
        }

        this.insideActivationBounds = function () {
            var handPose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            var handRotation = Quat.multiply(MyAvatar.orientation, (this.hand == LEFT_HAND) ? MyAvatar.leftHandPose.rotation : MyAvatar.rightHandPose.rotation);
            var angleBetween = toDegrees(Quat.angle(Quat.cancelOutRollAndPitch((Quat.rotationBetween(Quat.getFront(Camera.orientation), Quat.getUp(handRotation))))));
            return (angleBetween <= EXP3_TELEPORT_BEAM_ON_ANGLE);
        }

        this.otherTeleportActive = function () {
            var otherModule = this.getOtherModule();
            return otherModule.active;
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

        this.correctRotation = function (controllerData) {
            var rot = controllerData.controllerRotAngles[this.hand];
            var correctRotation = (rot > CONTROLLER_EXP3_TELEPORT_MIN_ANGLE && rot <= CONTROLLER_EXP3_TELEPORT_MAX_ANGLE);
        }

        this.getDrive = function () {
            return getEnabledModuleByName(this.hand === RIGHT_HAND ? "RightDriver" : "LeftDriver");
        }

        this.sameHandFarGrabModule = undefined;

        this.isReady = function (controllerData, deltaTime) {
            if (!HMD.active) {
                return makeRunningValues(false, [], []);
            }

            if (this.active) {
                print((this.hand === RIGHT_HAND ? "RightHand" : "LeftHand") + " switched to teleport...");
                return makeRunningValues(true, [], []);
            }

            this.sameHandFarGrabModule = getEnabledModuleByName(this.hand === RIGHT_HAND ? "RightFarActionGrabEntity" : "LeftFarActionGrabEntity");
            var thisHandDriver = this.getDrive();

            var otherModule = this.getOtherModule();
            // Controller Exp3 activation criteria.
            var handRotation = controllerData.controllerRotAngles[this.hand];
            var pointing = this.isPointing();

            // Angle between look and raypick vector must be acceptable for activation.
            var outOfBounds = this.outsideDeactivationBounds();
            var inBounds = this.insideActivationBounds();

            // Use correct wrist rotation.
            var rot = controllerData.controllerRotAngles[this.hand];
            var correctRotation = (rot > CONTROLLER_EXP3_TELEPORT_MIN_ANGLE && rot <= CONTROLLER_EXP3_TELEPORT_MAX_ANGLE);

            // Head stability requirement (rotational velocity)
            var correctHeadAngularVelocity = this.headSteady(controllerData);

            // Hand stability requirement (linear velocity)
            var correctControllerLinearVelocity = this.handSteady(controllerData);

            // this.active will only be true if it's been set by another module for context switching...
            if (!correctRotation || !pointing || !correctHeadAngularVelocity || !correctControllerLinearVelocity || !inBounds && this.active) {
                return makeRunningValues(false, [], []);
            }

            this.active = true;
            return makeRunningValues(true, [], []);
        };

        this.run = function (controllerData, deltaTime) {
            var thisHandDriver = this.getDrive();
            // Do we need to switch to fargrab?
            var handRotation = controllerData.controllerRotAngles[this.hand];
            var contextSwitch = (handRotation > CONTROLLER_EXP3_FARGRAB_MIN_ANGLE && handRotation <= CONTROLLER_EXP3_FARGRAB_MAX_ANGLE);
            if (contextSwitch && this.sameHandFarGrabModule) {
                // Context switching...
                print((this.hand === RIGHT_HAND ? "RightHand" : "LeftHand") + " context switch from teleport.");
                this.sameHandFarGrabModule.active = true;
            }
            if (this.outsideDeactivationBounds() || contextSwitch) {
                // If the angle between the look vector and pointing vector is too great, turn off.
                this.disableLasers();
                this.active = false;
                return makeRunningValues(false, [], []);
            }

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
            return this.teleport(result, teleportLocationType, controllerData);
        };

        this.teleport = function (newResult, target, controllerData) {
            var thisHandDriver = this.getDrive();
            var result = newResult;
            if (controllerData.triggerValues[this.hand] < TRIGGER_OFF_VALUE) {
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

            thisHandDriver.justTeleported = true;
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
    var isViveMapped = false;

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

    function registerViveTeleportMapping() {
        // Disable Vive teleport if touch is transitioning across touch-pad after pressing a direction button.
        if (Controller.Hardware.Vive) {
            var mappingName = 'Hifi-Teleporter-Dev-Vive-' + Math.random();
            var viveTeleportMapping = Controller.newMapping(mappingName);
            viveTeleportMapping.from(Controller.Hardware.Vive.LSX).peek().to(leftTeleporter.axisButtonChangeX);
            viveTeleportMapping.from(Controller.Hardware.Vive.LSY).peek().to(leftTeleporter.axisButtonChangeY);
            viveTeleportMapping.from(Controller.Hardware.Vive.RSX).peek().to(rightTeleporter.axisButtonChangeX);
            viveTeleportMapping.from(Controller.Hardware.Vive.RSY).peek().to(rightTeleporter.axisButtonChangeY);
            Controller.enableMapping(mappingName);
            isViveMapped = true;
        }
    }

    function onHardwareChanged() {
        // Controller.Hardware.Vive is not immediately available at Interface start-up.
        if (!isViveMapped && Controller.Hardware.Vive) {
            registerViveTeleportMapping();
        }
    }

    Controller.hardwareChanged.connect(onHardwareChanged);

    function registerMappings() {
        mappingName = 'Hifi-Teleporter-Dev-' + Math.random();
        teleportMapping = Controller.newMapping(mappingName);

        // Vive teleport button lock-out.
        registerViveTeleportMapping();

        // Teleport actions.
        teleportMapping.from(Controller.Standard.LeftPrimaryThumb).peek().to(leftTeleporter.buttonPress);
        teleportMapping.from(Controller.Standard.RightPrimaryThumb).peek().to(rightTeleporter.buttonPress);
    }

    var leftTeleporter = new Teleporter(LEFT_HAND);
    var rightTeleporter = new Teleporter(RIGHT_HAND);

    enableDispatcherModule("LeftTeleporter", leftTeleporter);
    enableDispatcherModule("RightTeleporter", rightTeleporter);
    registerMappings();
    Controller.enableMapping(mappingName);

    function cleanup() {
        Controller.hardwareChanged.disconnect(onHardwareChanged);
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
