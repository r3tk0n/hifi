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


        this.justTeleported = false;

        this.isPointingDown = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle <= 45) ? true : false;
        }

        this.isPointingUp = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle >= 135) ? true : false;
        }

        this.isPointingToSide = function () {
            var angle = getAngleFromLookVector(this.hand);
            var absAngle = Math.abs(angle);

            return (absAngle >= 67.5 && absAngle <= 112.5);
        }

        this.pointingToSide = false;
        this.pointingDown = false;
        this.pointingUp = false;
        this.deltaAngle = 0.0;
        this.startPos = Vec3.ZERO;

        this.isReady = function (controllerData, deltaTime) {
            if (this.justTeleported) {
                if (controllerData.triggerValues[this.hand] > TRIGGER_OFF_VALUE) {
                    return makeRunningValues(false, [], []);
                } else {
                    this.justTeleported = false;
                }
            }

            var otherModule = this.getOtherModule();
            if (!EXP3_USE_DRIVE || otherModule.active) {
                return makeRunningValues(false, [], []);
            }

            var farGrab = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightFarActionGrabEntity" : "LeftFarActionGrabEntity");
            var teleport = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightTeleporter" : "LeftTeleporter");

            // Head stability requirement (rotational velocity)
            //var correctHeadAngularVelocity = (EXP3_USE_HEAD_VELOCITY) ? (controllerData.headAngularVelocity < EXP3_HEAD_MAX_ANGULAR_VELOCITY) : true;

            // Hand stability requirement (linear velocity)
            //var correctControllerLinearVelocity = (EXP3_USE_CTRLR_VELOCITY) ? (Vec3.length(controllerData.handLinearVelocity[this.hand]) <= EXP3_MAX_CTRLR_VELOCITY) : true;

            var gripValue = Controller.getValue((hand == RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON_VALUE;
            var released = gripValue < TRIGGER_OFF_VALUE;
            var pose = Controller.getPoseValue((hand == RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            this.pointingDown = this.isPointingDown();
            this.pointingUp = this.isPointingUp();
            this.pointingToSide = this.isPointingToSide();

            if (squeezed & !this.isGrabbing) {
                var pose = Controller.getPoseValue(hand === RIGHT_HAND ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                this.startPos = pose.translation;
                this.isGrabbing = true;
                this.active = true;
                if (!this.pointingDown && !this.pointingUp && !this.pointingToSide) {
                    Controller.enableMapping(mappingName);
                }
                return makeRunningValues(true, [], []);
            }
            this.delay = 0;
            return makeRunningValues(false, [], []);
        };

        this.timerLimit = 1;
        this.timer = 0;
        this.total_angle = 0;

        this.fromRads = function (v) {
            return { x: toDegrees(v.x), y: toDegrees(v.y), z: toDegrees(v.z) };
        }

        this.run = function (controllerData, deltaTime) {
            var pose = Controller.getPoseValue(hand === RIGHT_HAND ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            var gripValue = Controller.getValue((this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON;
            var released = gripValue < TRIGGER_OFF;

            if (this.isGrabbing && released) {
                this.pointingToSide = false;
                this.pointingDown = false;
                this.pointingUp = false;
                this.startPos = Vec3.ZERO;
                this.deltaAngle = 0.0;
                this.up = Vec3.ZERO;
                this.right = Vec3.ZERO;
                this.normal = Vec3.ZERO;
                this.active = false;
                this.isGrabbing = false;
                this.timer = 0;
                this.timerLimit = 1;
                this.total_angle = 0;
                driverMapping.disable();
                //print("Release!");
                return makeRunningValues(false, [], []);
            }

            // Driving snapturn...
            if (squeezed && (this.pointingToSide || this.pointingDown || this.pointingUp)) {
                var d = getRadialAngleDeltaFromAvatar(this.hand, this.startPos);
                this.deltaAngle += d;

                if (this.deltaAngle > DRIVE_ROT_ANGLE) {
                    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(DRIVE_ROT_ANGLE * ROT_MULTIPLIER, Vec3.UNIT_Y));
                    this.deltaAngle -= DRIVE_ROT_ANGLE;
                } else if (this.deltaAngle < -DRIVE_ROT_ANGLE) {
                    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(-DRIVE_ROT_ANGLE * ROT_MULTIPLIER, Vec3.UNIT_Y));
                    this.deltaAngle += DRIVE_ROT_ANGLE;
                } else {
                    // Nothing.
                }
                this.startPos = pose.translation;
            } else if (squeezed) {
                // Avatar space...
                var pose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                var rollVelocity = toDegrees(pose.angularVelocity.z * deltaTime);
                this.total_angle += rollVelocity;
                //print("total_angle: " + this.total_angle);

                var absAngle = Math.abs(this.total_angle);          // Absolute value of the roll angle.
                if (absAngle < DRIVE_DEADZONE) {
                    return makeRunningValues(true, [], []);
                } else if (absAngle < DRIVE_SLOW && absAngle > DRIVE_DEADZONE) {
                    this.timerLimit = DRIVE_SLOW_UPDATE;
                } else if (absAngle < DRIVE_MEDIUM && absAngle >= DRIVE_SLOW) {
                    this.timerLimit = DRIVE_MID_UPDATE;
                } else if (absAngle > DRIVE_MEDIUM) {
                    this.timerLimit = DRIVE_FAST_UPDATE;
                }

                this.timer += deltaTime;
                if (this.timer >= this.timerLimit) {
                    this.timer = 0;
                    if (this.total_angle > 0) {
                        MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                    } else {
                        MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(-SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                    }
                    
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
            }).to(Controller.Standard.LX);

            driverMapping.from(function () {
                var amountPressed = Controller.getValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT)
                var pose = Controller.getPoseValue((_this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                if (pose.valid) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_Z)).z;
                    return retMe * amountPressed;
                }
                return 0;
            }).to(Controller.Standard.LY);
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