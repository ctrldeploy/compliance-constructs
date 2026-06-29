import type { BasicAlarm } from './basic-alarm.construct';

export interface Alarmable {
    alarms: BasicAlarm[];

    getCriticalAlarms(): BasicAlarm[];

    addAlarm(alarm: BasicAlarm): void;
}
