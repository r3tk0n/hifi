"use strict";

//  controllerDispatcherUtils.js
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

/* global module, Camera, HMD, MyAvatar, controllerDispatcherPlugins:true, Quat, Vec3, Overlays, Xform,
   Selection, Uuid,
   MSECS_PER_SEC:true , LEFT_HAND:true, RIGHT_HAND:true, FORBIDDEN_GRAB_TYPES:true,
   HAPTIC_PULSE_STRENGTH:true, HAPTIC_PULSE_DURATION:true, ZERO_VEC:true, ONE_VEC:true,
   DEFAULT_REGISTRATION_POINT:true, INCHES_TO_METERS:true,
   TRIGGER_OFF_VALUE:true,
   TRIGGER_ON_VALUE:true,
   PICK_MAX_DISTANCE:true,
   DEFAULT_SEARCH_SPHERE_DISTANCE:true,
   NEAR_GRAB_PICK_RADIUS:true,
   COLORS_GRAB_SEARCHING_HALF_SQUEEZE:true,
   COLORS_GRAB_SEARCHING_FULL_SQUEEZE:true,
   COLORS_GRAB_DISTANCE_HOLD:true,
   NEAR_GRAB_RADIUS:true,
   DISPATCHER_PROPERTIES:true,
   HAPTIC_PULSE_STRENGTH:true,
   HAPTIC_PULSE_DURATION:true,
   DISPATCHER_HOVERING_LIST:true,
   DISPATCHER_HOVERING_STYLE:true,
   Entities,
   makeDispatcherModuleParameters:true,
   makeRunningValues:true,
   enableDispatcherModule:true,
   disableDispatcherModule:true,
   getEnabledModuleByName:true,
   getGrabbableData:true,
   entityIsGrabbable:true,
   entityIsDistanceGrabbable:true,
   getControllerJointIndexCacheTime:true,
   getControllerJointIndexCache:true,
   getControllerJointIndex:true,
   propsArePhysical:true,
   controllerDispatcherPluginsNeedSort:true,
   projectOntoXYPlane:true,
   projectOntoEntityXYPlane:true,
   projectOntoOverlayXYPlane:true,
   makeLaserLockInfo:true,
   entityHasActions:true,
   ensureDynamic:true,
   findGroupParent:true,
   BUMPER_ON_VALUE:true,
   getEntityParents:true,
   findHandChildEntities:true,
   makeLaserParams:true,
   TEAR_AWAY_DISTANCE:true,
   TEAR_AWAY_COUNT:true,
   TEAR_AWAY_CHECK_TIME:true,
   distanceBetweenPointAndEntityBoundingBox:true,
   entityIsEquipped:true,
   entityIsFarGrabbedByOther:true,
   highlightTargetEntity:true,
   clearHighlightedEntities:true,
   unhighlightTargetEntity:true,
   distanceBetweenEntityLocalPositionAndBoundingBox: true
*/

MSECS_PER_SEC = 1000.0;
INCHES_TO_METERS = 1.0 / 39.3701;

HAPTIC_PULSE_STRENGTH = 1.0;
HAPTIC_PULSE_DURATION = 13.0;

ZERO_VEC = { x: 0, y: 0, z: 0 };
ONE_VEC = { x: 1, y: 1, z: 1 };

LEFT_HAND = 0;
RIGHT_HAND = 1;
AVATAR_HEAD = 2;

FORBIDDEN_GRAB_TYPES = ["Unknown", "Light", "PolyLine", "Zone"];

HAPTIC_PULSE_STRENGTH = 1.0;
HAPTIC_PULSE_DURATION = 13.0;

DEFAULT_REGISTRATION_POINT = { x: 0.5, y: 0.5, z: 0.5 };

TRIGGER_OFF_VALUE = 0.1;
TRIGGER_ON_VALUE = TRIGGER_OFF_VALUE + 0.05; // Squeezed just enough to activate search or near grab
BUMPER_ON_VALUE = 0.5;

PICK_MAX_DISTANCE = 500; // max length of pick-ray
DEFAULT_SEARCH_SPHERE_DISTANCE = 1000; // how far from camera to search intersection?
NEAR_GRAB_PICK_RADIUS = 0.25; // radius used for search ray vs object for near grabbing.

// Experiment 3 & 4 Constants:
EXP3_MAX_DISTANCE = 0.4;    // distance used between head and hand picks
EXP3_STARE_THRESHOLD = 3.0; // time, in seconds, user must hold gaze and point before action starts

// Colors.
EXP3_LOADED_COLOR = { red: 0, green: 0, blue: 255 };
EXP3_LINE3D_NO_INTERSECTION = { red: 255, green: 0, blue: 0 };
EXP3_LOADING_COLOR = { red: 255, green: 255, blue: 0 };
EXP3_FARGRAB_LOADED_COLOR = { red: 0, green: 0, blue: 255 };
EXP3_FARGRAB_LOADING_COLOR = { red: 255, green: 0, blue: 0 };
LIGHT_TEAL = { red: 0, green: 128, blue: 128 };
BRIGHT_TEAL = { red: 0, green: 255, blue: 255 };
RED = { red: 255, green: 0, blue: 0 };
YELLOW = { red: 255, green: 255, blue: 0 };

// Distance activation constants
EXP3_DISTANCE_RATIO = 0.075;
EXP3_DISABLE_LASER_ANGLE = 70;
EXP3_DISABLE_TELEPORT_ANGLE = 70;           // Angle from look to hand vector, used to hide teleport parabola.

// Experimental modules to activate (for debugging, mostly).
EXP3_USE_FARGRAB = true;
EXP3_USE_TELEPORT = true;
EXP3_USE_DRIVE = true;

// Timer control constants.
EXP3_NOT_POINTING_TIMEOUT = 4;        // Seconds
EXP3_START_POINTING_TIMEOUT = 0.025;      // Seconds
EXP3_START_DRIVING_TIMEOUT = 0.5;       // Seconds

// Activation Flags
EXP3_USE_CTRLR_ROTATION = true;
EXP3_USE_CTRLR_VELOCITY = true;
EXP3_USE_HEAD_VELOCITY = false;
EXP3_USE_DISTANCE = false;

// Misc Flags
EXP3_ALLOW_TWO_TELEPORTERS = true;

// Deactivation Flags
EXP3_USE_LOOK_HAND_ANGLE = false;
EXP3_USE_LOOK_HAND_POS = true;
EXP3_USE_POINTING_DOWN_FOR_OFF = false;
EXP3_USE_THUMB_UP = false;

// Controller Experiment 3 Rotation Angles:
CONTROLLER_EXP3_TELEPORT_MIN_ANGLE = 0;
CONTROLLER_EXP3_TELEPORT_MAX_ANGLE = 47;
// Three degree gap
CONTROLLER_EXP3_FARGRAB_MIN_ANGLE = 43;
CONTROLLER_EXP3_FARGRAB_MAX_ANGLE = 135;
//CONTROLLER_EXP3_DRIVE_MIN_ANGLE = 135;
CONTROLLER_EXP3_DRIVE_MIN_ANGLE = 0;
//CONTROLLER_EXP3_DRIVE_MAX_ANGLE = 180;
CONTROLLER_EXP3_DRIVE_MAX_ANGLE = 45;
EXP3_LOOK_DOWN_THRESHOLD = 15;
EXP3_POINT_AWAY_FROM_LOOK = 25;

EXP3_FARGRAB_HORIZONTAL_BEAM_ON_ANGLE = 18;
EXP3_FARGRAB_HORIZONTAL_BEAM_OFF_ANGLE = 22;

EXP3_FARGRAB_VERTICAL_BEAM_ON_ANGLE = 60;
EXP3_FARGRAB_VERTICAL_BEAM_OFF_ANGLE = 64;

EXP3_TELEPORT_BEAM_ON_ANGLE = 18;
EXP3_TELEPORT_BEAM_OFF_ANGLE = 22;

EXP3_POINT_DOWN_RANGE = 10;
SMALL_NUMBER = 0.0001;

// Controller Experiment 3 Head Angular Velocity Constants
EXP3_HEAD_MAX_ANGULAR_VELOCITY = 0.1;
EXP3_HAND_MAX_ANGULAR_VELOCITY = 0.2;
EXP3_DELTA = 0.5;                           // Delta for trailing average

// Controller Experiment 3 Controller Linear Velocity Constants
EXP3_MAX_CTRLR_VELOCITY = 0.025;        // m/s

// Drive snap-turn constants.
ROT_MULTIPLIER = 2;
DRIVE_ROT_ANGLE = 7.5;
SNAP_TURN_WRIST_ANGLE = 22.5;       //  How far must you turn wrist to snap turn?
SNAP_TURN_ANGLE = 22.5;             //  Degrees to snap turn 
MAX_SPEED = 3.0;                    //  Max walking speed in m/sec, both hands = 2X
MIN_GRIP_MOVE = 0.2;                //  Smallest pressure that will cause movement, to allow snap turn below
TRIGGER_ON = 0.1;
TRIGGER_OFF = 0.05;

// Drive snap-turn timer constants:
DRIVE_FAST_UPDATE = 0.25;               // Seconds.
DRIVE_MID_UPDATE = 0.5;                 // Seconds.
DRIVE_SLOW_UPDATE = 1.0;                // Seconds.

// Drive snapturn update region constraints
DRIVE_DEADZONE = 10;                    // Degrees from where drive started in either direction.
DRIVE_SLOW = 30;
DRIVE_MEDIUM = 60;

// Drive misc
EXP3_NO_DRIVE_TIMER = 0.25;            // Seconds.


COLORS_GRAB_SEARCHING_HALF_SQUEEZE = { red: 10, green: 10, blue: 255 };
COLORS_GRAB_SEARCHING_FULL_SQUEEZE = { red: 250, green: 10, blue: 10 };
COLORS_GRAB_DISTANCE_HOLD = { red: 238, green: 75, blue: 214 };

NEAR_GRAB_RADIUS = 1.0;

TEAR_AWAY_DISTANCE = 0.15; // ungrab an entity if its bounding-box moves this far from the hand
TEAR_AWAY_COUNT = 2; // multiply by TEAR_AWAY_CHECK_TIME to know how long the item must be away
TEAR_AWAY_CHECK_TIME = 0.15; // seconds, duration between checks
DISPATCHER_HOVERING_LIST = "dispactherHoveringList";
DISPATCHER_HOVERING_STYLE = {
    isOutlineSmooth: true,
    outlineWidth: 0,
    outlineUnoccludedColor: { red: 255, green: 128, blue: 128 },
    outlineUnoccludedAlpha: 0.0,
    outlineOccludedColor: { red: 255, green: 128, blue: 128 },
    outlineOccludedAlpha: 0.0,
    fillUnoccludedColor: { red: 255, green: 255, blue: 255 },
    fillUnoccludedAlpha: 0.12,
    fillOccludedColor: { red: 255, green: 255, blue: 255 },
    fillOccludedAlpha: 0.0
};

DISPATCHER_PROPERTIES = [
    "position",
    "registrationPoint",
    "rotation",
    "gravity",
    "collidesWith",
    "dynamic",
    "collisionless",
    "locked",
    "name",
    "shapeType",
    "parentID",
    "parentJointIndex",
    "density",
    "dimensions",
    "userData",
    "type",
    "href",
    "cloneable",
    "cloneDynamic",
    "localPosition",
    "localRotation"
];

// priority -- a lower priority means the module will be asked sooner than one with a higher priority in a given update step
// activitySlots -- indicates which "slots" must not yet be in use for this module to start
// requiredDataForReady -- which "situation" parts this module looks at to decide if it will start
// sleepMSBetweenRuns -- how long to wait between calls to this module's "run" method
makeDispatcherModuleParameters = function (priority, activitySlots, requiredDataForReady, sleepMSBetweenRuns, enableLaserForHand) {
    if (enableLaserForHand === undefined) {
        enableLaserForHand = -1;
    }

    return {
        priority: priority,
        activitySlots: activitySlots,
        requiredDataForReady: requiredDataForReady,
        sleepMSBetweenRuns: sleepMSBetweenRuns,
        handLaser: enableLaserForHand
    };
};

makeLaserLockInfo = function (targetID, isOverlay, hand, offset) {
    return {
        targetID: targetID,
        isOverlay: isOverlay,
        hand: hand,
        offset: offset
    };
};

makeLaserParams = function (hand, allwaysOn) {
    if (allwaysOn === undefined) {
        allwaysOn = false;
    }

    return {
        hand: hand,
        allwaysOn: allwaysOn
    };
};

makeRunningValues = function (active, targets, requiredDataForRun, laserLockInfo) {
    return {
        active: active,
        targets: targets,
        requiredDataForRun: requiredDataForRun,
        laserLockInfo: laserLockInfo
    };
};

enableDispatcherModule = function (moduleName, module, priority) {
    if (!controllerDispatcherPlugins) {
        controllerDispatcherPlugins = {};
    }
    controllerDispatcherPlugins[moduleName] = module;
    controllerDispatcherPluginsNeedSort = true;
};

disableDispatcherModule = function (moduleName) {
    delete controllerDispatcherPlugins[moduleName];
    controllerDispatcherPluginsNeedSort = true;
};

getEnabledModuleByName = function (moduleName) {
    if (controllerDispatcherPlugins.hasOwnProperty(moduleName)) {
        return controllerDispatcherPlugins[moduleName];
    }
    return null;
};

getGrabbableData = function (ggdProps) {
    // look in userData for a "grabbable" key, return the value or some defaults
    var grabbableData = {};
    var userDataParsed = null;
    try {
        if (!ggdProps.userDataParsed) {
            ggdProps.userDataParsed = JSON.parse(ggdProps.userData);
        }
        userDataParsed = ggdProps.userDataParsed;
    } catch (err) {
        userDataParsed = {};
    }
    if (userDataParsed.grabbableKey) {
        grabbableData = userDataParsed.grabbableKey;
    }
    if (!grabbableData.hasOwnProperty("grabbable")) {
        grabbableData.grabbable = true;
    }
    if (!grabbableData.hasOwnProperty("ignoreIK")) {
        grabbableData.ignoreIK = true;
    }
    if (!grabbableData.hasOwnProperty("kinematic")) {
        grabbableData.kinematic = true;
    }
    if (!grabbableData.hasOwnProperty("wantsTrigger")) {
        grabbableData.wantsTrigger = false;
    }
    if (!grabbableData.hasOwnProperty("triggerable")) {
        grabbableData.triggerable = false;
    }

    return grabbableData;
};

entityIsGrabbable = function (eigProps) {
    var grabbable = getGrabbableData(eigProps).grabbable;
    if (!grabbable ||
        eigProps.locked ||
        FORBIDDEN_GRAB_TYPES.indexOf(eigProps.type) >= 0) {
        return false;
    }
    return true;
};

clearHighlightedEntities = function () {
    Selection.clearSelectedItemsList(DISPATCHER_HOVERING_LIST);
};

highlightTargetEntity = function (entityID) {
    Selection.addToSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity", entityID);
};

unhighlightTargetEntity = function (entityID) {
    Selection.removeFromSelectedItemsList(DISPATCHER_HOVERING_LIST, "entity", entityID);
};

entityIsDistanceGrabbable = function(eidgProps) {
    if (!entityIsGrabbable(eidgProps)) {
        return false;
    }

    // we can't distance-grab non-physical
    var isPhysical = propsArePhysical(eidgProps);
    if (!isPhysical) {
        return false;
    }

    return true;
};

getControllerJointIndexCacheTime = [0, 0];
getControllerJointIndexCache = [-1, -1];

getControllerJointIndex = function (hand) {
    var GET_CONTROLLERJOINTINDEX_CACHE_REFRESH_TIME = 3000; // msecs

    var now = Date.now();
    if (now - getControllerJointIndexCacheTime[hand] > GET_CONTROLLERJOINTINDEX_CACHE_REFRESH_TIME) {
        if (HMD.isHandControllerAvailable()) {
            var controllerJointIndex = -1;
            if (Camera.mode === "first person") {
                controllerJointIndex = MyAvatar.getJointIndex(hand === RIGHT_HAND ?
                    "_CONTROLLER_RIGHTHAND" :
                    "_CONTROLLER_LEFTHAND");
            } else if (Camera.mode === "third person") {
                controllerJointIndex = MyAvatar.getJointIndex(hand === RIGHT_HAND ?
                    "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" :
                    "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND");
            }

            getControllerJointIndexCacheTime[hand] = now;
            getControllerJointIndexCache[hand] = controllerJointIndex;
            return controllerJointIndex;
        }
    } else {
        return getControllerJointIndexCache[hand];
    }

    return -1;
};

propsArePhysical = function (papProps) {
    if (!papProps.dynamic) {
        return false;
    }
    var isPhysical = (papProps.shapeType && papProps.shapeType !== 'none');
    return isPhysical;
};

projectOntoXYPlane = function (worldPos, position, rotation, dimensions, registrationPoint) {
    var invRot = Quat.inverse(rotation);
    var localPos = Vec3.multiplyQbyV(invRot, Vec3.subtract(worldPos, position));
    var invDimensions = {
        x: 1 / dimensions.x,
        y: 1 / dimensions.y,
        z: 1 / dimensions.z
    };

    var normalizedPos = Vec3.sum(Vec3.multiplyVbyV(localPos, invDimensions), registrationPoint);
    return {
        x: normalizedPos.x * dimensions.x,
        y: (1 - normalizedPos.y) * dimensions.y // flip y-axis
    };
};

projectOntoEntityXYPlane = function (entityID, worldPos, popProps) {
    return projectOntoXYPlane(worldPos, popProps.position, popProps.rotation,
                              popProps.dimensions, popProps.registrationPoint);
};

projectOntoOverlayXYPlane = function projectOntoOverlayXYPlane(overlayID, worldPos) {
    var position = Overlays.getProperty(overlayID, "position");
    var rotation = Overlays.getProperty(overlayID, "rotation");
    var dimensions = Overlays.getProperty(overlayID, "dimensions");
    dimensions.z = 0.01; // we are projecting onto the XY plane of the overlay, so ignore the z dimension

    return projectOntoXYPlane(worldPos, position, rotation, dimensions, DEFAULT_REGISTRATION_POINT);
};

entityHasActions = function (entityID) {
    return Entities.getActionIDs(entityID).length > 0;
};

ensureDynamic = function (entityID) {
    // if we distance hold something and keep it very still before releasing it, it ends up
    // non-dynamic in bullet.  If it's too still, give it a little bounce so it will fall.
    var edProps = Entities.getEntityProperties(entityID, ["velocity", "dynamic", "parentID"]);
    if (edProps.dynamic && edProps.parentID === Uuid.NULL) {
        var velocity = edProps.velocity;
        if (Vec3.length(velocity) < 0.05) { // see EntityMotionState.cpp DYNAMIC_LINEAR_VELOCITY_THRESHOLD
            velocity = { x: 0.0, y: 0.2, z: 0.0 };
            Entities.editEntity(entityID, { velocity: velocity });
        }
    }
};

findGroupParent = function (controllerData, targetProps) {
    while (targetProps.parentID &&
        targetProps.parentID !== Uuid.NULL &&
        Entities.getNestableType(targetProps.parentID) == "entity") {
        var parentProps = Entities.getEntityProperties(targetProps.parentID, DISPATCHER_PROPERTIES);
        if (!parentProps) {
            break;
        }
        parentProps.id = targetProps.parentID;
        targetProps = parentProps;
        controllerData.nearbyEntityPropertiesByID[targetProps.id] = targetProps;
    }

    return targetProps;
};

getEntityParents = function (targetProps) {
    var parentProperties = [];
    while (targetProps.parentID &&
        targetProps.parentID !== Uuid.NULL &&
        Entities.getNestableType(targetProps.parentID) == "entity") {
        var parentProps = Entities.getEntityProperties(targetProps.parentID, DISPATCHER_PROPERTIES);
        if (!parentProps) {
            break;
        }
        parentProps.id = targetProps.parentID;
        targetProps = parentProps;
        parentProperties.push(parentProps);
    }

    return parentProperties;
};


findHandChildEntities = function (hand) {
    // find children of avatar's hand joint
    var handJointIndex = MyAvatar.getJointIndex(hand === RIGHT_HAND ? "RightHand" : "LeftHand");
    var children = Entities.getChildrenIDsOfJoint(MyAvatar.sessionUUID, handJointIndex);
    children = children.concat(Entities.getChildrenIDsOfJoint(MyAvatar.SELF_ID, handJointIndex));

    // find children of faux controller joint
    var controllerJointIndex = getControllerJointIndex(hand);
    children = children.concat(Entities.getChildrenIDsOfJoint(MyAvatar.sessionUUID, controllerJointIndex));
    children = children.concat(Entities.getChildrenIDsOfJoint(MyAvatar.SELF_ID, controllerJointIndex));

    // find children of faux camera-relative controller joint
    var controllerCRJointIndex = MyAvatar.getJointIndex(hand === RIGHT_HAND ?
        "_CAMERA_RELATIVE_CONTROLLER_RIGHTHAND" :
        "_CAMERA_RELATIVE_CONTROLLER_LEFTHAND");
    children = children.concat(Entities.getChildrenIDsOfJoint(MyAvatar.sessionUUID, controllerCRJointIndex));
    children = children.concat(Entities.getChildrenIDsOfJoint(MyAvatar.SELF_ID, controllerCRJointIndex));

    return children.filter(function (childID) {
        var childType = Entities.getNestableType(childID);
        return childType == "entity";
    });
};

distanceBetweenEntityLocalPositionAndBoundingBox = function (entityProps, jointGrabOffset) {
    var DEFAULT_REGISTRATION_POINT = { x: 0.5, y: 0.5, z: 0.5 };
    var rotInv = Quat.inverse(entityProps.localRotation);
    var localPosition = Vec3.sum(entityProps.localPosition, jointGrabOffset);
    var localPoint = Vec3.multiplyQbyV(rotInv, Vec3.multiply(localPosition, -1.0));

    var halfDims = Vec3.multiply(entityProps.dimensions, 0.5);
    var regRatio = Vec3.subtract(DEFAULT_REGISTRATION_POINT, entityProps.registrationPoint);
    var entityCenter = Vec3.multiplyVbyV(regRatio, entityProps.dimensions);
    var localMin = Vec3.subtract(entityCenter, halfDims);
    var localMax = Vec3.sum(entityCenter, halfDims);


    var v = { x: localPoint.x, y: localPoint.y, z: localPoint.z };
    v.x = Math.max(v.x, localMin.x);
    v.x = Math.min(v.x, localMax.x);
    v.y = Math.max(v.y, localMin.y);
    v.y = Math.min(v.y, localMax.y);
    v.z = Math.max(v.z, localMin.z);
    v.z = Math.min(v.z, localMax.z);

    return Vec3.distance(v, localPoint);
};

distanceBetweenPointAndEntityBoundingBox = function (point, entityProps) {
    var entityXform = new Xform(entityProps.rotation, entityProps.position);
    var localPoint = entityXform.inv().xformPoint(point);
    var minOffset = Vec3.multiplyVbyV(entityProps.registrationPoint, entityProps.dimensions);
    var maxOffset = Vec3.multiplyVbyV(Vec3.subtract(ONE_VEC, entityProps.registrationPoint), entityProps.dimensions);
    var localMin = Vec3.subtract(entityXform.trans, minOffset);
    var localMax = Vec3.sum(entityXform.trans, maxOffset);

    var v = { x: localPoint.x, y: localPoint.y, z: localPoint.z };
    v.x = Math.max(v.x, localMin.x);
    v.x = Math.min(v.x, localMax.x);
    v.y = Math.max(v.y, localMin.y);
    v.y = Math.min(v.y, localMax.y);
    v.z = Math.max(v.z, localMin.z);
    v.z = Math.min(v.z, localMax.z);

    return Vec3.distance(v, localPoint);
};

entityIsEquipped = function (entityID) {
    var rightEquipEntity = getEnabledModuleByName("RightEquipEntity");
    var leftEquipEntity = getEnabledModuleByName("LeftEquipEntity");
    var equippedInRightHand = rightEquipEntity ? rightEquipEntity.targetEntityID === entityID : false;
    var equippedInLeftHand = leftEquipEntity ? leftEquipEntity.targetEntityID === entityID : false;
    return equippedInRightHand || equippedInLeftHand;
};

entityIsFarGrabbedByOther = function (entityID) {
    // by convention, a far grab sets the tag of its action to be far-grab-*owner-session-id*.
    var actionIDs = Entities.getActionIDs(entityID);
    var myFarGrabTag = "far-grab-" + MyAvatar.sessionUUID;
    for (var actionIndex = 0; actionIndex < actionIDs.length; actionIndex++) {
        var actionID = actionIDs[actionIndex];
        var actionArguments = Entities.getActionArguments(entityID, actionID);
        var tag = actionArguments.tag;
        if (tag == myFarGrabTag) {
            // we see a far-grab-*uuid* shaped tag, but it's our tag, so that's okay.
            continue;
        }
        if (tag.slice(0, 9) == "far-grab-") {
            // we see a far-grab-*uuid* shaped tag and it's not ours, so someone else is grabbing it.
            return true;
        }
    }
    return false;
};

vecInDirWithMagOf = function (u, v) {
    // Returns a vector in the direction of u with the magnitude of v
    var length = Vec3.length(v);
    var dir = Vec3.normalize(u);
    return Vec3.multiply(length, dir);
}

lerp = function (start, end, t) {
    if (t === 0) { t = SMALL_NUMBER; }
    return Vec3.sum(Vec3.multiply(t, end), Vec3.multiply((1 - t), start));
}

normalizeRange = function (min, max, val) {
    return (val - min) / (max - min);
}

toDegrees = function (angle) {
    return angle * (180 / Math.PI);
}

toRadians = function (angle) {
    return angle * (Math.PI / 180);
}

// Came from controller_experiment2, used here for controlling whether we're checking teleport or fargrab.
controllerTwistAngle = function (hand) {
    // Retrieve the hand's pose.
    var handPose = Controller.getPoseValue(hand === LEFT_HAND ? Controller.Standard.LeftHand : Controller.Standard.RightHand);
    // Get the rotation of the controller for the given hand.
    var handRotationQuat = handPose.rotation;
    // Get it into avatar space.
    var handRotationVector = Vec3.multiplyQbyV(handRotationQuat, Vec3.UNIT_X);

    // Figure out the plane we're testing against...

    // Multiply up vector by avatar rotation.
    var v1 = Vec3.multiplyQbyV(MyAvatar.rotation, Vec3.UNIT_Z);
    var v2 = Vec3.multiplyQbyV(MyAvatar.rotation, Vec3.UNIT_Y);
    var normal = Vec3.cross(v1, v2);
    // Take the cosine inverse of the dot product to retrieve theta (angle, returned in degrees).
    return toDegrees(Math.acos(Vec3.dot(Vec3.normalize(handRotationVector), Vec3.normalize(normal))));
}

projectVontoW = function (v, w) {
    // Project vector v onto vector w
    var denominator = Vec3.length(w);
    // Denominator should be mag(w)^2
    denominator *= denominator;
    return Vec3.multiply((Vec3.dot(v, w) / denominator), w);
}

projectToHorizontal = function (u) {
    var n = Vec3.multiplyQbyV(MyAvatar.rotation, Vec3.UNIT_Y);  // Get the avatar's notion of "up" in worldspace.
    var proj = projectVontoW(u, n);
    return Vec3.subtract(u, proj);
}

cancelPitchAndYaw = function (q) {
    var eulerAngles = Quat.safeEulerAngles(q);
    eulerAngles.x = 0;             // Cancel pitch
    eulerAngles.y = 0;             // Cancel yaw
    return Quat.fromVec3Degrees(eulerAngles);
}

cancelYawAndRoll = function (q) {
    var eulerAngles = Quat.safeEulerAngles(q);
    eulerAngles.y = 0;            // Cancel Yaw.
    eulerAngles.z = 0;            // Cancel roll.
    return Quat.fromVec3Degrees(eulerAngles);
}

cancelPitchAndRoll = function (q) {
    var eulerAngles = Quat.safeEulerAngles(q);
    eulerAngles.x = 0;            // Cancel pitch.
    eulerAngles.z = 0;            // Cancel roll.
    return Quat.fromVec3Degrees(eulerAngles);
}

INVALID_RADIAL_ANGLE = 9000;

getRadialAngleFromAvatar = function (hand) {
    var pose = Controller.getPoseValue(hand === RIGHT_HAND ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
    if (!pose.valid) {
        return 0;
    }
    var normal = Vec3.multiplyQbyV(MyAvatar.orientation, Vec3.UNIT_Y);                      // This will be the normal to the user's horizontal plane, regardless of gravity.
    var projectedVec = Vec3.subtract(pose.translation, projectVontoW(pose.translation, normal));

    var angle = toDegrees(Vec3.getAngle(projectedVec, Vec3.multiply(-1, Vec3.UNIT_Z)));     // Angle we care about.
    var angle2 = toDegrees(Vec3.getAngle(projectedVec, Vec3.multiply(-1, Vec3.UNIT_X)));                       // Reference vector used to figure out the sign of the angle.
    if (angle2 <= 90) {
        angle *= -1;
    }
    return angle;
}

getRadialAngleDeltaFromAvatar = function (hand, lastPos) {
    var pose = Controller.getPoseValue(hand === RIGHT_HAND ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
    if (!pose.valid || Vec3.withinEpsilon(lastPos, pose.translation, 0.005)) {
        return 0;
    }
    var normal = Vec3.multiplyQbyV(MyAvatar.orientation, Vec3.UNIT_Y);                      // This will be the normal to the user's horizontal plane, regardless of gravity.
    var projectedVec = Vec3.subtract(pose.translation, projectVontoW(pose.translation, normal));

    var projectedLastVec = Vec3.subtract(lastPos, projectVontoW(lastPos, normal));

    var refRot = Quat.angleAxis(-90, normal);
    var refVec = Vec3.multiplyQbyV(refRot, projectedLastVec);

    var angle = toDegrees(Vec3.getAngle(projectedVec, projectedLastVec));     // Angle we care about.
    var angle2 = toDegrees(Vec3.getAngle(projectedVec, refVec));                       // Reference vector used to figure out the sign of the angle.
    if (angle2 <= 90) {
        angle *= -1;
    }
    return angle;
}

getAngleFromGround = function (hand) {
    var pose = Controller.getPoseValue(hand === RIGHT_HAND ? Controller.Standard.RightHand : Controller.Standard.LeftHand);
    if (!pose.valid) {
        return 0;
    }
    var ctrlrForward = Vec3.multiplyQbyV(pose.rotation, Vec3.UNIT_Y);
    var up = Vec3.multiplyQbyV(MyAvatar.orientation, Vec3.multiply(-1, Vec3.UNIT_Y));
    var angle = toDegrees(Vec3.getAngle(ctrlrForward, up));
    return angle;
}

if (typeof module !== 'undefined') {
    module.exports = {
        makeDispatcherModuleParameters: makeDispatcherModuleParameters,
        enableDispatcherModule: enableDispatcherModule,
        disableDispatcherModule: disableDispatcherModule,
        highlightTargetEntity: highlightTargetEntity,
        unhighlightTargetEntity: unhighlightTargetEntity,
        clearHighlightedEntities: clearHighlightedEntities,
        makeRunningValues: makeRunningValues,
        findGroupParent: findGroupParent,
        LEFT_HAND: LEFT_HAND,
        RIGHT_HAND: RIGHT_HAND,
        BUMPER_ON_VALUE: BUMPER_ON_VALUE,
        TEAR_AWAY_DISTANCE: TEAR_AWAY_DISTANCE,
        propsArePhysical: propsArePhysical,
        entityIsGrabbable: entityIsGrabbable,
        NEAR_GRAB_RADIUS: NEAR_GRAB_RADIUS,
        projectOntoOverlayXYPlane: projectOntoOverlayXYPlane,
        projectOntoEntityXYPlane: projectOntoEntityXYPlane,
        TRIGGER_OFF_VALUE: TRIGGER_OFF_VALUE,
        TRIGGER_ON_VALUE: TRIGGER_ON_VALUE,
        DISPATCHER_HOVERING_LIST: DISPATCHER_HOVERING_LIST
    };
}
