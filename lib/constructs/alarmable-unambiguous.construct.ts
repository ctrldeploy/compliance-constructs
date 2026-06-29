import type { Alarmable } from './alarmable.construct';
import type { BasicAlarm } from './basic-alarm.construct';
import { UnambiguousConstruct } from './unambiguous.construct';

export class AlarmableUnambiguousConstruct extends UnambiguousConstruct implements Alarmable {
    public readonly alarms: BasicAlarm[] = [];

    getCriticalAlarms(): BasicAlarm[] {
        return this.alarms.filter((alarm) => alarm.isCritical);
    }

    addAlarm(alarm: BasicAlarm): void {
        this.alarms.push(alarm);
    }
}
