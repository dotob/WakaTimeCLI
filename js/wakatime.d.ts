export declare class WakaTimeCLI {
    apiString: string;
    homedir: any;
    wakafile: string;
    apiUrl: string;
    readApiKey(): any;
    setApiKey(apiKey: any): void;
    fileError(): void;
    dateInfo(): {
        day: string;
        yesterday: string;
        week: string;
        month: string;
        year: string;
    };
    formatTime(seconds: any): string;
    printSection(obj: any, color: any): void;
    doRequest(action: any): Promise<any>;
    user(): Promise<void>;
    detailsDay(day: string, dayText: string): Promise<void>;
    detailsRange(from: string, dayText: string, to: string): Promise<void>;
}
