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

        this.noMove = false;
        this.timer = 0;

        this.isReady = function (controllerData, deltaTime) {
            var otherModule = this.getOtherModule();
            if (!EXP3_USE_DRIVE || otherModule.active) {
                return makeRunningValues(false, [], []);
            }

            var farGrab = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightFarActionGrabEntity" : "LeftFarActionGrabEntity");
            var teleport = getEnabledModuleByName((this.hand === RIGHT_HAND) ? "RightTeleporter" : "LeftTeleporter");

            // Don't move if we've just fargrabbed or teleported. Gives user time to release trigger.
            if (teleport.active || farGrab.active) {
                this.timer = 0;
                if (teleport.active || farGrab.goodToStart) { this.noMove = true; }
                return makeRunningValues(false, [], []);
            }

            if (this.noMove) {
                this.timer += deltaTime;
                if (this.timer > EXP3_NO_DRIVE_TIMER) {
                    this.timer = 0;
                    this.noMove = false;
                }
                return makeRunningValues(false, [], []);
            }

            // Head stability requirement (rotational velocity)
            var correctHeadAngularVelocity = (EXP3_USE_HEAD_VELOCITY) ? (controllerData.headAngularVelocity < EXP3_HEAD_MAX_ANGULAR_VELOCITY) : true;

            // Hand stability requirement (linear velocity)
            var correctControllerLinearVelocity = (EXP3_USE_CTRLR_VELOCITY) ? (Vec3.length(controllerData.handLinearVelocity[this.hand]) <= EXP3_MAX_CTRLR_VELOCITY) : true;



            var gripValue = Controller.getValue((hand == RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON;
            var released = gripValue < TRIGGER_OFF;
            var pose = Controller.getPoseValue((hand == RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);

            if (squeezed & !this.isGrabbing && correctControllerLinearVelocity && correctHeadAngularVelocity) {
                // TEST AREA
                this.init = pose.rotation;
                this.up = Vec3.normalize(Vec3.multiplyQbyV(this.init, (this.hand === RIGHT_HAND) ? Vec3.UNIT_X : {x:-1, y:0, z:0}));            // Up in avatar space
                this.right = Vec3.normalize(Vec3.multiplyQbyV(this.init, (this.hand === RIGHT_HAND)?{x: 0, y: 0, z: -1}:Vec3.UNIT_Z));         // Negative Z for right hand, z for left.
                //this.up = Vec3.UNIT_Y;
                //this.right = Vec3.UNIT_X;
                this.norm = { x: 0, y: 0, z: -1 };        // normal to XY plane
                // END TEST AREA


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

        this.up = Vec3.ZERO;
        this.right = Vec3.ZERO;
        this.init = Quat.ZERO;

        this.handLine1 = Uuid.NULL;
        this.handLine2 = Uuid.NULL;
        this.handLine3 = Uuid.NULL;

        this.updateHandLine = function (pose) {
            var startPos = Vec3.sum(Vec3.multiplyQbyV(MyAvatar.orientation, pose.translation), MyAvatar.position);
            if (Uuid.isEqual(this.handLine1, Uuid.NULL)) {
                // We don't have a line yet...
                // This is the segment that originates from the hand controller and ends at the LERP between start and end.
                this.handLine1 = Overlays.addOverlay("line3d",
                    {
                        name: "handLine1",
                        color: EXP3_FARGRAB_LOADED_COLOR,
                        alpha: 1.0,
                        isSolid: true,
                        position: startPos,
                        endPoint: Vec3.sum(Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y), startPos),
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
                    position: startPos,
                    endPoint: Vec3.sum(Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Z), startPos),
                    glow: 1,
                    lineWidth: 0.06,
                    visible: false
                });
        }
        if (Uuid.isEqual(this.handLine3, Uuid.NULL)) {
            // This is the segment that originates from the LERP between overall line's start and end, and the endpoint
            this.handLine3 = Overlays.addOverlay("line3d",
                {
                    name: "handLine3",
                    color: { red: 255, blue: 0, green: 0 },
                    alpha: 1.0,
                    isSolid: true,
                    position: startPos,
                    endPoint: Vec3.sum(Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_X), startPos),
                    glow: 1,
                    lineWidth: 0.06,
                    visible: false
                });
        }

        //var startPos = ctrlrPick.searchRay.origin;
        //var endPos = ctrlrPick.intersection;
        //var progressPos = (triggerVal > 0) ? lerp(startPos, endPos, triggerVal) : startPos;
        //var tmp = Vec3.subtract(ctrlrPick.intersection, ctrlrPick.searchRay.origin);
        //var dir = ctrlrPick.searchRay.direction;
        //var angle = toDegrees(Vec3.getAngle(dir, tmp));
        Overlays.editOverlay(this.handLine1, {
            position: startPos,
            endParentID: null,
            endPoint: Vec3.sum(Vec3.multiplyQbyV(Quat.multiply(MyAvatar.orientation, pose.rotation), Vec3.UNIT_Y), startPos),
            color: YELLOW,                      // Color that slowly fills line.
            lineWidth: 0.08,
            visible: true
        });
        Overlays.editOverlay(this.handLine2, {
            position: startPos,
            endPoint: Vec3.sum(Vec3.multiplyQbyV(Quat.multiply(MyAvatar.orientation, pose.rotation), Vec3.UNIT_Z), startPos),
            color: BRIGHT_TEAL,                 // Color the recedes in line.
            visible: true
        });
        Overlays.editOverlay(this.handLine3, {
            position: startPos,
            endPoint: Vec3.sum(Vec3.multiplyQbyV(Quat.multiply(MyAvatar.orientation, pose.rotation), Vec3.UNIT_X), startPos),
            color: { red: 255, blue: 0, green: 0 },                 // Color the recedes in line.
            visible: true
        });
    };

        this.getAngle = function (v1, v2) {
            var angle = toDegrees(Math.acos(Vec3.dot(Vec3.normalize(v1), Vec3.normalize(v2))));
            var cross = Vec3.cross(v1, v2);
            if (Vec3.dot(cross, Vec3.UNIT_Y) < 0) {
                angle = -angle;
            }
            return angle;
        }

        this.timerLimit = 1;
        this.timer = 0;

        this.run = function (controllerData, deltaTime) {
            var gripValue = Controller.getValue((this.hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            var squeezed = gripValue > TRIGGER_ON;
            var released = gripValue < TRIGGER_OFF;

            if (this.isGrabbing && released) {
                this.up = Vec3.ZERO;
                this.right = Vec3.ZERO;
                this.normal = Vec3.ZERO;
                this.active = false;
                this.isGrabbing = false;
                this.timer = 0;
                this.timerLimit = 1;
                driverMapping.disable();
                //print("Release!");
                return makeRunningValues(false, [], []);
            }
            if (squeezed) {
                // Avatar space...
                var pose = Controller.getPoseValue((this.hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
                //this.updateHandLine(pose);

                //controllerTwistAngle2();

                //var temp = Quat.rotationBetween(pose.rotation, this.init);
                //var newUp = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_X);              // Up in avatar space...
                var newUp = Vec3.normalize(Vec3.multiplyQbyV(pose.rotation, (this.hand === RIGHT_HAND) ? Vec3.UNIT_X : { x: -1, y: 0, z: 0 }));            // Up in avatar space
                var newRight = Vec3.normalize(Vec3.multiplyQbyV(pose.rotation, (this.hand === RIGHT_HAND) ? { x: 0, y: 0, z: -1 } : Vec3.UNIT_Z));         // Negative Z for right hand, z for left.

                var projectionOfUp = projectVontoW(newUp, this.normal);
                var projectionOfRight = projectVontoW(newRight, this.normal);

                var upOnPlane = Vec3.subtract(newUp, projectionOfUp);
                var rightOnPlane = Vec3.subtract(newRight, projectionOfRight);

                var angle = toDegrees(Vec3.getAngle(Vec3.normalize(upOnPlane), this.up));
                var angle2 = toDegrees(Vec3.getAngle(Vec3.normalize(rightOnPlane), this.up));
                if (angle2 > 90) { angle *= -1 };
                
                //print("Angle Up: " + angle);
                var absAngle = Math.abs(angle);
                if (absAngle < 10) {
                    return makeRunningValues(true, [], []);
                } else if (absAngle < 30 && absAngle > 0) {
                    this.timerLimit = 1;
                } else if (absAngle < 60 && absAngle >= 30) {
                    this.timerLimit = 0.5;
                } else if (absAngle > 60) {
                    this.timerLimit = 0.25;
                }

                this.timer += deltaTime;
                if (this.timer >= this.timerLimit) {
                    this.timer = 0;
                    if (angle > 0) {
                        MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                    } else {
                        MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(-SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                    }
                    
                }

                //print("Angle Right: " + angle2);

                //// TEST AREA
                //var temp = Quat.multiply(cancelPitchAndYaw(pose.rotation), Quat.inverse(this.init));

                //var newWristRotation = Vec3.orientedAngle(Quat.getFront(pose.rotation), Vec3.UNIT_Y, Vec3.UNIT_Y) - this.startWristRotation;
                //newWristRotation *= ((this.hand === LEFT_HAND) ? 1 : -1);
                //this.wristRotation = newWristRotation;

                //if (this.wristRotation - this.lastSnapTurnAngle > SNAP_TURN_WRIST_ANGLE) {
                //    this.lastSnapTurnAngle = this.wristRotation;
                //    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                //}
                //if (this.lastSnapTurnAngle - this.wristRotation > SNAP_TURN_WRIST_ANGLE) {
                //    this.lastSnapTurnAngle = this.wristRotation;
                //    MyAvatar.orientation = Quat.multiply(MyAvatar.orientation, Quat.angleAxis(-SNAP_TURN_ANGLE, Vec3.UNIT_Y));
                //}
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