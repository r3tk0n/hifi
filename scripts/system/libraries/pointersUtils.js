"use strict";

//  pointerUtils.js
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

/* jslint bitwise: true */

/* global Script, Entities, Overlays, Controller, Vec3, Quat, getControllerWorldLocation, RayPick,
   controllerDispatcherPlugins:true, controllerDispatcherPluginsNeedSort:true,
   LEFT_HAND, RIGHT_HAND, NEAR_GRAB_PICK_RADIUS, DEFAULT_SEARCH_SPHERE_DISTANCE, DISPATCHER_PROPERTIES,
   getGrabPointSphereOffset, HMD, MyAvatar, Messages, findHandChildEntities, Pointers, PickType, COLORS_GRAB_SEARCHING_HALF_SQUEEZE
   COLORS_GRAB_SEARCHING_FULL_SQUEEZE, COLORS_GRAB_DISTANCE_HOLD, Picks, TRIGGER_ON_VALUE
*/


Script.include("/~/system/libraries/controllerDispatcherUtils.js");
Pointer = function(hudLayer, pickType, pointerData) {
    var _this = this;
    this.SEARCH_SPHERE_SIZE = 0.0132;
    this.dim = {x: this.SEARCH_SPHERE_SIZE, y: this.SEARCH_SPHERE_SIZE, z: this.SEARCH_SPHERE_SIZE};
    this.halfPath = {
        type: "line3d",
        color: COLORS_GRAB_SEARCHING_HALF_SQUEEZE,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.halfEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: COLORS_GRAB_SEARCHING_HALF_SQUEEZE,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };
    this.fullPath = {
        type: "line3d",
        color: COLORS_GRAB_SEARCHING_FULL_SQUEEZE,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.fullEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: COLORS_GRAB_SEARCHING_FULL_SQUEEZE,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };
    this.holdPath = {
        type: "line3d",
        color: COLORS_GRAB_DISTANCE_HOLD,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };

    this.teleportPath = {
        type: "line3d",
        color: CONTROLLER_EXP2_CYAN,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.teleportEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: CONTROLLER_EXP2_CYAN,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };

    this.drivePath = {
        type: "line3d",
        color: CONTROLLER_EXP2_YELLOW,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.driveEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: CONTROLLER_EXP2_YELLOW,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };

    this.inspectPath = {
        type: "line3d",
        color: CONTROLLER_EXP2_MAGENTA,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.inspectEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: CONTROLLER_EXP2_MAGENTA,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };

    this.farGrabPath = {
        type: "line3d",
        color: CONTROLLER_EXP2_ORANGE,
        visible: true,
        alpha: 1,
        solid: true,
        glow: 1.0,
        ignoreRayIntersection: true, // always ignore this
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
    };
    this.farGrabEnd = {
        type: "sphere",
        dimensions: this.dim,
        solid: true,
        color: CONTROLLER_EXP2_ORANGE,
        alpha: 0.9,
        ignoreRayIntersection: true,
        drawInFront: !hudLayer, // Even when burried inside of something, show it.
        drawHUDLayer: hudLayer,
        visible: true
    };

    this.renderStates = [
        {name: "half", path: this.halfPath, end: this.halfEnd},
        {name: "full", path: this.fullPath, end: this.fullEnd},
        {name: "hold", path: this.holdPath},
        {name: "teleport", path: this.teleportPath, end: this.teleportEnd},
        {name: "drive", path: this.drivePath, end: this.driveEnd},
        {name: "inspect", path: this.inspectPath, end: this.inspectEnd},
        {name: "fargrab", path: this.farGrabPath, end: this.farGrabEnd}
    ];

    this.defaultRenderStates = [
        {name: "half", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.halfPath},
        {name: "full", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.fullPath},
        {name: "hold", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.holdPath},
        {name: "teleport", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.teleportPath},
        {name: "drive", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.drivePath},
        {name: "inspect", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.inspectPath},
        {name: "fargrab", distance: DEFAULT_SEARCH_SPHERE_DISTANCE, path: this.farGrabPath}
    ];


    this.pointerID = null;
    this.visible = false;
    this.locked = false;
    this.allwaysOn = false;
    this.hand = pointerData.hand;
    delete pointerData.hand;

    function createPointer(pickType, pointerData) {
        var pointerID = Pointers.createPointer(pickType, pointerData);
        Pointers.setRenderState(pointerID, "");
        Pointers.enablePointer(pointerID);
        return pointerID;
    }

    this.enable = function() {
        Pointers.enablePointer(this.pointerID);
    };

    this.disable = function() {
        Pointers.disablePointer(this.pointerID);
    };

    this.removePointer = function() {
        Pointers.removePointer(this.pointerID);
    };

    this.makeVisible = function() {
        this.visible = true;
    };

    this.makeInvisible = function() {
        this.visible = false;
    };

    this.lockEnd = function(lockData) {
        if (lockData !== undefined) {
            if (this.visible && !this.locked && lockData.targetID !== null) {
                var targetID = lockData.targetID;
                var targetIsOverlay = lockData.isOverlay;
                if (lockData.offset === undefined) {
                    Pointers.setLockEndUUID(this.pointerID, targetID, targetIsOverlay);
                } else {
                    Pointers.setLockEndUUID(this.pointerID, targetID, targetIsOverlay, lockData.offset);
                }
                this.locked = targetID;
            }
        } else if (this.locked) {
            Pointers.setLockEndUUID(this.pointerID, null, false);
            this.locked = false;
        }
    };

    this.updateRenderState = function (triggerClicks, triggerValues, rotationAngles) {
        var rot = rotationAngles[this.hand];
        var mode = "";
        if (this.visible) {
            if (this.locked) {
                mode = "hold";
            } else if (triggerClicks[this.hand]) {
                mode = "full";
            } else if (triggerValues[this.hand] > TRIGGER_ON_VALUE || this.allwaysOn) {
                if (rot >= CONTROLLER_EXP2_TELEPORT_MIN_ANGLE && rot <= CONTROLLER_EXP2_TELEPORT_MAX_ANGLE) {
                    mode = "teleport";
                } else if (rot >= CONTROLLER_EXP2_DRIVE_MIN_ANGLE && rot < CONTROLLER_EXP2_DRIVE_MAX_ANGLE) {
                    mode = "drive";
                } else if (rot >= CONTROLLER_EXP2_INSPECT_MIN_ANGLE && rot < CONTROLLER_EXP2_INSPECT_MAX_ANGLE) {
                    mode = "inspect";
                } else if (rot >= CONTROLLER_EXP2_FARGRAB_MIN_ANGLE && rot < CONTROLLER_EXP2_FARGRAB_MAX_ANGLE) {
                    mode = "fargrab";
                } else {
                    mode = "half";
                }
            }
        }

        Pointers.setRenderState(this.pointerID, mode);
    };
    pointerData.renderStates = this.renderStates;
    pointerData.defaultRenderStates = this.defaultRenderStates;
    this.pointerID = createPointer(pickType, pointerData);
};


PointerManager = function() {
    this.pointers = [];

    this.createPointer = function(hudLayer, pickType, pointerData) {
        var pointer = new Pointer(hudLayer, pickType, pointerData);
        this.pointers.push(pointer);
        return pointer.pointerID;
    };

    this.makePointerVisible = function(laserParams) {
        var index = laserParams.hand;
        if (index < this.pointers.length && index >= 0) {
            this.pointers[index].makeVisible();
            this.pointers[index].allwaysOn = laserParams.allwaysOn;
        }
    };

    this.makePointerInvisible = function(laserParams) {
        var index = laserParams.hand;
        if (index < this.pointers.length && index >= 0) {
            this.pointers[index].makeInvisible();
        }
    };

    this.lockPointerEnd = function(laserParams, lockData) {
        var index = laserParams.hand;
        if (index < this.pointers.length && index >= 0) {
            this.pointers[index].lockEnd(lockData);
        }
    };

    this.updatePointersRenderState = function(triggerClicks, triggerValues, rotationAngles) {
        for (var index = 0; index < this.pointers.length; index++) {
            this.pointers[index].updateRenderState(triggerClicks, triggerValues, rotationAngles);
        }
    };

    this.removePointers = function() {
        for (var index = 0; index < this.pointers.length; index++) {
            this.pointers[index].removePointer();
        }
        this.pointers = [];
    };
};
