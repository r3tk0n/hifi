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

        this.isReady = function (controllerData, deltaTime) {
            return makeRunningValues(false, [], []);
        };

        this.run = function (controllerData, deltaTime) {
            return makeRunningValues(false, [], []);
        };

        this.cleanup = function () {
            // Clean up vars and stuff.
        };

        this.parameters = makeDispatcherModuleParameters(
            700,
            //this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],     // Don't occupy any slots.
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