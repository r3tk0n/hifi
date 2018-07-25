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
    function Driver(hand) {
        var _this = this;
        this.hand = hand;
        this.active = false;
        var mappingName, driverMapping;

        this.getOtherModule = function() {
            var otherModule = this.hand === RIGHT_HAND ? leftDriver : rightDriver;
            return otherModule;
        };

        this.isReady = function(controllerData, deltaTime) {
            var otherModule = this.getOtherModule();
            var rot = controllerData.controllerRotAngles[this.hand];
            var triggerPress = controllerData.triggerValues[this.hand];
            var pressedEnough = (triggerPress >= 0.1);
            var correctRotation = (rot >= 67.5 && rot < 101.25);
            if (correctRotation && pressedEnough) {
                this.active = true;
                registerMappings();
                Controller.enableMapping(mappingName);
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.run = function(controllerData, deltaTime) {
            var triggerPress = controllerData.triggerValues[this.hand];
            var pressedEnough = (triggerPress >= 0.1);
            if (!pressedEnough) {
                driverMapping.disable();
            }
        };

        this.cleanup = function() {
            // Clean up vars and stuff.
        };

        this.parameters = makeDispatcherModuleParameters(
            50,
            this.hand === RIGHT_HAND ? ["rightHand"] : ["leftHand"],
            [],
            100
        );
    } // END Driver(hand)

    function registerMappings() {
        mappingName = 'Hifi-Driver-Dev-' + Math.random();
        driverMapping = Controller.newMapping(mappingName);

        // lambda functions should take projections
        if (this.hand === RIGHT_HAND) {
            driverMapping.from(/*lambda*/).
                to(Controller.Standard.LX);
            driverMapping.from(/*lambda*/).
                to(Controller.Standard.LY);
        } else {
            driverMapping.from(/*lambda*/).
                to(Controller.Standard.RX);
            driverMapping.from(/*lambda*/).
                to(Controller.Standard.RY);
        }
    };

    var leftDriver = new Driver(LEFT_HAND);
    var rightDriver = new Driver(RIGHT_HAND);

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