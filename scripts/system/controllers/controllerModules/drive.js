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
        this.rightTeleport = null;

        var mappingName = null, driverMapping;
        var viveMapping = null, viveMapName = null, touchMapping = null, touchMapName = null, mmrMapName = null, mmrMapping = null;

        this.lastHardware = null;

        this.onHardwareChanged = function () {
            _this.updateMappings();
            _this.changed = true;
        }

        this.getLeftTeleport = function () {
            this.leftTeleport = getEnabledModuleByName("LeftTeleporter");
        }

        this.getRightTeleport = function () {
            this.rightTeleport = getEnabledModuleByName("RightTeleporter");
        }

        this.viveLY = 0;
        this.viveRY = 0;
        this.viveLX = 0;
        this.viveRX = 0;
        this.touchLY = 0;
        this.touchRY = 0;

        this.viveAxisLX = function (value) {
            _this.viveLX = value;
        }

        this.viveAxisRX = function (value) {
            _this.viveRX = value;
        }

        this.viveAxisLY = function (value) {
            _this.viveLY = value;
        }

        this.viveAxisRY = function (value) {
            _this.viveRY = value;
        }

        this.touchAxisLY = function (value) {
            _this.touchLY = value;
        }

        this.touchAxisRY = function (value) {
            _this.touchRY = value;
        }

        this.shouldStop = function () {
            // Not used atm.
            var stop = false;
            return stop;
        }

        this.leftQuadrant = DEADZONE;
        this.rightQuadrant = DEADZONE;
        this.leftStickClick = false;
        this.rightStickClick = false;

        this.shouldMoveLeftHand = function () {
            if (Controller.Hardware.Vive) {
                return _this.leftStickClick && (_this.startedQuadrantLeft === NORTH || _this.startedQuadrantLeft === SOUTH);
            }
            return !this.disabledLeft;
        }

        this.shouldMoveRightHand = function () {
            if (Controller.Hardware.Vive) {
                return _this.rightStickClick && (_this.startedQuadrantRight=== NORTH || _this.startedQuadrantRight === SOUTH);
            }
            return !this.disabledRight;
        }

        this.disabledLeft = false;
        this.disabledRight = false;

        this.isReady = function (controllerData, deltaTime) {
            if (!HMD.active) {
                // Don't run if the HMD isn't mounted.
                return makeRunningValues(false, [], []);
            }

            this.getLeftTeleport();
            this.getRightTeleport();

            if (!this.leftTeleport || !this.rightTeleport) {
                return makeRunningValues(false, [], []);
            }

            return makeRunningValues(true, [], []);
        };

        this.checkQuadrantLeft = function () {
            var x = this.viveLX;
            var y = this.viveLY;
            var result = DEADZONE;

            if (Math.abs(y) > Math.abs(x) && y > STICK_DEADZONE) {
                //result |= NORTH;
                return NORTH;
            }
            if (Math.abs(y) > Math.abs(x) && y < STICK_DEADZONE) {
                //result |= SOUTH;
                return SOUTH;
            }
            if (Math.abs(x) > Math.abs(y) && x > STICK_DEADZONE) {
                //result |= EAST;
                return EAST;
            }
            if (Math.abs(x) > Math.abs(y) && x < STICK_DEADZONE) {
                return WEST;
            }

            return result;
        }

        this.checkQuadrantRight = function () {
            var x = this.viveRX;
            var y = this.viveRY;
            var result = DEADZONE;

            if (Math.abs(y) > Math.abs(x) && y > STICK_DEADZONE) {
                //result |= NORTH;
                return NORTH;
            }
            if (Math.abs(y) > Math.abs(x) && y < STICK_DEADZONE) {
                //result |= SOUTH;
                return SOUTH;
            }
            if (Math.abs(x) > Math.abs(y) && x > STICK_DEADZONE) {
                //result |= EAST;
                return EAST;
            }
            if (Math.abs(x) > Math.abs(y) && x < STICK_DEADZONE) {
                return WEST;
            }

            return result;
        }
        
        this.updateQuadrants = function () {
            this.leftQuadrant = this.checkQuadrantLeft();
            this.rightQuadrant = this.checkQuadrantRight();
        }

        this.startedQuadrantLeft = DEADZONE;
        this.startedQuadrantRight = DEADZONE;

        this.run = function (controllerData, deltaTime) {
            var stop = this.shouldStop();

            if (stop) {
                print("Stopping drive module...");
                this.active = false;
                this.disableMappings();
                return makeRunningValues(false, [], []);
            }

            this.leftStickClick = controllerData.stickClicks[LEFT_HAND];
            this.rightStickClick = controllerData.stickClicks[RIGHT_HAND];

            if (Controller.Hardware.Vive) {
                this.updateQuadrants();
                if (!_this.leftStickClick) {
                    this.startedQuadrantLeft = DEADZONE;
                }
                if (!_this.rightStickClick) {
                    this.startedQuadrantRight = DEADZONE;
                }
                if ((this.startedQuadrantLeft === DEADZONE || this.leftQuadrant === DEADZONE) && !_this.leftStickClick) {
                    this.startedQuadrantLeft = this.leftQuadrant;
                }
                if ((this.startedQuadrantRight === DEADZONE || this.rightQuadrant === DEADZONE) && !_this.rightStickClick) {
                    this.startedQuadrantRight = this.rightQuadrant;
                }
            }

            if (this.disabledLeft && !this.leftTeleport.active && (_this.touchLY < STICK_DEADZONE)) {
                this.disabledLeft = false;
            }

            if (this.disabledRight && !this.rightTeleport.active && (_this.touchRY < STICK_DEADZONE)) {
                this.disabledRight = false;
            }

            //this.updateMappings();

            return makeRunningValues(true, [], []);
        };

        this.buildViveMappings = function () {
            viveMapName = 'Hifi-Vive-Drive-' + Math.random();
            viveMapping = Controller.newMapping(viveMapName);

            // Peek the values on the Y axes for calculating our controller-relative stuff...
            viveMapping.from(Controller.Hardware.Vive.LY).peek().to(_this.viveAxisLY);
            viveMapping.from(Controller.Hardware.Vive.RY).peek().to(_this.viveAxisRY);
            viveMapping.from(Controller.Hardware.Vive.LX).peek().to(_this.viveAxisLX);
            viveMapping.from(Controller.Hardware.Vive.RX).peek().to(_this.viveAxisRX);

            // Controller-oriented movement...
            viveMapping.from(function () {
                var RY = _this.viveRY;

                var rightVec = Vec3.ZERO;
                var rightProj = 0;

                if (notDeadzone(RY) && !_this.rightTeleport.active && _this.shouldMoveRightHand()) {
                    rightVec = getPointVector(RIGHT_HAND);
                    rightProj = projectVontoW(rightVec, Vec3.UNIT_X).x;
                }

                var retMe = (rightProj * RY);
                return retMe;
            }).to(Controller.Standard.LX);

            viveMapping.from(function () {
                var LY = _this.viveLY;

                var leftVec = Vec3.ZERO;
                var leftProj = 0;

                if (notDeadzone(LY) && !_this.leftTeleport.active && _this.shouldMoveLeftHand()) {
                    leftVec = getPointVector(LEFT_HAND);
                    leftProj = projectVontoW(leftVec, Vec3.UNIT_X).x;
                }

                var retMe = (leftProj * LY);
                return retMe;
            }).to(Controller.Standard.LX);

            viveMapping.from(function () {
                var RY = _this.viveRY;

                var rightVec = Vec3.ZERO;
                var rightProj = 0;

                if (notDeadzone(RY) && !_this.rightTeleport.active && _this.shouldMoveRightHand()) {
                    rightVec = getPointVector(RIGHT_HAND);
                    rightProj = projectVontoW(rightVec, Vec3.UNIT_Z).z;
                }

                var retMe = (rightProj * RY);
                return retMe;
            }).to(Controller.Standard.LY);

            viveMapping.from(function () {
                var LY = _this.viveLY;

                var leftVec = Vec3.ZERO;
                var leftProj = 0;

                if (notDeadzone(LY) && !_this.leftTeleport.active && _this.shouldMoveLeftHand()) {
                    leftVec = getPointVector(LEFT_HAND);
                    leftProj = projectVontoW(leftVec, Vec3.UNIT_Z).z;
                }

                var retMe = (leftProj * LY);
                return retMe;
            }).to(Controller.Standard.LY);

            // Snapturn
            viveMapping.from(function () {
                if (_this.leftStickClick && Math.abs(_this.viveLX) > 0.05 && (_this.startedQuadrantLeft === WEST || _this.startedQuadrantLeft === EAST)) {
                    return _this.viveLX;
                }
                return 0;
            }).when(_this.leftStickClick).deadZone(0.05).to(Controller.Standard.RX);
            viveMapping.from(function () {
                if (_this.rightStickClick && Math.abs(_this.viveRX) > 0.05 && (_this.startedQuadrantRight === WEST || _this.startedQuadrantRight === EAST)) {
                    return _this.viveRX;
                }
                return 0;
            }).when(_this.rightStickClick).deadZone(0.05).to(Controller.Standard.RX);
        }

        this.buildTouchMappings = function () {
            touchMapName = 'Hifi-Touch-Drive-' + Math.random();
            touchMapping = Controller.newMapping(touchMapName);

            // Peek the values on the Y axes for calculating our controller-relative stuff...
            touchMapping.from(Controller.Hardware.OculusTouch.LY).peek().to(_this.touchAxisLY);
            touchMapping.from(Controller.Hardware.OculusTouch.RY).peek().to(_this.touchAxisRY);

            // Controller-oriented movement...
            touchMapping.from(function () {
                var LY = _this.touchLY;

                var leftVec = Vec3.ZERO;
                var leftProj = 0;

                if (notDeadzone(LY) && !_this.leftTeleport.active && _this.shouldMoveLeftHand()) {
                    leftVec = getPointVector(LEFT_HAND);
                    leftProj = projectVontoW(leftVec, Vec3.UNIT_X).x;
                }

                var retMe = (leftProj * LY);
                return retMe;
            }).to(Controller.Standard.LX);

            touchMapping.from(function () {
                var RY = _this.touchRY;

                var rightVec = Vec3.ZERO;
                var rightProj = 0;

                if (notDeadzone(RY) && !_this.rightTeleport.active && _this.shouldMoveRightHand()) {
                    rightVec = getPointVector(RIGHT_HAND);
                    rightProj = projectVontoW(rightVec, Vec3.UNIT_X).x;
                }

                var retMe = (rightProj * RY);
                return retMe;
            }).to(Controller.Standard.LX);

            touchMapping.from(function () {
                var LY = _this.touchLY;

                var leftVec = Vec3.ZERO;
                var leftProj = 0;

                if (notDeadzone(LY) && !_this.leftTeleport.active && _this.shouldMoveLeftHand()) {
                    leftVec = getPointVector(LEFT_HAND);
                    leftProj = projectVontoW(leftVec, Vec3.UNIT_Z).z;
                }

                var retMe = (leftProj * LY);
                return retMe;
            }).to(Controller.Standard.LY);

            touchMapping.from(function () {
                var RY = _this.touchRY;

                var rightVec = Vec3.ZERO;
                var rightProj = 0;

                if (notDeadzone(RY) && !_this.rightTeleport.active && _this.shouldMoveRightHand()) {
                    rightVec = getPointVector(RIGHT_HAND);
                    rightProj = projectVontoW(rightVec, Vec3.UNIT_Z).z;
                }

                var retMe = (rightProj * RY);
                return retMe;
            }).to(Controller.Standard.LY);

            // Snapturn...
            touchMapping.from(Controller.Hardware.OculusTouch.LX).deadZone(0.7).to(Controller.Standard.RX);
            touchMapping.from(Controller.Hardware.OculusTouch.RX).deadZone(0.7).to(Controller.Standard.RX);
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