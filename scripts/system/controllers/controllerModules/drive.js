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
        //print("Loaded Driver...");
        var _this = this;
        this.hand = hand;
        this.active = false;
        this.leftTeleport = null;

        var mappingName = null, driverMapping;
        var viveMapping = null, viveMapName = null, touchMapping = null, touchMapName = null, mmrMapName = null, mmrMapping = null;

        this.lastHardware = null;

        this.onHardwareChanged = function () {
            _this.updateMappings();
            _this.changed = true;
        }

        this.sameHandTeleport = function () {
            this.leftTeleport = getEnabledModuleByName("LeftTeleporter");
        }

        this.isReady = function (controllerData, deltaTime) {
            if (!HMD.active) {
                // Don't run if the HMD isn't mounted.
                return makeRunningValues(false, [], []);
            }
            return makeRunningValues(true, [], []);
        };

        this.shouldStop = function () {
            //var hardware = getCurrentHardware();
            var stop = false;
            //switch (hardware) {
            //    case NONE:
            //        // Nothing.
            //        break;
            //    case VIVE:
            //        // If left pad is clicked, don't stop.
            //        if (Controller.getValue(Controller.Hardware.Vive.LS)) {
            //            stop = false;
            //        }
            //        break;
            //    case TOUCH:
            //        // If left stick is touched, don't stop.
            //        if (Controller.getValue(Controller.Hardware.OculusTouch.LSTouch)) {
            //            stop = false;
            //        }
            //        break;
            //    case MMR:
            //        // Not supported yet.
            //        break;
            //    default:
            //        // Nothing.
            //        break;
            //}
            return stop;
        }

        this.run = function (controllerData, deltaTime) {
            var stop = this.shouldStop();

            if (stop) {
                print("Stopping drive module...");
                this.active = false;
                this.disableMappings();
                return makeRunningValues(false, [], []);
            }

            //this.updateMappings();

            return makeRunningValues(true, [], []);
        };

        this.buildViveMappings = function () {
            viveMapName = 'Hifi-Vive-Drive-' + Math.random();
            viveMapping = Controller.newMapping(viveMapName);
            viveMapping.from(Controller.Hardware.Vive.LY).peek().to(_this.viveAxis);
            viveMapping.from(function () {
                var amountPressed = _this.viveLY;
                var pose = Controller.getPoseValue(Controller.Standard.LeftHand);
                if (pose.valid && amountPressed > 0.3) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_X)).x;
                    return retMe * amountPressed;
                }
                return 0;
            }).to(Controller.Standard.LX);

            viveMapping.from(function () {
                var amountPressed = _this.viveLY;
                var pose = Controller.getPoseValue(Controller.Standard.LeftHand);
                if (pose.valid && amountPressed > 0.3) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_Z)).z;
                    return retMe * amountPressed;
                }
                return 0;
            }).to(Controller.Standard.LY);

            // Snapturn
            viveMapping.from(Controller.Hardware.Vive.LX).deadZone(0.7).to(Controller.Standard.RX);
        }

        this.viveLY = 0;
        this.touchLY = 0;

        this.viveAxis = function (value) {
            _this.viveLY = value;
        }

        this.touchAxis = function (value) {
            _this.touchLY = value;
        }

        this.buildTouchMappings = function () {
            touchMapName = 'Hifi-Touch-Drive-' + Math.random();
            touchMapping = Controller.newMapping(touchMapName);

            // Forward and Backward...
            touchMapping.from(Controller.Hardware.OculusTouch.LY).peek().to(_this.touchAxis);
            touchMapping.from(function () {
                var amountPressed = _this.touchLY;
                var pose = Controller.getPoseValue(Controller.Standard.LeftHand);
                if (pose.valid && amountPressed > 0.3) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_X)).x;
                    return retMe * amountPressed;
                }
                return 0;
            }).to(Controller.Standard.LX);

            touchMapping.from(function () {
                var amountPressed = _this.touchLY;
                var pose = Controller.getPoseValue(Controller.Standard.LeftHand);
                if (pose.valid && amountPressed > 0.3) {
                    var rotVec = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
                    var retMe = (projectVontoW(rotVec, Vec3.UNIT_Z)).z;
                    return retMe * amountPressed;
                }
                return 0;
            }).to(Controller.Standard.LY);

            // Snapturn...
            touchMapping.from(Controller.Hardware.OculusTouch.LX).deadZone(0.7).to(Controller.Standard.RX);
        }

        this.buildMMRMappings = function () {
            mmrMapName = 'Hifi-MMR-Drive-' + Math.random();
            mmrMapping = Controller.newMapping(mmrMapping);
        }

        this.updateMappings = function () {
            var hardware = getCurrentHardware();

            if (hardware !== this.lastHardware) {
                this.disableMappings();
            }

            switch (hardware) {
                case NONE:
                    // No HMD present.
                    break;
                case VIVE:
                    // HTC Vive:
                    if (!viveMapping) {
                        this.buildViveMappings();
                        // Add mappings here...
                    }
                    Controller.enableMapping(viveMapName);
                    break;
                case TOUCH:
                    // Oculus Touch:
                    if (!touchMapping) {
                        this.buildTouchMappings();
                    }
                    Controller.enableMapping(touchMapName);
                    break;
                case MMR:
                    // Microsoft Windows Mixed Reality:
                    if (!mmrMapping) {
                        this.buildMMRMappings();
                    }
                    Controller.enableMapping(mmrMapName);
                    break;
            }

            this.lastHardware = hardware;
        };

        this.disableMappings = function () {
            if (viveMapping) {
                viveMapping.disable();
            }
            if (touchMapping) {
                touchMapping.disable();
            }
            if (mmrMapping) {
                mmrMapping.disable();
            }
            this.lastHardware = null;
        }

        this.cleanup = function () {
            // Clean up vars and stuff.
            this.disableMappings();
        };

        this.parameters = makeDispatcherModuleParameters(
            600,
            "exp5",
            [],
            100
        );
    } // END Driver(hand)

    var leftDriver = new Driver(LEFT_HAND);
    leftDriver.updateMappings();

    enableDispatcherModule("LeftDriver", leftDriver);
    Controller.hardwareChanged.connect(leftDriver.onHardwareChanged);
    function cleanup() {
        leftDriver.cleanup();
        disableDispatcherModule("LeftDriver");
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE