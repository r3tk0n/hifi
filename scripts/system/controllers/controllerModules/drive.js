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

    var mappingName, driverMapping;

    function Driver(hand) {
        var _this = this;
        this.hand = hand;
        this.active = false;

        this.getOtherModule = function() {
            var otherModule = this.hand === RIGHT_HAND ? leftDriver : rightDriver;
            return otherModule;
        };

        this.isReady = function(controllerData, deltaTime) {
            var otherModule = this.getOtherModule();
            var rot = controllerData.controllerRotAngles[this.hand];
            var triggerPress = controllerData.triggerValues[this.hand];
            var pressedEnough = (triggerPress >= TRIGGER_OFF_VALUE);
            var correctRotation = (rot >= CONTROLLER_EXP2_DRIVE_MIN_ANGLE && rot < CONTROLLER_EXP2_DRIVE_MAX_ANGLE);
            if (correctRotation && pressedEnough) {
                this.active = true;
                this.registerMappings();
                Controller.enableMapping(mappingName);
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.run = function(controllerData, deltaTime) {
            var triggerPress = controllerData.triggerValues[this.hand];
            var pressedEnough = (triggerPress >= TRIGGER_OFF_VALUE);
            if (!pressedEnough) {
                driverMapping.disable();
                return makeRunningValues(false, [], []);
            }
            return makeRunningValues(true, [], []);
        };

        this.registerMappings = function() {

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
