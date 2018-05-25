//
//  ViewTask.h
//  libraries/workload/src/workload
//
//  Created by Sam Gateau 2018.03.05
//  Copyright 2018 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
#ifndef hifi_workload_ViewTask_h
#define hifi_workload_ViewTask_h

#include "Engine.h"

template <typename T>
QVariantList toVariantList(const QList<T> &list)
{
    QVariantList newList;
    foreach(const T &item, list)
        newList << item;

    return newList;
}

namespace workload {
    const glm::vec2 DEFAULT_R1_BACK_FRONT = { 50.0f, 100.0f };
    const glm::vec2 DEFAULT_R2_BACK_FRONT = { 75.0f, 150.0f };
    const glm::vec2 DEFAULT_R3_BACK_FRONT = { 100.0f, 250.0f };

    class SetupViewsConfig : public Job::Config{
        Q_OBJECT
        Q_PROPERTY(float r1Front READ getR1Front WRITE setR1Front NOTIFY dirty)
        Q_PROPERTY(float r1Back READ getR1Back WRITE setR1Back NOTIFY dirty)
        Q_PROPERTY(float r2Front READ getR2Front WRITE setR2Front NOTIFY dirty)
        Q_PROPERTY(float r2Back READ getR2Back WRITE setR2Back NOTIFY dirty)
        Q_PROPERTY(float r3Front READ getR3Front WRITE setR3Front NOTIFY dirty)
        Q_PROPERTY(float r3Back READ getR3Back WRITE setR3Back NOTIFY dirty)
        Q_PROPERTY(bool freezeViews READ getFreezeView WRITE setFreezeView NOTIFY dirty)
        Q_PROPERTY(bool useAvatarView READ useAvatarView WRITE setUseAvatarView NOTIFY dirty)
        Q_PROPERTY(bool forceViewHorizontal READ forceViewHorizontal WRITE setForceViewHorizontal NOTIFY dirty)

        Q_PROPERTY(bool simulateSecondaryCamera READ simulateSecondaryCamera WRITE setSimulateSecondaryCamera NOTIFY dirty)

    public:


        float getR1Front() const { return data.r1Front; }
        float getR1Back() const { return data.r1Back; }
        float getR2Front() const { return data.r2Front; }
        float getR2Back() const { return data.r2Back; }
        float getR3Front() const { return data.r3Front; }
        float getR3Back() const { return data.r3Back; }

        void setR1Front(float d) { data.r1Front = d; emit dirty(); }
        void setR1Back(float d) { data.r1Back = d; emit dirty(); }
        void setR2Front(float d) { data.r2Front = d; emit dirty(); }
        void setR2Back(float d) { data.r2Back = d; emit dirty(); }
        void setR3Front(float d) { data.r3Front = d; emit dirty(); }
        void setR3Back(float d) { data.r3Back = d; emit dirty(); }

        bool getFreezeView() const { return data.freezeViews; }
        void setFreezeView(bool freeze) { data.freezeViews = freeze; emit dirty(); }
        bool useAvatarView() const { return data.useAvatarView; }
        void setUseAvatarView(bool use) { data.useAvatarView = use; emit dirty(); }
        bool forceViewHorizontal() const { return data.forceViewHorizontal; }
        void setForceViewHorizontal(bool use) { data.forceViewHorizontal = use; emit dirty(); }

        bool simulateSecondaryCamera() const { return data.simulateSecondaryCamera; }
        void setSimulateSecondaryCamera(bool use) { data.simulateSecondaryCamera = use; emit dirty(); }

        struct Data {
            float r1Back { DEFAULT_R1_BACK_FRONT.x };
            float r1Front { DEFAULT_R1_BACK_FRONT.y };

            float r2Back{ DEFAULT_R2_BACK_FRONT.x };
            float r2Front{ DEFAULT_R2_BACK_FRONT.y };

            float r3Back{ DEFAULT_R3_BACK_FRONT.x };
            float r3Front{ DEFAULT_R3_BACK_FRONT.y };

            bool freezeViews{ false };
            bool useAvatarView{ false };
            bool forceViewHorizontal{ false };
            bool simulateSecondaryCamera{ false };
        } data;

    signals:
        void dirty();
    };

    class SetupViews {
    public:
        using Config = SetupViewsConfig;
        using Input = Views;
        using Output = Views;
        using JobModel = Job::ModelIO<SetupViews, Input, Output, Config>;

        void configure(const Config& config);
        void run(const workload::WorkloadContextPointer& renderContext, const Input& inputs, Output& outputs);

    protected:
        Config::Data data;
        Views _views;
    };

    class AssignSpaceViews {
    public:
        using Input = Views;
        using JobModel = Job::ModelI<AssignSpaceViews, Input>;

        void run(const workload::WorkloadContextPointer& renderContext, const Input& inputs);
    };


    class ControlViewsConfig : public workload::Job::Config {
        Q_OBJECT
        Q_PROPERTY(bool regulateViewRanges READ regulateViewRanges WRITE setRegulateViewRanges NOTIFY dirty)


        Q_PROPERTY(float r1Timing READ r1Timing NOTIFY dirty)
        Q_PROPERTY(float r2Timing READ r2Timing NOTIFY dirty)
        Q_PROPERTY(float r3Timing READ r3Timing NOTIFY dirty)

        Q_PROPERTY(float r1RangeBack READ r1RangeBack NOTIFY dirty)
        Q_PROPERTY(float r2RangeBack READ r2RangeBack NOTIFY dirty)
        Q_PROPERTY(float r3RangeBack READ r3RangeBack NOTIFY dirty)

        Q_PROPERTY(float r1RangeFront READ r1RangeFront NOTIFY dirty)
        Q_PROPERTY(float r2RangeFront READ r2RangeFront NOTIFY dirty)
        Q_PROPERTY(float r3RangeFront READ r3RangeFront NOTIFY dirty)
        /*
        Q_PROPERTY(float r1MinRangeBack READ r1MinRangeBack WRITE setR1MinRangeBack NOTIFY dirty)
        Q_PROPERTY(float r2MinRangeBack READ r2MinRangeBack WRITE setR2MinRangeBack NOTIFY dirty)
        Q_PROPERTY(float r3MinRangeBack READ r3MinRangeBack WRITE setR3MinRangeBack NOTIFY dirty)

        Q_PROPERTY(float r1MinRangeFront READ r1MinRangeFront WRITE setR1MinRangeFront NOTIFY dirty)
        Q_PROPERTY(float r2MinRangeFront READ r2MinRangeFront WRITE setR2MinRangeFront NOTIFY dirty)
        Q_PROPERTY(float r3MinRangeFront READ r3MinRangeFront WRITE setR3MinRangeFront NOTIFY dirty)

        Q_PROPERTY(float r1MaxRangeBack READ r1MaxRangeBack WRITE setR1MaxRangeBack NOTIFY dirty)
        Q_PROPERTY(float r2MaxRangeBack READ r2MaxRangeBack WRITE setR2MaxRangeBack NOTIFY dirty)
        Q_PROPERTY(float r3MaxRangeBack READ r3MaxRangeBack WRITE setR3MaxRangeBack NOTIFY dirty)

        Q_PROPERTY(float r1MaxRangeFront READ r1MaxRangeFront WRITE setR1MaxRangeFront NOTIFY dirty)
        Q_PROPERTY(float r2MaxRangeFront READ r2MaxRangeFront WRITE setR2MaxRangeFront NOTIFY dirty)
        Q_PROPERTY(float r3MaxRangeFront READ r3MaxRangeFront WRITE setR3MaxRangeFront NOTIFY dirty)

        Q_PROPERTY(float r1SpeedDownBack READ r1SpeedDownBack WRITE setR1SpeedDownBack NOTIFY dirty)
        Q_PROPERTY(float r2SpeedDownBack READ r2SpeedDownBack WRITE setR2SpeedDownBack NOTIFY dirty)
        Q_PROPERTY(float r3SpeedDownBack READ r3SpeedDownBack WRITE setR3SpeedDownBack NOTIFY dirty)

        Q_PROPERTY(float r1SpeedDownFront READ r1SpeedDownFront WRITE setR1SpeedDownFront NOTIFY dirty)
        Q_PROPERTY(float r2SpeedDownFront READ r2SpeedDownFront WRITE setR2SpeedDownFront NOTIFY dirty)
        Q_PROPERTY(float r3SpeedDownFront READ r3SpeedDownFront WRITE setR3SpeedDownFront NOTIFY dirty)

        Q_PROPERTY(float r1SpeedUpBack READ r1SpeedUpBack WRITE setR1SpeedUpBack NOTIFY dirty)
        Q_PROPERTY(float r2SpeedUpBack READ r2SpeedUpBack WRITE setR2SpeedUpBack NOTIFY dirty)
        Q_PROPERTY(float r3SpeedUpBack READ r3SpeedUpBack WRITE setR3SpeedUpBack NOTIFY dirty)

        Q_PROPERTY(float r1SpeedUpFront READ r1SpeedUpFront WRITE setR1SpeedUpFront NOTIFY dirty)
        Q_PROPERTY(float r2SpeedUpFront READ r2SpeedUpFront WRITE setR2SpeedUpFront NOTIFY dirty)
        Q_PROPERTY(float r3SpeedUpFront READ r3SpeedUpFront WRITE setR3SpeedUpFront NOTIFY dirty)*/

    public:

        bool regulateViewRanges() const { return data.regulateViewRanges; }
        void setRegulateViewRanges(bool use) { data.regulateViewRanges = use; emit dirty(); }

        float r1Timing() const { return dataExport.timings[workload::Region::R1]; }
        float r2Timing() const { return dataExport.timings[workload::Region::R2]; }
        float r3Timing() const { return dataExport.timings[workload::Region::R3]; }

        float r1RangeBack() const { return dataExport.ranges[workload::Region::R1].x; }
        float r2RangeBack() const { return dataExport.ranges[workload::Region::R2].x; }
        float r3RangeBack() const { return dataExport.ranges[workload::Region::R3].x; }

        float r1RangeFront() const { return dataExport.ranges[workload::Region::R1].y; }
        float r2RangeFront() const { return dataExport.ranges[workload::Region::R2].y; }
        float r3RangeFront() const { return dataExport.ranges[workload::Region::R3].y; }


        struct Data {
            bool regulateViewRanges{ true };
        } data;

        struct DataExport {
            static const int SIZE{ workload::Region::NUM_VIEW_REGIONS };
            float timings[SIZE];
            glm::vec2 ranges[SIZE];
            QList<qreal> _timings { 6, 2.0 };

        } dataExport;

        void emitDirty() { emit dirty(); }

    public slots:
        Q_INVOKABLE QVariantList getTimings() const { return  toVariantList(dataExport._timings); }
    signals:
        void dirty();
    };

    struct Regulator {
        using Timing_ns = std::chrono::nanoseconds;
        Timing_ns _budget{ std::chrono::milliseconds(2) };
        glm::vec2 _minRange{ 2.0f, 5.0f };
        glm::vec2 _maxRange{ 50.0f, 100.0f };

        glm::vec2 _speedDown{ 0.2f };
        glm::vec2 _speedUp{ 0.1f };


        Regulator() {}
        Regulator(const Timing_ns& budget_ns, const glm::vec2& minRange, const glm::vec2& maxRange, const glm::vec2& speedDown, const glm::vec2& speedUp) :
            _budget(budget_ns), _minRange(minRange), _maxRange(maxRange), _speedDown(speedDown), _speedUp(speedUp) {}

        glm::vec2 run(const Timing_ns& regulationDuration, const Timing_ns& measured, const glm::vec2& current);
        glm::vec2 clamp(const glm::vec2& backFront) const;
    };

    class ControlViews {
    public:
        using Config = ControlViewsConfig;
        using Input = workload::VaryingSet2<workload::Views, workload::Timings>;
        using Output = workload::Views;
        using JobModel = workload::Job::ModelIO<ControlViews, Input, Output, Config>;

        ControlViews();

        void configure(const Config& config);
        void run(const workload::WorkloadContextPointer& runContext, const Input& inputs, Output& outputs);

        std::array<glm::vec2, workload::Region::NUM_VIEW_REGIONS> regionBackFronts;
        std::array<Regulator, workload::Region::NUM_VIEW_REGIONS> regionRegulators;

        void regulateViews(workload::Views& views, const workload::Timings& timings);

    protected:
        Config::Data _data;
        Config::DataExport _dataExport;
    };

} // namespace workload

#endif // hifi_workload_ViewTask_h