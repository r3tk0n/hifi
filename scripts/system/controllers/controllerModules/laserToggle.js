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
        this.prev_click = false;
        this.last_swing_val = 0;

        this.getOtherModule = function () {
            var otherModule = this.hand === RIGHT_HAND ? leftDriver : rightDriver;
            return otherModule;
        };

        this.isReady = function (controllerData, deltaTime) {
            var otherModule = this.getOtherModule();

            var rot = controllerData.controllerRotAngles[this.hand];
            var swing_val = controllerData.triggerValues[this.hand];

            var clicked = controllerData.triggerClicks[this.hand];

            //var correctRotation = (rot >= CONTROLLER_EXP2_FARGRAB_MIN_ANGLE && rot <= CONTROLLER_EXP2_TELEPORT_MAX_ANGLE);

            var swing_delta = swing_val - this.last_swing_val;

            this.last_swing_val = swing_val;

            if (clicked && !prev_click && swing_delta > 0) {
                // First click to make run, in correct rotation.
                this.prev_click = clicked;
                this.active = true;
                return makeRunningValues(true, [], []);
            }
            else if (click && prev_click && swing_delta > 0) {
                // Second click, time to turn it off.
                this.active = false;
                this.prev_click = false;
                makeRunningValues(false, [], []);
            }
            else if (prev_click) {
                // Already clicked, keep it on.
                return makeRunningValues(true, [], []);
            }
            else {
                // Failing these conditions, 
                this.prev_click = false;
                this.active = false;
                return makeRunningValues(false, [], []);
            }
        };

        this.run = function (controllerData, deltaTime) {
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
