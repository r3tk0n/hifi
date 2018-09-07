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

        this.circleUuid = Uuid.NULL;

        this.isReady = function (controllerData, deltaTime) {
            if (this.isPointingDown()) {     // MyAvatar setting bool check goes here.
                print("starting...");
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.isPointingUp = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle >= 135) ? true : false;
        }

        this.isPointingDown = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle <= 45) ? true : false;
        }

        this.run = function (controllerData, deltaTime) {
            if (this.isPointingUp()) {     // MyAvatar setting bool check goes here.
                Overlays.deleteOverlay(this.circleUuid);
                this.circleUuid = Uuid.NULL;
                return makeRunningValues(false, [], []);
            }
            var pose = Controller.getPoseValue(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");
            var handIndex = MyAvatar.getJointIndex(this.hand === RIGHT_HAND ? "RightHand" : "LeftHand");

            var worldTranslation = Vec3.sum(Vec3.multiplyQbyV(MyAvatar.orientation, pose.translation), MyAvatar.position);
            var worldRotation = MyAvatar.orientation;

            if (Uuid.isEqual(Uuid.NULL, this.circleUuid)) {
                print("Spawning circle...");
                var circleColor = { r: 0, g: 0, b: 255 };
                var props = {
                    visible: true,
                    name: "exp4Tutorial",
                    position: worldTranslation,
                    //rotation: worldRotation,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: handIndex,
                    startAt: 0,
                    endAt: 360,
                    isSolid: true,
                    color: circleColor,
                    outerRadius: 0.5,
                    innerRadius: 0.25,
                    alpha: 1,
                    grabbable: false
                };
                this.circleUuid = Overlays.addOverlay("circle3d", props);
            } else {
                // Overlay already exists, just update its properties.
                var props = {
                }
                var attempt = Overlays.editOverlay(this.circleUuid, props);
                if (!attempt) {
                    print("Could not find overlay to edit.");
                }
            }
            return makeRunningValues(true, [], []);
        };

        this.cleanup = function () {
            // Clean up vars and stuff.
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