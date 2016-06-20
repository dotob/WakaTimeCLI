"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const fs = require('fs');
const moment = require('moment');
const request = require('request');
const chalk = require('chalk');
const cmd = require('commander');
class WakaTimeCLI {
    constructor() {
        this.apiString = '&api_key=';
        this.homedir = process.env.HOME;
        this.wakafile = this.homedir + '/.wakafile';
        this.apiUrl = "https://wakatime.com/api/v1";
    }
    // Reads API Key from app directory
    readApiKey() {
        var key;
        try {
            key = fs.readFileSync(this.wakafile, 'utf8');
        }
        catch (e) {
            this.fileError();
        }
        if (key === '') {
            this.fileError();
        }
        return key;
    }
    // Stores API Key in app directory'
    setApiKey(apiKey) {
        fs.writeFile(this.wakafile, apiKey, function (err) {
            if (err)
                throw err;
            console.log('API key saved.');
        });
    }
    ;
    // Throw file error
    fileError() {
        console.log(' ');
        console.log(chalk.red(' No API Key provided'));
        console.log(chalk.red(" Example: ") + chalk.magenta("wakatime -api 'your key here' "));
        console.log(chalk.red(' Note: ') + chalk.magenta("your api key is available @ https://wakatime.com/settings"));
        console.log(' ');
        process.exit(0);
    }
    ;
    // Date function used to format date on API request
    dateInfo() {
        let df = "YYYY-MM-DD";
        return {
            day: moment().format(df),
            yesterday: moment().subtract(1, 'days').format(df),
            week: moment().subtract(6, 'days').format(df),
            month: moment().subtract(29, 'days').format(df),
            year: moment().subtract(364, 'days').format(df)
        };
    }
    ;
    formatTime(seconds) {
        return moment.duration(seconds, "s").humanize();
    }
    // Prints provided obj to terminal with chalk.magenta or blue color
    printSection(obj, color) {
        console.dir(obj);
        // sort it first
        let sortable = [];
        for (let key in obj) {
            sortable.push([key, obj[key]]);
        }
        let sorted = sortable.sort(function (a, b) { return b[1] - a[1]; });
        for (var i = 0; i < sorted.length; i++) {
            if (color === 'chalk.magenta') {
                console.log(chalk.magenta(' ' + sorted[i][0] + ': ') + this.formatTime(sorted[i][1]));
            }
            else if (color === 'blue') {
                console.log(chalk.blue(' ' + sorted[i][0] + ': ') + this.formatTime(sorted[i][1]));
            }
        }
    }
    ;
    doRequest(action) {
        return new Promise((resolve, reject) => {
            try {
                var apiKey = this.readApiKey();
                let url = `${this.apiUrl}/${action}${this.apiString}${apiKey}`;
                request(url, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var body = JSON.parse(body);
                        resolve(body);
                    }
                    else {
                        console.error(`request error for ${url}, status:${response.statusCode}, msg:${response.statusMessage}`, error);
                        reject(error);
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    // Prints user data to the terminal
    user() {
        return __awaiter(this, void 0, Promise, function* () {
            let body = yield this.doRequest("users/current");
            console.log('');
            console.log(chalk.cyan('WakaTime Account Details:'));
            console.log(chalk.magenta('  Account Created: ') + body.data.created_at);
            console.log(chalk.magenta('  Email: ') + body.data.email);
            if (body.data.full_name > '') {
                console.log(chalk.magenta('  Full Name: ') + body.data.full_name);
            }
            console.log('');
        });
    }
    // Parse data for Today or Yesterday option & prints to terminal
    detailsDay(day, dayText) {
        return __awaiter(this, void 0, Promise, function* () {
            let body = yield this.doRequest(`users/current/summaries?start=${day}&end=${day}`);
            console.log(' '); // Empty Line for formatting
            console.log(' ' + chalk.cyan(dayText + ': ') + body.data[0].grand_total.text + ' (Total)'); // Prints provided total hours/minutes
            console.log(' '); // Empty Line for formatting
            body.data[0].languages.forEach((val) => {
                console.log(chalk.magenta(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
            });
            console.log(' '); // Empty Line for formatting
            body.data[0].projects.forEach((val) => {
                console.log(chalk.blue(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
            });
            console.log(' '); // Empty Line for formatting
        });
    }
    ;
    // Parse data for last seven days of work and print to console
    detailsRange(from, dayText, to) {
        return __awaiter(this, void 0, Promise, function* () {
            let body = yield this.doRequest(`users/current/summaries?start=${from}&end=${to}`);
            var gtHours = 0;
            var gtMinutes = 0;
            var languages = {};
            var projects = {};
            // Iterates through returned object and adds all hours
            body.data.forEach((val) => {
                gtHours = gtHours + val.grand_total.hours;
                gtMinutes = gtMinutes + val.grand_total.minutes;
            });
            // Converts minutes to hours and adds to total
            if (gtMinutes > 59) {
                var gtHours = gtHours + Math.floor(gtMinutes / 60);
                var gtMinutes = gtMinutes % 60;
            }
            // Iterates through returned object and finds all unique language names
            // Adds all corresponding time to each language
            body.data.forEach((val) => {
                val.languages.forEach((val) => {
                    if (!(val.name in languages)) {
                        languages[val.name] = val.total_seconds;
                    }
                    else {
                        languages[val.name] = languages[val.name] + val.total_seconds;
                    }
                });
            });
            // Iterates through returned object and finds all unique project names
            // Adds all corresponding time to each project
            body.data.forEach((val) => {
                val.projects.forEach((val) => {
                    var time = [val.hours, val.minutes];
                    if (!(val.name in projects)) {
                        projects[val.name] = val.total_seconds;
                    }
                    else {
                        projects[val.name] = projects[val.name] + val.total_seconds;
                    }
                });
            });
            // Week Data logged to terminal here
            console.log(' '); // Empty Line for formatting
            console.log(' ' + chalk.cyan(dayText + ': ') + gtHours + ' hours ' + gtMinutes + ' minutes (Total)'); // Prints calculated total hours/minutes
            console.log(' '); // Empty Line for formatting
            this.printSection(languages, 'magenta'); // Prints each item in the obj
            console.log(' '); // Empty Line for formatting
            this.printSection(projects, 'blue'); // Prints each item in the obj
            console.log(' '); // Empty Line for formatting
        });
    }
}
exports.WakaTimeCLI = WakaTimeCLI;
cmd.version('0.0.1');
let gotCommand = false;
let w = new WakaTimeCLI();
cmd.command('today')
    .alias("t")
    .description('show todays data')
    .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsDay(day.day, "Today");
});
cmd.command('week')
    .alias("w")
    .description('show weeks data')
    .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.week, "Week", day.day);
});
cmd.command('month')
    .alias("m")
    .description('show months data')
    .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.month, "Month", day.day);
});
cmd.command('year')
    .alias("m")
    .description('show years data')
    .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.year, "Year", day.day);
});
cmd.command('api <key>')
    .description('store the given api key')
    .action((key) => {
    gotCommand = true;
    w.setApiKey(key);
});
// handle today as default
if (!gotCommand) {
    process.argv.push('t');
}
cmd.parse(process.argv);
//# sourceMappingURL=wakatime.js.map