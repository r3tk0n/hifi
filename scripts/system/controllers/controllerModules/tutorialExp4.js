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

    function Tutorial() {
        var _this = this;
        this.active = false;
        this.playerID = Uuid.NULL;
        this.isPlaying = false;
        this.timeStamp = Date.now();
        this.updateTimer = 0;
        this.tutorialCompleted = false;

        // Zone Entities:
        this.zone1 = Uuid.NULL;             // Drive
        this.zone2 = Uuid.NULL;             // Teleport
        this.zone3 = Uuid.NULL;             // FarGrab
        this.zone4 = Uuid.NULL;             // Snapturn

        this.flags = [false, false, false, false];
        this.stage = 0;                     // Will act as index for "this.flags", starts at 0.

        this.isReady = function (controllerData, deltaTime) {
            if (HMD.active) {
                // Only run if we're using a headset.
                return makeRunningValues(true, [], []);
            }
            return makeRunningValues(false, [], []);
        }

        this.run = function (controllerData, deltaTime) {
            if (!HMD.active) {
                // Kill if we're not in HMD...
                for (x in flags) {
                    // Reset our flags...
                    flags[x] = false;
                }
                this.stage = 0;
                return makeRunningValues(false, [], []);
            }

            // Do shit.
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

            Messages.messageReceived.disconnect(this.onMessageReceived);
            Messages.unsubscribe(HIFI_RECORDER_CHANNEL);
        }

        this.parameters = makeDispatcherModuleParameters(
            700, // priority
            [], // slots (none)
            [], // ???
            100 // update something something...
        );
    } // END Tutorial()

    var tutorialVar = Tutorial();
    tutorialVar.setUp();
    enableDispatcherModule(tutorialName, tutorialVar);

    function cleanup() {
        tutorialVar.cleanup();
    }
    Script.scriptEnding.connect(cleanup);
}()); // END LOCAL_SCOPE