"use strict";

//  Created by Jason Najera on 7/24/2018
//  Copyright 2018 High Fidelity, Inc
//
//
//
//
//  Distributed under teh Apache License, Version 2.0
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

Script.include("/~/system/libraries/Xform.js");
Script.include("/~/system/libraries/controllerDispatcherUtils.js");
Script.include("/~/system/libraries/controllers.js");

(function () {// BEGIN LOCAL_SCOPE

    this.isGrabbing = false;
    this.canTurn = true;
    this.previousSensorPosition;
    this.startWristRotation;
    this.wristRotation;
    this.lastSnapTurnAngle;
    this.delay = 0.0;

    function Driver(hand) {
        //print("Loaded Driver...");
        var _this = this;
        this.hand = hand;
        this.active = false;

        var mappingName, driverMapping;

        this.getOtherModule = function() {
            return (this.hand === RIGHT_HAND) ? leftDriver : rightDriver;
        }

        this.noMoveAfterTeleport = false;
        this.timer = 0;

        this.isReady = function (controllerData, deltaTime) {
            var otherModule = this.getOtherModule();
            if (!EXP3_USE_DRIVE || otherModule.active) {
                return makeRunningValues(false, [], []);
            }

            // Head stability requirement (rotational velocity)
            var correctHeadAngularVelocity = (EXP3_USE_HEAD_VELOCITY) ? (controllerData.headAngularVelocity < EXP3_HEAD_MAX_ANGULAR_VELOCITY) : true;

            // Hand stability requirement (linear velocity)
            var correctControllerLinearVelocity = (EXP3_USE_CTRLR_VELOCITY) ? (Vec3.length(controllerData.handLinearVelocity[this.hand]) <= EXP3_MAX_CTRLR_VELOCITY) : true;

            var farGrab = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightFarActionGrabEntity" : "LeftFarActionGrabEntity");
            var teleport = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightTeleporter" : "LeftTeleporter");

            if (teleport.goodToStart || farGrab.goodToStart || teleport.active || farGrab.active) {
                if (teleport.active || teleport.goodToStart) { this.noMoveAfterTeleport = true; }
                return makeRunningValues(false, [], []);
            }

            if (this.noMoveAfterTeleport) {
                this.timer += deltaTime;
                if (this.timer > EXP3_NO_DRIVE_TIMER) {
                    this.timer = 0;
                    this.noMoveAfterTeleport = false;
                }
                return makeRunningValues(false, [], []);
            }

            var gripValue = Controller.getValue((hand == RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON;
            var released = gripValue < TRIGGER_OFF;
            var pose = Controller.getPoseValue((hand == RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);

            if (squeezed & !this.isGrabbing && correctControllerLinearVelocity && correctHeadAngularVelocity) {
                //this.delay += deltaTime;
                //if (this.delay <= EXP3_START_DRIVING_TIMEOUT) {
                //    return makeRunningValues(false, [], []);
                //}
                //this.delay = 0;
                this.isGrabbing = true;
                this.smoothedRotation = Quat.angleAxis(0, Quat.getUp(MyAvatar.orientation));
                this.startWristRotation = Vec3.orientedAngle(Quat.getFront(pose.rotation), Vec3.UNIT_Y, Vec3.UNIT_Y);
                this.wristRotation = 0;
                this.lastSnapTurnAngle = 0;
                this.active = true;
                Controller.enableMapping(mappingName);
                return makeRunningValues(true, [], []);
            }
            this.delay = 0;
            return makeRunningValues(false, [], []);
        };

        this.run = function (controllerData, deltaTime) {
            var gripValue = Controller.getValue((this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON;
            var released = gripValue < TRIGGER_OFF;

            if (this.isGrabbing && released) {
                this.active = false;
                this.isGrabbing = false;
                driverMapping.disable();
                //print("Release!");
                return makeRunningValues(false, [], []);
            }
            if (squeezed) {
                var pose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);

                var newWristRotation = Vec3.orientedAngle(Quat.getFront(pose.rotation), Vec3.UNIT_Y, Vec3.UNIT_Y) - this.startWristRotation;
                newWristRotation *= ((this.hand === LEFT_HAND) ? 1 : -1);
                this.wristRotation = newWristRotation;

                if (this.wristRotation - this.lastSnapTurnAngle > SNAP_TURN_WRIST_ANGLE) {
                    this.lastSnapTurnAngle = this.wristRotation;
                    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                }
                if (this.lastSnapTurnAngle - this.wristRotation > SNAP_TURN_WRIST_ANGLE) {
                    this.lastSnapTurnAngle = this.wristRotation;
                    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(-SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                }
            }

            return makeRunningValues(true, [], []);
        };

        this.registerMappings = function () {

            mappingName = 'Hifi-Driver-Dev-' + Math.random();
            driverMapping = Controller.newMapping(mappingName);

            driverMapping.from(function () {
                var amountPressed = Controller.getValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
                var pose = Controller.getPoseValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                if (pose.valid) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_X)).x;
                    return retMe * amountPressed;
                }
                return 0;
            }).
                to(Controller.Standard.LX);

            driverMapping.from(function () {
                var amountPressed = Controller.getValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT)
                var pose = Controller.getPoseValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                if (pose.valid) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_Z)).z;
                    return retMe * amountPressed;
                }
                return 0;
            }).
                to(Controller.Standard.LY);
        };

        this.cleanup = function () {
            // Clean up vars and stuff.
        };

        this.parameters = makeDispatcherModuleParameters(
            600,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100
        );
    } // END Driver(hand)

    var leftDriver = new Driver(LEFT_HAND);
    var rightDriver = new Driver(RIGHT_HAND);
    leftDriver.registerMappings();
    rightDriver.registerMappings();

    enableDispatcherModule("LeftDriver", leftDriver);
    enableDispatcherModule("RightDriver", rightDriver);

    function cleanup() {
        driverMapping.disable();
        leftDriver.cleanup();
        rightDriver.cleanup();
        disableDispatcherModule("LeftDriver");
        disableDispatcherModule("RightDriver");
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE