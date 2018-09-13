"use strict";

//  Created by Jason Najera on 7/24/2018
//  Copyright 2018 High Fidelity, Inc
//
//
//
//
//  Distributed under the Apache License, Version 2.0
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

Script.include("/~/system/libraries/Xform.js");
Script.include("/~/system/libraries/controllerDispatcherUtils.js");
Script.include("/~/system/libraries/controllers.js");

(function () {// BEGIN LOCAL_SCOPE
    function TutorialOverlay(hand) {
        var _this = this;
        this.hand = hand;

        print("Tutorial overlay " + ((this.hand === RIGHT_HAND) ? "RightHand" : "LeftHand") + "Loaded");

        this.isPointingUp = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle >= 135) ? true : false;
        }

        this.isPointingDown = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle <= 45) ? true : false;
        }

        this.getLocalRot = function (wristAngle) {
            var temp = Quat.angleAxis(90, Vec3.UNIT_X);
            if (this.hand === LEFT_HAND) {
                temp = Quat.multiply(Quat.angleAxis(-90, Vec3.UNIT_Y), temp);
            } else {
                temp = Quat.multiply(temp, Quat.angleAxis(180, Vec3.UNIT_X));
                temp = Quat.multiply(Quat.angleAxis(-90, Vec3.UNIT_Y), temp);
            }
            var forward = Vec3.multiplyQbyV(temp, { x: 0, y: 0, z: -1 });
            return Quat.multiply(Quat.angleAxis(wristAngle, forward), temp);
        }

        this.getDriveLocalRot = function (wristAngle, startPos) {
            var temp = Quat.angleAxis(90, Vec3.UNIT_X);
            if (this.hand === LEFT_HAND) {
                temp = Quat.multiply(Quat.angleAxis(-180, Vec3.UNIT_Y), temp);
            } else {
                temp = Quat.multiply(temp, Quat.angleAxis(180, Vec3.UNIT_X));
            }
            var forward = Vec3.multiplyQbyV(temp, { x: 0, y: 0, z: -1 });
            return Quat.multiply(Quat.angleAxis(wristAngle - startPos, forward), temp);
        }

        this.teleportCircleUuid = Uuid.NULL;
        this.farGrabCircleUuid = Uuid.NULL;
        this.wristGemRotIndicator = Uuid.NULL;

        this.driveDeadzone = Uuid.NULL;
        this.driveSlowNeg = Uuid.NULL;
        this.driveSlowPos = Uuid.NULL;
        this.driveMedNeg = Uuid.NULL;
        this.driveMedPos = Uuid.NULL;
        this.driveFastNeg = Uuid.NULL;
        this.driveFastPos = Uuid.NULL;
        this.driveGemRotationIndicator = Uuid.NULL;

        this.driveModule = null;

        this.isReady = function (controllerData, deltaTime) {
            if (!MyAvatar.getTutorialPref() || !HMD.active) {
                makeRunningValues(false, [], []);
            }

            if (!this.driveModule) {
                this.driveModule = this.getDriveModule();
                return makeRunningValues(false, [], []);
            }

            if (MyAvatar.getTutorialPref()) {
                print("starting...");
                this.showWristGem(controllerData.controllerRotAngles[this.hand]);
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.wristGemShowing = function () {
            var teleport = !Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid);
            var fargrab = !Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid);
            var rotIndicator = !Uuid.isEqual(Uuid.NULL, this.wristGemRotIndicator);
            return (teleport && fargrab && rotIndicator);
        }

        this.driveGemShowing = function () {
            var deadzone = !Uuid.isEqual(Uuid.NULL, this.driveDeadzone);
            var slowneg = !Uuid.isEqual(Uuid.NULL, this.driveSlowNeg);
            var slowpos = !Uuid.isEqual(Uuid.NULL, this.driveSlowPos);
            var medneg = !Uuid.isEqual(Uuid.NULL, this.driveMedNeg);
            var medpos = !Uuid.isEqual(Uuid.NULL, this.driveMedPos);
            var fastneg = !Uuid.isEqual(Uuid.NULL, this.driveFastNeg);
            var fastpos = !Uuid.isEqual(Uuid.NULL, this.driveFastPos);
            var rotIndicator = !Uuid.isEqual(Uuid.NULL, this.driveGemRotationIndicator);
            return (deadzone && slowneg && slowpos && medneg && medpos && fastneg && fastpos && rotIndicator);
        }

        this.driveRunning = function () {
            if (this.driveModule) {
                return this.driveModule.active;
            }
            return false;
        }

        this.run = function (controllerData, deltaTime) {
            if (!MyAvatar.getTutorialPref()) {
                this.hideDriveGem();
                this.hideWristGem();
                return makeRunningValues(false, [], []);
            }

            if (this.driveRunning()) {
                var startAngle = this.driveModule.startAngle;
                if (this.driveGemShowing()) {
                    //print("drive gem showing");
                    this.updateDriveGem(controllerData.controllerRotAngles[this.hand], startAngle);
                } else {
                    this.hideWristGem();
                    this.showDriveGem(controllerData.controllerRotAngles[this.hand], startAngle);
                }
            } else {
                // Just show the normal wrist gem...
                if (this.wristGemShowing()) {
                    //print("wrist gem showing");
                    this.updateWristGem(controllerData.controllerRotAngles[this.hand]);
                } else {
                    this.hideDriveGem();
                    this.showWristGem(controllerData.controllerRotAngles[this.hand]);
                }
            }

            //this.updateWristGem(controllerData.controllerRotAngles[this.hand]);

            return makeRunningValues(true, [], []);
        };

        this.hideWristGem = function () {
            if (!Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid)) {
                Overlays.deleteOverlay(this.teleportCircleUuid);
                this.teleportCircleUuid = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid)) {
                Overlays.deleteOverlay(this.farGrabCircleUuid);
                this.farGrabCircleUuid = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.wristGemRotIndicator)) {
                Overlays.deleteOverlay(this.wristGemRotIndicator);
                this.wristGemRotIndicator = Uuid.NULL;
            }
        }

        this.hideDriveGem = function () {
            if (!Uuid.isEqual(Uuid.NULL, this.driveDeadzone)) {
                Overlays.deleteOverlay(this.driveDeadzone);
                this.driveDeadzone = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveSlowNeg)) {
                Overlays.deleteOverlay(this.driveSlowNeg);
                this.driveSlowNeg = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveSlowPos)) {
                Overlays.deleteOverlay(this.driveSlowPos);
                this.driveSlowPos = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveMedNeg)) {
                Overlays.deleteOverlay(this.driveMedNeg);
                this.driveMedNeg = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveMedPos)) {
                Overlays.deleteOverlay(this.driveMedPos);
                this.driveMedPos = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveFastNeg)) {
                Overlays.deleteOverlay(this.driveFastNeg);
                this.driveFastNeg = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveFastPos)) {
                Overlays.deleteOverlay(this.driveFastPos);
                this.driveFastPos = Uuid.NULL;
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveGemRotationIndicator)) {
                Overlays.deleteOverlay(this.driveGemRotationIndicator);
                this.driveGemRotationIndicator = Uuid.NULL;
            }
        }

        this.updateWristGem = function (wristRotation) {
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var translation = MyAvatar.getJointPosition(handIndex);
            var localRot = this.getLocalRot(wristRotation);
            var inTeleportAngle = (wristRotation >= CONTROLLER_EXP3_TELEPORT_MIN_ANGLE && wristRotation < CONTROLLER_EXP3_TELEPORT_MAX_ANGLE);
            var inFarGrabAngle = (wristRotation >= CONTROLLER_EXP3_FARGRAB_MIN_ANGLE && wristRotation < CONTROLLER_EXP3_FARGRAB_MAX_ANGLE);
            var scale = MyAvatar.getAvatarScale();
            var minRadius = 0.035 * scale;
            if (!Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid)) {
                // Overlay already exists, just update its properties.
                var circleColor = (inTeleportAngle ? { red: 52, green: 113, blue: 105 } : { red: 104, green: 227, blue: 211 });
                var props = {
                    position: translation,
                    localRotation: localRot,
                    alpha: (inTeleportAngle ? 1.0 : 0.4),
                    color: circleColor
                }
                var attempt = Overlays.editOverlay(this.teleportCircleUuid, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for teleport semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid)) {
                // Overlay already exists, just update its properties.
                var circleColor = (inFarGrabAngle ? { red: 0, green: 90, blue: 120 } : { red: 0, green: 180, blue: 239 });
                var props = {
                    position: translation,
                    localRotation: localRot,
                    alpha: (inFarGrabAngle ? 1.0 : 0.4),
                    color: circleColor
                }
                var attempt = Overlays.editOverlay(this.farGrabCircleUuid, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for fargrab semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.wristGemRotIndicator)) {
                var triangleDim = 0.02;
                var triangleOffset = minRadius - (triangleDim / 2);
                if (this.hand === LEFT_HAND) { triangleOffset *= -1; }
                var localRot = (this.hand === LEFT_HAND) ? Quat.multiply(pose.rotation, Quat.angleAxis(180, Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y))) : pose.rotation;
                var props = {
                    position: translation,
                    localPosition: { x: triangleOffset, y: 0.0, z: 0 },
                    //localRotation: localRot,
                    localRotation: localRot,
                    alpha: 0.7
                }
                var attempt = Overlays.editOverlay(this.wristGemRotIndicator, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for wristgem rotation triangle.");
                }
            }
        }

        this.showWristGem = function (wristRotation) {
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var localRot = this.getLocalRot(wristRotation);
            var translation = MyAvatar.getJointPosition(handIndex);
            var scale = MyAvatar.getAvatarScale();

            var minRadius = 0.035 * scale;
            var maxRadius = 0.04 * scale;

            var teleportMinAngle = -45;
            var teleportMaxAngle = 45

            var farGrabMinAngle = 45;
            var farGrabMaxAngle = 135;

            // Teleport Gem
            if (Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid)) {
                //print("Spawning teleport circle...");
                var circleColor = { red: 104, green: 227, blue: 211 };
                var teleportCircleProps = {
                    visible: true,
                    name: "teleportCircle",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: teleportMinAngle,
                    endAt: teleportMaxAngle,
                    isSolid: true,
                    color: circleColor,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                };
                this.teleportCircleUuid = Overlays.addOverlay("circle3d", teleportCircleProps);
            }

            // FarGrab Gem
            if (Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid)) {
                //print("Spawning far grab circle...");
                var circleColor = { red: 0, green: 180, blue: 239 };
                var teleportCircleProps = {
                    visible: true,
                    name: "farGrabCircle",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: farGrabMinAngle,
                    endAt: farGrabMaxAngle,
                    isSolid: true,
                    color: circleColor,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                };
                this.farGrabCircleUuid = Overlays.addOverlay("circle3d", teleportCircleProps);
            }

            var triangleDim = 0.02;
            var triangleOffset = minRadius - (triangleDim / 2);
            if (this.hand === LEFT_HAND) { triangleOffset *= -1; }

            // Rotation indicator gem
            if (Uuid.isEqual(Uuid.NULL, this.wristGemRotIndicator)) {
                //print("Spawning rotation indicator triangle...");
                var shapeColor = { red: 0, green: 0, blue: 0 };
                var localRot = (this.hand === LEFT_HAND) ? Quat.multiply(pose.rotation, Quat.angleAxis(180, Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y))) : pose.rotation;
                var rotationGemProps = {
                    visible: true,
                    name: "wristGemRotIndicator",
                    color: shapeColor,
                    alpha: 0.7,
                    position: translation,
                    localPosition: {x: triangleOffset, y: 0.0, z: 0},
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    localRotation: localRot,
                    isSolid: true,
                    ignorePickIntersection: true,
                    grabbable: false,
                    dimensions: { x: triangleDim, y: 0.0001, z: 0.01},
                    shape: "Triangle"
                }
                this.wristGemRotIndicator = Overlays.addOverlay("shape", rotationGemProps);
            }
        }

        this.updateDriveGem = function (wristRotation, startAngle) {
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var translation = MyAvatar.getJointPosition(handIndex);
            var localRot = this.getDriveLocalRot(wristRotation, startAngle);
            var scale = MyAvatar.getAvatarScale();
            var minRadius = 0.035 * scale;

            if (!Uuid.isEqual(Uuid.NULL, this.driveDeadzone)) {
                // Overlay already exists, just update its properties.
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveDeadzone, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive deadzone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveSlowNeg)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveSlowNeg, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive negative slow zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveMedNeg)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveMedNeg, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive negative medium zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveFastNeg)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveFastNeg, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive negative fast zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveSlowPos)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveSlowPos, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive positive slow zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveMedPos)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveMedPos, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive positive medium zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveFastPos)) {
                var props = {
                    position: translation,
                    localRotation: localRot,
                }
                var attempt = Overlays.editOverlay(this.driveFastPos, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for drive positive fast zone semicircle.");
                }
            }
            if (!Uuid.isEqual(Uuid.NULL, this.driveGemRotIndicator)) {
                var triangleDim = 0.02;
                var triangleOffset = minRadius - (triangleDim / 2);
                if (this.hand === LEFT_HAND) { triangleOffset *= -1; }
                var localRot = (this.hand === LEFT_HAND) ? Quat.multiply(pose.rotation, Quat.angleAxis(180, Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y))) : pose.rotation;
                var props = {
                    position: translation,
                    localPosition: { x: triangleOffset, y: 0.0, z: 0 },
                    //localRotation: localRot,
                    localRotation: localRot,
                    alpha: 0.7
                }
                var attempt = Overlays.editOverlay(this.driveGemRotIndicator, props);
                if (!attempt) {
                    //print("Could not find overlay to edit for wristgem rotation triangle.");
                }
            }
        }

        this.showDriveGem = function (wristRotation, startAngle) {
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var localRot = this.getDriveLocalRot(wristRotation, startAngle);
            var translation = MyAvatar.getJointPosition(handIndex);
            var scale = MyAvatar.getAvatarScale();

            var minRadius = 0.035 * scale;
            var maxRadius = 0.04 * scale;

            if (Uuid.isEqual(Uuid.NULL, this.driveDeadzone)) {
                //print("Spawning drive deadzone...");
                var props = {
                    visible: true,
                    name: "driveDeadzone",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: -DRIVE_DEADZONE,
                    endAt: DRIVE_DEADZONE,
                    isSolid: true,
                    color: DRIVE_DEADZONE_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                };
                this.driveDeadzone = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveSlowNeg)) {
                //print("Spawning drive negative slow zone...");
                var props = {
                    visible: true,
                    name: "driveSlowNeg",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: -DRIVE_SLOW,
                    endAt: -DRIVE_DEADZONE,
                    isSolid: true,
                    color: DRIVE_SLOW_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveSlowNeg = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveMedNeg)) {
                //print("Spawning drive negative medium zone...");
                var props = {
                    visible: true,
                    name: "driveMedNeg",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: -DRIVE_MEDIUM,
                    endAt: -DRIVE_SLOW,
                    isSolid: true,
                    color: DRIVE_MEDIUM_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveMedNeg = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveFastNeg)) {
                //print("Spawning drive negative fast zone...");
                var props = {
                    visible: true,
                    name: "driveFastNeg",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: -180,
                    endAt: -DRIVE_MEDIUM,
                    isSolid: true,
                    color: DRIVE_FAST_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveFastNeg = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveSlowPos)) {
                //print("Spawning drive positive slow zone...");
                var props = {
                    visible: true,
                    name: "driveSlowPos",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: DRIVE_DEADZONE,
                    endAt: DRIVE_SLOW,
                    isSolid: true,
                    color: DRIVE_SLOW_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveSlowPos = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveMedPos)) {
                //print("Spawning drive positive medium zone...");
                var props = {
                    visible: true,
                    name: "driveMedPos",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: DRIVE_SLOW,
                    endAt: DRIVE_MEDIUM,
                    isSolid: true,
                    color: DRIVE_MEDIUM_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveMedPos = Overlays.addOverlay("circle3d", props);
            }
            if (Uuid.isEqual(Uuid.NULL, this.driveFastPos)) {
                //print("Spawning drive positive fast zone...");
                var props = {
                    visible: true,
                    name: "driveFastPos",
                    position: translation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: DRIVE_MEDIUM,
                    endAt: 180,
                    isSolid: true,
                    color: DRIVE_FAST_COLOR,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 0.4,
                    grabbable: false
                }
                this.driveFastPos = Overlays.addOverlay("circle3d", props);
            }

            var triangleDim = 0.02;
            var triangleOffset = minRadius - (triangleDim / 2);
            if (this.hand === LEFT_HAND) { triangleOffset *= -1; }

            // Rotation indicator gem
            if (Uuid.isEqual(Uuid.NULL, this.driveGemRotIndicator)) {
                //print("Spawning rotation indicator triangle...");
                var shapeColor = { red: 0, green: 0, blue: 0 };
                var localRot = (this.hand === LEFT_HAND) ? Quat.multiply(pose.rotation, Quat.angleAxis(180, Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y))) : pose.rotation;
                var rotationGemProps = {
                    visible: true,
                    name: "driveGemRotIndicator",
                    color: shapeColor,
                    alpha: 0.7,
                    position: translation,
                    localPosition: { x: triangleOffset, y: 0.0, z: 0 },
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    localRotation: localRot,
                    isSolid: true,
                    ignorePickIntersection: true,
                    grabbable: false,
                    dimensions: { x: triangleDim, y: 0.0001, z: 0.01 },
                    shape: "Triangle"
                }
                this.driveGemRotationIndicator = Overlays.addOverlay("shape", rotationGemProps);
            }
        }

        this.getDriveModule = function () {
            return getEnabledModuleByName(this.hand === RIGHT_HAND ? "RightDriver" : "LeftDriver");
        }

        this.cleanup = function () {
            // Clean up vars and stuff.
            this.hideDriveGem();
            this.hideWristGem();
        };

        this.parameters = makeDispatcherModuleParameters(
            10,
            this.hand === RIGHT_HAND ? ["rightHandOverlay"] : ["leftHandOverlay"],
            [],
            100
        );
    } // END Driver(hand)

    var leftTutorialOverlay = new TutorialOverlay(LEFT_HAND);
    var rightTutorialOverlay = new TutorialOverlay(RIGHT_HAND);

    enableDispatcherModule("LeftTutorialOverlay", leftTutorialOverlay);
    enableDispatcherModule("RightTutorialOverlay", rightTutorialOverlay);

    function cleanup() {
        leftTutorialOverlay.cleanup();
        rightTutorialOverlay.cleanup();
        disableDispatcherModule("LeftTutorialOverlay");
        disableDispatcherModule("RightTutorialOverlay");
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE