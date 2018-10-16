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

        var mappingName = null, driverMapping;
        var viveMapping = null, viveMapName = null, touchMapping = null, touchMapName = null, mmrMapName = null, mmrMapping = null;

        this.lastHardware = null;

        this.onHardwareChanged = function () {
            this.updateMappings();
            this.changed = true;
        }

        this.teleport = null;

        this.getTeleport = function () {
            this.teleport = getEnabledModuleByName(_this.hand === RIGHT_HAND ? "RightTeleporter" : "LeftTeleporter");
        }

        this.shouldStop = function () {
            // Not used atm.
            var stop = false;
            return stop;
        }

        this.stickClick = false;
        this.currentQuadrant = DEADZONE;

        this.shouldMove = function () {
            if (Controller.Hardware.Vive) {
                return _this.stickClick && (_this.startedQuadrant === NORTH || _this.startedQuadrant === SOUTH) && !this.disabled;
            }
            return !this.disabled;
        }

        this.disabled = false;

        this.isReady = function (controllerData, deltaTime) {
            if (!HMD.active) {
                // Don't run if the HMD isn't mounted.
                return makeRunningValues(false, [], []);
            }

            this.getTeleport();

            if (!this.teleport) {
                return makeRunningValues(false, [], []);
            }

            this.updateMappings();
            return makeRunningValues(true, [], []);
        };

        this.debugQuadrant = false;

        this.checkQuadrant = function () {
            var x = this.viveX;
            var y = this.viveY;
            var result = DEADZONE;

            if (Math.abs(y) > Math.abs(x) && y > STICK_DEADZONE) {
                //result |= NORTH;
                if (this.debugQuadrant) { print("North.") };
                return NORTH;
            }
            if (Math.abs(y) > Math.abs(x) && y < STICK_DEADZONE) {
                //result |= SOUTH;
                if (this.debugQuadrant) { print("South.") };
                return SOUTH;
            }
            if (Math.abs(x) > Math.abs(y) && x > STICK_DEADZONE) {
                //result |= EAST;
                if (this.debugQuadrant) { print("East.") };
                return EAST;
            }
            if (Math.abs(x) > Math.abs(y) && x < STICK_DEADZONE) {
                if (this.debugQuadrant) { print("West.") };
                return WEST;
            }

            return result;
        }

        this.updateQuadrants = function () {
            this.currentQuadrant = this.checkQuadrant();
        }

        this.startedQuadrant = DEADZONE;

        this.run = function (controllerData, deltaTime) {
            var stop = this.shouldStop();

            if (stop) {
                print("Stopping drive module...");
                this.startedQuadrant = DEADZONE;
                this.currentQuadrant = DEADZONE;
                this.active = false;
                this.disableMappings();
                return makeRunningValues(false, [], []);
            }

            //if (this.hand === LEFT_HAND) {
            //    print("Disabled: " + this.disabled);
            //}

            if (this.disabled) {
                if (!controllerData.stickTouch[this.hand] && !this.teleport.active && !controllerData.yAxis[this.hand]) {
                    this.disabled = false;
                    this.updateMappings();
                } else {
                    this.disableMappings();
                }
            }


            this.stickClick = controllerData.stickClicks[this.hand];

            if (Controller.Hardware.Vive) {
                this.updateQuadrants();
                if (!_this.stickClick) {
                    this.startedQuadrant = DEADZONE;
                }
                if ((this.startedQuadrant === DEADZONE || this.currentQuadrant === DEADZONE) && !_this.stickClick) {
                    this.startedQuadrant = this.currentQuadrant;
                }
            }
            //if (this.disabled && !_this.teleport.active && (_this.touchY < STICK_DEADZONE)) {
            //    this.disabled = false;
            //}

            return makeRunningValues(true, [], []);
        };

        // SET UP VIVE MAPPINGS

        this.viveY = 0;
        this.viveX = 0;

        this.viveAxisY = function (value) {
            _this.viveY = value;
        }

        this.viveAxisX = function (value) {
            _this.viveX = value;
        }

        this.buildViveMappings = function () {
            viveMapName = (this.hand === RIGHT_HAND) ? "Drive-Vive-Mapping-Right" : "Drive-Vive-Mapping-Left";
            viveMapping = Controller.newMapping(viveMapName);

            print("Building Vive mapping...");

            // Peek the values on the Y axes for calculating our controller-relative stuff...
            viveMapping.from(_this.hand === RIGHT_HAND ? Controller.Hardware.Vive.RY : Controller.Hardware.Vive.LY).peek().to(_this.viveAxisY);
            viveMapping.from(_this.hand === RIGHT_HAND ? Controller.Hardware.Vive.RX : Controller.Hardware.Vive.LX).peek().to(_this.viveAxisX);

            // Controller-oriented movement...
            viveMapping.from(function () {
                var y = _this.viveY;

                var pointingVec = Vec3.ZERO;
                var projection = 0;

                if (notDeadzone(y) && !_this.teleport.active && _this.shouldMove()) {
                    pointingVec = getPointVector(_this.hand);
                    projection = projectVontoW(pointingVec, Vec3.UNIT_X).x;
                }

                var retMe = (projection * y);
                return retMe;
            }).to(Controller.Standard.LX);

            viveMapping.from(function () {
                var y = _this.viveY;

                var pointingVec = Vec3.ZERO;
                var projection = 0;

                if (notDeadzone(y) && !_this.teleport.active && _this.shouldMove()) {
                    pointingVec = getPointVector(_this.hand);
                    projection = projectVontoW(pointingVec, Vec3.UNIT_Z).z;
                }

                var retMe = (projection * y);
                return retMe;
            }).to(Controller.Standard.LY);

            // Snapturn
            viveMapping.from(function () {
                if (_this.stickClick && Math.abs(_this.viveX) > 0.05 && (_this.startedQuadrant === WEST || _this.startedQuadrant === EAST)) {
                    return _this.viveX;
                }
                return 0;
            }).when(_this.stickClick).deadZone(0.05).to(Controller.Standard.RX);
        }

        // SET UP TOUCH MAPPINGS

        this.touchY = 0;
        this.touchX = 0;

        this.touchAxisY = function (value) {
            _this.touchY = value;
        }

        this.touchAxisX = function (value) {
            _this.touchX = value;
        }

        this.buildTouchMappings = function () {
            touchMapName = (this.hand === RIGHT_HAND) ? "Drive-Touch-Map-Right" : "Drive-Touch-Map-Left";
            touchMapping = Controller.newMapping(touchMapName);

            // Peek the values on the Y axes for calculating our controller-relative stuff...
            touchMapping.from((_this.hand === RIGHT_HAND) ? Controller.Hardware.OculusTouch.RY : Controller.Hardware.OculusTouch.LY).peek().to(_this.touchAxisY);

            // Controller-oriented movement...
            touchMapping.from(function () {
                var y = _this.touchY;

                var pointingVec = Vec3.ZERO;
                var projection = 0;

                if (notDeadzone(y) && !_this.teleport.active && _this.shouldMove()) {
                    pointingVec = getPointVector(_this.hand);
                    projection = projectVontoW(pointingVec, Vec3.UNIT_X).x;
                }

                var retMe = (projection * y);
                return retMe;
            }).to(Controller.Standard.LX);

            touchMapping.from(function () {
                var y = _this.touchY;

                var pointingVec = Vec3.ZERO;
                var projection = 0;

                if (notDeadzone(y) && !_this.teleport.active && _this.shouldMove()) {
                    pointingVec = getPointVector(_this.hand);
                    projection = projectVontoW(pointingVec, Vec3.UNIT_Z).z;
                }

                var retMe = (projection * y);
                return retMe;
            }).to(Controller.Standard.LY);

            // Snapturn...
            touchMapping.from(_this.hand === RIGHT_HAND ? Controller.Hardware.OculusTouch.RX : Controller.Hardware.OculusTouch.LX).deadZone(0.7).to(Controller.Standard.RX);
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
                    //print("Enabling mapping...");
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
            (this.hand === RIGHT_HAND) ? ["exp5Right"] : ["exp5Left"],
            [],
            100
        );
    } // END Driver(hand)

    var leftDriver = new Driver(LEFT_HAND);
    var rightDriver = new Driver(RIGHT_HAND);

    enableDispatcherModule("LeftDriver", leftDriver);
    enableDispatcherModule("RightDriver", rightDriver);

    Controller.hardwareChanged.connect(leftDriver.onHardwareChanged);
    Controller.hardwareChanged.connect(rightDriver.onHardwareChanged);
    function cleanup() {
        leftDriver.cleanup();
        rightDriver.cleanup();
        Controller.hardwareChanged.disconnect(leftDriver.onHardwareChanged);
        Controller.hardwareChanged.disconnect(rightDriver.onHardwareChanged);
        disableDispatcherModule("LeftDriver");
        disableDispatcherModule("RightDriver");
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE