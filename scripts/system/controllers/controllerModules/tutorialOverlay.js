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

        this.teleportCircleUuid = Uuid.NULL;
        this.farGrabCircleUuid = Uuid.NULL;

        this.isReady = function (controllerData, deltaTime) {
            if (this.isPointingUp()) {     // MyAvatar setting bool check goes here.
                print("starting...");
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.run = function (controllerData, deltaTime) {
            if (this.isPointingDown()) {     // MyAvatar setting bool check goes here.
                Overlays.deleteOverlay(this.teleportCircleUuid);
                Overlays.deleteOverlay(this.farGrabCircleUuid);
                this.farGrabCircleUuid = Uuid.NULL;
                this.teleportCircleUuid = Uuid.NULL;
                return makeRunningValues(false, [], []);
            }
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var translation = MyAvatar.getJointPosition(handIndex);

            var worldTranslation = Vec3.sum(Vec3.multiplyQbyV(MyAvatar.orientation, translation), MyAvatar.position);
            var worldRotation = getWristRotationQuat(this.hand);
            var localRot = this.getLocalRot(controllerData.controllerRotAngles[this.hand]);

            var scale = MyAvatar.getAvatarScale();
            var minRadius = 0.025 * scale;
            var maxRadius = 0.03 * scale;

            var teleportMinAngle = -45;
            var teleportMaxAngle = 45

            // Hand teleport circle...
            if (Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid)) {
                print("Spawning teleport circle...");
                var circleColor = { red: 0, green: 0, blue: 255 };
                var teleportCircleProps = {
                    visible: true,
                    name: "teleportCircle",
                    position: translation,
                    //rotation: worldRotation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: teleportMinAngle,
                    endAt: teleportMaxAngle,
                    isSolid: true,
                    color: circleColor,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 1,
                    grabbable: false
                };
                this.teleportCircleUuid = Overlays.addOverlay("circle3d", teleportCircleProps);
            } else {
                // Overlay already exists, just update its properties.
                var props = {
                    //rotation: worldRotation
                    localRotation: localRot
                }
                var attempt = Overlays.editOverlay(this.teleportCircleUuid, props);
                if (!attempt) {
                    print("Could not find overlay to edit for teleport semicircle.");
                }
            }

            var farGrabMinAngle = 45;
            var farGrabMaxAngle = 135;

            // Handle fargrab circle....
            if (Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid)) {
                print("Spawning far grab circle...");
                var circleColor = { red: 128, green: 128, blue: 0 };
                var teleportCircleProps = {
                    visible: true,
                    name: "farGrabCircle",
                    position: translation,
                    //rotation: worldRotation,
                    localRotation: localRot,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: farGrabMinAngle,
                    endAt: farGrabMaxAngle,
                    isSolid: true,
                    color: circleColor,
                    outerRadius: maxRadius,
                    innerRadius: minRadius,
                    alpha: 1,
                    grabbable: false
                };
                this.farGrabCircleUuid = Overlays.addOverlay("circle3d", teleportCircleProps);
            } else {
                // Overlay already exists, just update its properties.
                //var rot = controllerData[];
                var props = {
                    //rotation: worldRotation
                    localRotation: localRot
                }
                var attempt = Overlays.editOverlay(this.farGrabCircleUuid, props);
                if (!attempt) {
                    print("Could not find overlay to edit for fargrab semicircle.");
                }
            }
            return makeRunningValues(true, [], []);
        };

        this.cleanup = function () {
            // Clean up vars and stuff.
            if (!Uuid.isEqual(Uuid.NULL, this.teleportCircleUuid)) {
                Overlays.deleteOverlay(this.teleportCircleUuid);
            }
            if (!Uuid.isEqual(Uuid.NULL, this.farGrabCircleUuid)) {
                Overlays.deleteOverlay(this.farGrabCircleUuid);
            }
        };

        this.parameters = makeDispatcherModuleParameters(
            700,
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