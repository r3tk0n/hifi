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

    function SelectionLaser(hand) {
        var _this = this;
        this.hand = hand;
        this.active = false;
        this.prevClick = false;
        this.clicked = false;
        this.lastSwingVal = 0;
        this.firstPass = false;

        this.getOtherModule = function () {
            var otherModule = this.hand === RIGHT_HAND ? leftSelectionLaser : rightSelectionLaser;
            return otherModule;
        };

        this.isReady = function (controllerData, deltaTime) {
            if (!HMD.active) {
                return makeRunningValues(false, [], []);
            }
            var otherModule = this.getOtherModule();

            var rot = controllerData.controllerRotAngles[this.hand];
            var swingVal = controllerData.triggerValues[this.hand];

            this.clicked = controllerData.triggerClicks[this.hand];

            var swingDelta = swingVal - this.lastSwingVal;

            this.lastSwingVal = swingVal;

            if (this.clicked && !this.prevClick && swingDelta > 0) {
                print("Initial click to enable!");
                // First click to make run, in correct rotation.
                this.firstPass = true;
                this.prevClick = this.clicked;
                this.active = true;
                return makeRunningValues(true, [], []);
            } else {
                // Failing these conditions, 
                return makeRunningValues(false, [], []);
            }
        };

        this.run = function (controllerData, deltaTime) {
            if (this.firstPass) {
                this.firstPass = false;
                return makeRunningValues(true, [], []);
            }

            this.clicked = controllerData.triggerClicks[this.hand];
            var swingVal = controllerData.triggerValues[this.hand];
            var swingDelta = swingVal - this.lastSwingVal;
            this.lastSwingVal = swingVal;

            print("\nClicked: " + this.clicked + "\nprevClick: " + this.prevClick + "\nswingDelta: " + swingDelta);
            if (this.clicked && this.prevClick && swingDelta > 0) {
                print("Second click, time to turn it off...");
                // Second click, time to turn it off.
                this.active = false;
                this.prevClick = false;
                return makeRunningValues(false, [], CONTROLLER_EXP2_KILL_LASER);
            }
            return makeRunningValues(true, [], []);
        };

        this.cleanup = function () {
            // Clean up vars and stuff.
        };

        this.parameters = makeDispatcherModuleParameters(
            45,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100,
            makeLaserParams(this.hand, true)
        );
    } // END Driver(hand)

    var leftSelectionLaser = new SelectionLaser(LEFT_HAND);
    var rightSelectionLaser = new SelectionLaser(RIGHT_HAND);

    enableDispatcherModule("LeftSelectionLaser", leftSelectionLaser);
    enableDispatcherModule("RightSelectionLaser", rightSelectionLaser);

    function cleanup() {
        driverMapping.disable();
        leftSelectionLaser.cleanup();
        rightSelectionLaser.cleanup();
        disableDispatcherModule("leftSelectionLaser");
        disableDispatcherModule("rightSelectionLaser");
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE
