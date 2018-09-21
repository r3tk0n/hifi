//
//  waitingToFly.js
//
//  Created by David Rowe on 21 Sep 2018.
//  Copyright 2018 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

(function () {

    var overlay,
        LOCAL_POSITION = { x: 0, y: 0.01, z: 0 },
        LOCAL_ROTATION = Quat.fromVec3Degrees({ x: 90, y: 180, z: 0 }),
        INNER_RADIUS = 0.05,
        OUTER_RADIUS = 0.06,
        FULL_CIRCLE = 360,
        HIDE_DELAY = 200,
        visible = false;

    function onWaitingToFly(fraction) {
        var properties;

        if (fraction > 0) {
            if (!visible) {
                properties = {
                    innerRadius: MyAvatar.scale * INNER_RADIUS,
                    outerRadius: MyAvatar.scale * OUTER_RADIUS,
                    parentID: MyAvatar.SELF_ID,
                    parentJointIndex: MyAvatar.getJointIndex("LeftHand"),
                    localPosition: Vec3.multiply(MyAvatar.scale, LOCAL_POSITION),
                    localRotation: LOCAL_ROTATION,
                    endAt: fraction * FULL_CIRCLE,
                    visible: true
                };
                visible = true;
            } else {
                properties = {
                    endAt: fraction * FULL_CIRCLE
                };
            }
            Overlays.editOverlay(overlay, properties);
        } else {
            if (visible) {
                // Leave completed circle displayed for a short time while the take-off completes.
                Overlays.editOverlay(overlay, {
                    endAt: FULL_CIRCLE
                });
                Script.setTimeout(function () {
                    Overlays.editOverlay(overlay, {
                        visible: false
                    });
                }, HIDE_DELAY);
                visible = false;
            }
        }
    }

    function setUp() {
        overlay = Overlays.addOverlay("circle3d", {
            solid: true,
            color: { red: 0, green: 180, blue: 239 },
            alpha: 0.8,
            ignorePickIntersection: true,
            visible: false
        });
        MyAvatar.waitingToFly.connect(onWaitingToFly);
    }

    function tearDown() {
        MyAvatar.waitingToFly.disconnect(onWaitingToFly);
        Overlays.deleteOverlay(overlay);
    }

    setUp();
    Script.scriptEnding.connect(tearDown);

}());
