//
//  Created by Sam Gondelman 10/20/2017
//  Copyright 2017 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include "PointerScriptingInterface.h"

#include <QtCore/QVariant>
#include <GLMHelpers.h>

#include "Application.h"
#include "LaserPointer.h"

void PointerScriptingInterface::setIgnoreItems(const QUuid& uid, const QScriptValue& ignoreItems) const {
    DependencyManager::get<PointerManager>()->setIgnoreItems(uid, qVectorQUuidFromScriptValue(ignoreItems));
}
void PointerScriptingInterface::setIncludeItems(const QUuid& uid, const QScriptValue& includeItems) const {
    DependencyManager::get<PointerManager>()->setIncludeItems(uid, qVectorQUuidFromScriptValue(includeItems));
}

QUuid PointerScriptingInterface::createPointer(const PickQuery::PickType& type, const QVariant& properties) const {
    switch (type) {
        case PickQuery::PickType::Ray:
            return createLaserPointer(properties);
        default:
            return QUuid();
    }
}

QUuid PointerScriptingInterface::createLaserPointer(const QVariant& properties) const {
    QVariantMap propertyMap = properties.toMap();

    bool faceAvatar = false;
    if (propertyMap["faceAvatar"].isValid()) {
        faceAvatar = propertyMap["faceAvatar"].toBool();
    }

    bool centerEndY = true;
    if (propertyMap["centerEndY"].isValid()) {
        centerEndY = propertyMap["centerEndY"].toBool();
    }

    bool lockEnd = false;
    if (propertyMap["lockEnd"].isValid()) {
        lockEnd = propertyMap["lockEnd"].toBool();
    }

    bool distanceScaleEnd = false;
    if (propertyMap["distanceScaleEnd"].isValid()) {
        distanceScaleEnd = propertyMap["distanceScaleEnd"].toBool();
    }

    bool enabled = false;
    if (propertyMap["enabled"].isValid()) {
        enabled = propertyMap["enabled"].toBool();
    }

    LaserPointer::RenderStateMap renderStates;
    if (propertyMap["renderStates"].isValid()) {
        QList<QVariant> renderStateVariants = propertyMap["renderStates"].toList();
        for (const QVariant& renderStateVariant : renderStateVariants) {
            if (renderStateVariant.isValid()) {
                QVariantMap renderStateMap = renderStateVariant.toMap();
                if (renderStateMap["name"].isValid()) {
                    std::string name = renderStateMap["name"].toString().toStdString();
                    renderStates[name] = LaserPointer::buildRenderState(renderStateMap);
                }
            }
        }
    }

    LaserPointer::DefaultRenderStateMap defaultRenderStates;
    if (propertyMap["defaultRenderStates"].isValid()) {
        QList<QVariant> renderStateVariants = propertyMap["defaultRenderStates"].toList();
        for (const QVariant& renderStateVariant : renderStateVariants) {
            if (renderStateVariant.isValid()) {
                QVariantMap renderStateMap = renderStateVariant.toMap();
                if (renderStateMap["name"].isValid() && renderStateMap["distance"].isValid()) {
                    std::string name = renderStateMap["name"].toString().toStdString();
                    float distance = renderStateMap["distance"].toFloat();
                    defaultRenderStates[name] = std::pair<float, RenderState>(distance, LaserPointer::buildRenderState(renderStateMap));
                }
            }
        }
    }

    PointerTriggers triggers;
    auto userInputMapper = DependencyManager::get<UserInputMapper>();
    if (propertyMap["triggers"].isValid()) {
        QList<QVariant> triggerVariants = propertyMap["triggers"].toList();
        for (const QVariant& triggerVariant : triggerVariants) {
            if (triggerVariant.isValid()) {
                QVariantMap triggerMap = triggerVariant.toMap();
                if (triggerMap["action"].isValid() && triggerMap["button"].isValid()) {
                    controller::Endpoint::Pointer endpoint = userInputMapper->endpointFor(controller::Input(triggerMap["action"].toUInt()));
                    if (endpoint) {
                        std::string button = triggerMap["button"].toString().toStdString();
                        triggers.emplace_back(endpoint, button);
                    }
                }
            }
        }
    }

    return DependencyManager::get<PointerManager>()->addPointer(std::make_shared<LaserPointer>(properties, renderStates, defaultRenderStates, triggers,
                                                                                               faceAvatar, centerEndY, lockEnd, distanceScaleEnd, enabled));
}

void PointerScriptingInterface::editRenderState(const QUuid& uid, const QString& renderState, const QVariant& properties) const {
    QVariantMap propMap = properties.toMap();

    QVariant startProps;
    if (propMap["start"].isValid()) {
        startProps = propMap["start"];
    }

    QVariant pathProps;
    if (propMap["path"].isValid()) {
        pathProps = propMap["path"];
    }

    QVariant endProps;
    if (propMap["end"].isValid()) {
        endProps = propMap["end"];
    }

    DependencyManager::get<PointerManager>()->editRenderState(uid, renderState.toStdString(), startProps, pathProps, endProps);
}