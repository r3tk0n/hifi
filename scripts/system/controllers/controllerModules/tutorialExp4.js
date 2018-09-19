"use strict";

// Created by Jason Najera on 9/17/2018
// Copyright 2018 High Fidelity, Inc
//
//  Distributed under teh Apache License, Version 2.0
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

Script.include("/~/system/libraries/controllerDispatcherUtils.js");

(function () { // BEGIN LOCAL_SCOPE
    var tutorialName = "Exp4Tutorial";
    // Handle Avatar recordings.
    var HIFI_RECORDER_CHANNEL = "HiFi-Recorder-Channel";
    var RECORDER_COMMAND_ERROR = "error";
    var HIFI_PLAYER_CHANNEL = "HiFi-Player-Channel";
    var PLAYER_COMMAND_PLAY = "play";
    var PLAYER_COMMAND_STOP = "stop";

    // .hfr URLs (upload to S3 bucket)
    var TUTORIAL1_URL = "";
    var TUTORIAL2_URL = "";
    var TUTORIAL3_URL = "";
    var TUTORIAL4_URL = "";

    var UPDATE_INTERVAL = 5000;     // Must be > player's HEARTBEAT_INTERVAL

    var driveZone = (function () {
        this.enterEntity = function (entityID) {
            // Stuff to do when entering entity.
        };

        this.leaveEntity = function (entityID) {
            // Stuff to do when leaving entity.
        }
    });

    function Tutorial() {
        var _this = this;
        this.active = false;
        this.playerID = Uuid.NULL;
        this.isPlaying = false;
        this.timeStamp = Date.now();
        this.updateTimer = 0;
        this.tutorialCompleted = false;

        this.entities = [];
        this.overlays = [];

        // (Not) Zone Entities:
        this.driveZone = Uuid.NULL;
        this.drivezoneOverlay = Uuid.NULL;
        this.teleportZone = Uuid.NULL;
        this.teleportZoneOverlay = Uuid.NULL;
        this.fargrabZone = Uuid.NULL;
        this.fargrabZoneOverlay = Uuid.NULL;
        this.snapturnZone = Uuid.NULL;
        this.snapturnZone = Uuid.NULL;

        // Targets
        this.fargrabTarget = Uuid.NULL;
        this.snapturnTarget1 = Uuid.NULL;
        this.snapturnTarget2 = Uuid.NULL;
        this.snapturnTarget3 = Uuid.NULL;

        this.flags = [false, false, false, false];
        this.stage = 0;                     // Will act as index for "this.flags", starts at 0.

        this.isPointingUp = function () {
            var angle = getAngleFromGround(this.hand);
            return (angle >= 135) ? true : false;
        }

        this.spawnBox = function (position, orientation, dimensions, name) {
            var props = {
                type: "Box",
                name: name,
                position: position,
                visible: true,
                canCastShadow: false,
                rotation: orientation,
                collisionless: true,
                color: { red: 255, green: 0, blue: 0 },
                alpha: 0.001,
                dynamic: false,
                dimensions: dimensions
            };

            var id = Entities.addEntity(props);
            this.entities.push(id);
            return id;
        }

        this.spawnWireframeBox = function(position, orientation, dimensions, name) {
            var props = {
                color: {red: 255, green: 0, blue: 0},
                alpha: 1.0,
                name: name,
                isWire: true,
                visible: true,
                position: position,
                orientation: orientation,
                dimensions: dimensions
            };

            var id = Overlays.addOverlay("cube", props);
            this.overlays.push(id);
            return id;
        }

        this.spawnBoxes = function () {
            var position = MyAvatar.position;
            var orientation = MyAvatar.orientation;
            var distance = 5 * MyAvatar.getAvatarScale();

            // Dimensions of boxes...
            var height = MyAvatar.getHeight();
            var scale = MyAvatar.getAvatarScale();
            var width = 1.0 * scale;
            var dimensions = {x: width, y: height, z: width};

            var forward = Vec3.multiplyQbyV(orientation, { x: 0, y: 0, z: -1 });
            var backward = Vec3.multiplyQbyV(orientation, Vec3.UNIT_Z);
            var right = Vec3.multiplyQbyV(orientation, Vec3.UNIT_X);
            var left = Vec3.multiplyQbyV(orientation, { x: -1, y: 0, z: 0 });
            var up = Vec3.multiplyQbyV(orientation, Vec3.UNIT_Y);

            var offsetZ1 = Vec3.sum(position, Vec3.multiply(distance, forward));
            var offsetZ2 = Vec3.sum(offsetZ1, Vec3.multiply(distance, left));
            var offsetZ3 = Vec3.sum(offsetZ1, Vec3.multiply(distance, right));
            var offsetZ4 = Vec3.sum(offsetZ1, Vec3.multiply(distance, forward));

            this.driveZone = this.spawnBox(offsetZ1, orientation, dimensions, "Zone 1");
            this.teleportZone = this.spawnBox(offsetZ2, orientation, dimensions, "Zone 2");
            this.fargrabZone = this.spawnBox(offsetZ3, orientation, dimensions, "Zone 3");
            this.snapturnZone = this.spawnBox(offsetZ4, orientation, dimensions, "Zone 4");
            this.driveZone = this.spawnWireframeBox(offsetZ1, orientation, dimensions, "Zone 1 Overlay");
            this.teleportZone = this.spawnWireframeBox(offsetZ2, orientation, dimensions, "Zone 2 Overlay");
            this.fargrabZone = this.spawnWireframeBox(offsetZ3, orientation, dimensions, "Zone 3 Overlay");
            this.snapturnZone = this.spawnWireframeBox(offsetZ4, orientation, dimensions, "Zone 4 Overlay");
        }

        this.clearIDs = function () {
            this.driveZone = Uuid.NULL;
            this.drivezoneOverlay = Uuid.NULL;
            this.teleportZone = Uuid.NULL;
            this.teleportZoneOverlay = Uuid.NULL;
            this.fargrabZone = Uuid.NULL;
            this.fargrabZoneOverlay = Uuid.NULL;
            this.snapturnZone = Uuid.NULL;
            this.snapturnZone = Uuid.NULL;
        }

        this.tearDown = function () {
            this.cleanupEntities();
            this.cleanupOverlays();
        }

        this.cleanupEntities = function () {
            for (x in this.entities) {
                Entities.deleteEntity(this.entities[x]);
            }

            this.entities = [];

            this.clearIDs();
        }

        this.cleanupOverlays = function () {
            for (x in this.overlays) {
                Overlays.deleteOverlay(this.overlays[x]);
            }
            this.overlays = [];
            this.clearIDs();
        }

        this.isReady = function (controllerData, deltaTime) {
            if (HMD.active) {
                // Only run if we're using a headset.
                if (controllerData.triggerClicks[RIGHT_HAND]) {
                    // Do this check separately to save cycles on the angle from ground call.
                    // Run if the trigger is clicked and we're pointing up.
                    print("Spawning boxes...");
                    this.spawnBoxes();
                    return makeRunningValues(true, [], []);
                }
            }
            return makeRunningValues(false, [], []);
        }

        this.run = function (controllerData, deltaTime) {
            if (!HMD.active) {
                // Kill if we're not in HMD...
                for (x in this.flags) {
                    // Reset our flags...
                    this.flags = false;
                }

                this.tearDown();

                this.stage = 0;
                return makeRunningValues(false, [], []);
            }

            // Do stuff.
            return makeRunningValues(true, [], []);
        }

        this.onMessageReceived = function (channel, message, sender) {
            // Heartbeat from AC script.
            if (channel !== HIFI_RECORDER_CHANNEL) {
                return;
            }

            message = JSON.parse(message);

            if (message.command === RECORDER_COMMAND_ERROR) {
                if (message.user === MyAvatar.sessionUUID) {
                    error(message.message);
                }
            } else {
                this.playerID = sender;                     // "sender" will be Uuid of player...
                if (this.isPlaying !== message.playing) {
                    print("Player status changed: \nOld: " + this.isPlaying + "\nNew:" + message.playing);
                    this.isPlaying = message.playing;           // playing will be the status
                }
                this.timeStamp = Date.now();                // Save the timestamp...
            }
        }

        this.updatePlayer = function () {
            var now = Date.now();
            if (now - this.timeStamp > UPDATE_INTERVAL) {
                this.playerID = Uuid.NULL;
                this.isPlaying = false;
                this.timeStamp = Date.now();
            }
        }

        this.stopPlaying = function () {
            Messages.sendMessage(HIFI_PLAYER_CHANNEL, JSON.stringify({
                player: this.playerID,
                command: PLAYER_COMMAND_STOP
            }));
        }

        this.playRecording = function (recording, position, orientation) {
            // Check optional parameters:
            if (position === undefined) {
                position = MyAvatar.position;
            }
            if (orientation === undefined) {
                orientation = MyAvatar.orientation;
            }

            if (Uuid.isEqual(this.playerID, Uuid.NULL)) {
                // No player exists...
                print("Error (tutorialExp4.js: No player exists.");
                return;
            }

            Messages.sendMessage(HIFI_PLAYER_CHANNEL, JSON.stringify({
                player: this.playerID,
                command: PLAYER_COMMAND_PLAY,
                recording: recording,
                position: position,
                orientation: orientation
            }));
        }

        this.setUp = function () {
            Messages.messageReceived.connect(this.onMessageReceived);
            Messages.subscribe(HIFI_RECORDER_CHANNEL);

            this.updateTimer = Script.setInterval(this.updatePlayer, UPDATE_INTERVAL);
        }

        this.cleanup = function () {
            Script.clearInterval(this.updateTimer);

            this.tearDown();

            Messages.messageReceived.disconnect(this.onMessageReceived);
            Messages.unsubscribe(HIFI_RECORDER_CHANNEL);
        }

        this.parameters = makeDispatcherModuleParameters(
            700, // priority
            ["tutorial"], // slots (none)
            [], // ???
            100 // update something something...
        );
    } // END Tutorial()

    var tutorialVar = new Tutorial();
    tutorialVar.setUp();
    enableDispatcherModule(tutorialName, tutorialVar);

    function cleanup() {
        tutorialVar.cleanup();
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE