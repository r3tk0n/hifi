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
            var pressedEnough = (triggerPress >= 0.05);
            var correctRotation = (rot >= 67.5 && rot < 101.25);
            if (correctRotation && pressedEnough) {
                this.active = true;
                print((this.hand === RIGHT_HAND ? "Right Hand" : "Left Hand") + " Activated");
                this.registerMappings();
                Controller.enableMapping(mappingName);
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        };

        this.run = function(controllerData, deltaTime) {
            var triggerPress = controllerData.triggerValues[this.hand];
            var pressedEnough = (triggerPress >= 0.05);
            if (!pressedEnough) {
                driverMapping.disable();
                return makeRunningValues(false, [], []);
            }
            return makeRunningValues(true, [], []);
        };

        this.driverMappingFunction1 = function (hand = this.hand) {
            console.log(hand);
            var amountPressed = Controller.getValue((hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT);
            console.log(amountPressed);
            //print("Trigger Value: " + amountPressed);
            var pose = Controller.getPoseValue((hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            if(this.hand===RIGHT_HAND) {
                console.log(pose.valid);
            }
            if (pose.valid) {
                var rotVec = Vec3.multiplyQbyV(pose.rotation, { x: 0, y: 1, z: 0 });
                var retMe = (projectVontoW(rotVec, { x: 1, y: 0, z: 0 })).x;
                //print("Amount Pressed: " + amountPressed);
                if (this.hand === RIGHT_HAND) {
                    console.log(JSON.stringify(pose.rotation));
                    console.log(JSON.stringify(rotVec));
                    console.log(JSON.stringify(retMe));
                }
                return retMe * amountPressed;
            }
            return 0;
        }

        this.driverMappingFunction2 = function (hand = this.hand) {
            var amountPressed = Controller.getValue((hand === RIGHT_HAND) ? Controller.Standard.RT : Controller.Standard.LT)
            var pose = Controller.getPoseValue((hand === RIGHT_HAND) ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
            if (pose.valid) {
                var rotVec = Vec3.multiplyQbyV(pose.rotation, { x: 0, y: 1, z: 0 });
                var retMe = (projectVontoW(rotVec, { x: 0, y: 0, z: 1 })).z;
                //print("LY/RY Bind Returning: " + retMe * amountPressed);
                if (this.hand === RIGHT_HAND) {
                    console.log(JSON.stringify(pose.rotation));
                    console.log(JSON.stringify(rotVec));
                    console.log(JSON.stringify(retMe));
                }
                return retMe * amountPressed;
            }
            return 0;
        }

        this.registerMappings = function() {

            mappingName = 'Hifi-Driver-Dev-' + Math.random();
            driverMapping = Controller.newMapping(mappingName);

            driverMapping.from(this.driverMappingFunction1).
                to(Controller.Standard.LX);
                
            driverMapping.from(this.driverMappingFunction2).
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
