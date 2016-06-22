import * as fs from 'fs';
import * as moment from 'moment';
import * as request from 'request';
import * as chalk from 'chalk';
import * as cmd from 'commander';
import * as _ from 'lodash';

interface TimeInfo {
  name: string;
  total_seconds: number;
}

export interface RangeInfo {
  start: string;
  end: string;
  name: string;
}

export class Ranges {
  today: RangeInfo;
  yesterday: RangeInfo;
  week: RangeInfo;
  month: RangeInfo;
  year: RangeInfo;
}

export class WakaTimeCLI {
  apiString = 'api_key=';
  homedir = process.env.HOME;
  wakafile = this.homedir + '/.wakafile';
  apiUrl = "https://wakatime.com/api/v1";

  // Reads API Key from app directory
  readApiKey() {
    var key;
    try {
      key = fs.readFileSync(this.wakafile, 'utf8');
    } catch (e) {
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
      if (err) throw err;
      console.log('API key saved.');
    });
  };

  // Throw file error
  fileError() {
    console.log(' ');
    console.log(chalk.red(' No API Key provided'));
    console.log(chalk.red(" Example: ") + chalk.magenta("wakatime -api 'your key here' "));
    console.log(chalk.red(' Note: ') + chalk.magenta("your api key is available @ https://wakatime.com/settings"));
    console.log(' ');
    process.exit(0);
  };


  // Date function used to format date on API request
  dateInfo(): Ranges {
    let df = "YYYY-MM-DD";
    let today = moment().format(df);
    let r = new Ranges();
    r.today = { start: today, end: today, name: "Today" };
    r.yesterday = { start: moment().subtract(1, 'days').format(df), end: today, name: "Yesterday" };
    r.week = { start: moment().subtract(1, 'weeks').format(df), end: today, name: "Week" };
    r.month = { start: moment().subtract(1, 'months').format(df), end: today, name: "Month" };
    r.year = { start: moment().subtract(365, 'days').format(df), end: today, name: "Year" };
    return r;
  };

  doRequest(action: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        var apiKey = this.readApiKey();
        let url;
        if (action.endsWith('?')) {
          url = `${this.apiUrl}/${action}${this.apiString}${apiKey}`;
        } else {
          url = `${this.apiUrl}/${action}&${this.apiString}${apiKey}`;
        }
        request(url, function (error, response, body) {

          if (!error && response.statusCode == 200) {
            var body = JSON.parse(body);
            resolve(body);
          } else {
            console.error(`request error for ${url}, status:${response.statusCode}, msg:${response.statusMessage}`, error);
            reject(error);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // Prints user data to the terminal
  async user(): Promise<void> {
    let body = await this.doRequest("users/current");
    console.log('');
    console.log(chalk.cyan('WakaTime Account Details:'));
    console.log(chalk.magenta('  Account Created: ') + body.data.created_at);
    console.log(chalk.magenta('  Email: ') + body.data.email);
    if (body.data.full_name > '') {
      console.log(chalk.magenta('  Full Name: ') + body.data.full_name);
    }
    console.log('');
  }

  // Parse data for Today or Yesterday option & prints to terminal
  async detailsDay(range: RangeInfo): Promise<void> {
    let body = await this.doRequest(`users/current/summaries?start=${range.start}&end=${range.end}`);

    console.log(' '); // Empty Line for formatting
    console.log(' ' + chalk.cyan(range.name + ': ') + body.data[0].grand_total.text + ' (Total)'); // Prints provided total hours/minutes
    console.log(' '); // Empty Line for formatting

    body.data[0].languages.forEach((val) => {
      console.log(chalk.magenta(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
    })

    console.log(' '); // Empty Line for formatting

    body.data[0].projects.forEach((val) => {
      console.log(chalk.blue(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
    })

    console.log(' '); // Empty Line for formatting
  };

  formatDuration(duration: number, unit: string): string {
    let hours = Math.round(moment.duration(duration, unit).asHours());
    return `${hours} h`;
  }

  // Parse data for last seven days of work and print to console
  async detailsRange(range: RangeInfo, projectFilterRegex: string = '.*'): Promise<void> {

    let body = await this.doRequest(`users/current/summaries?start=${range.start}&end=${range.end}`);

    let rgx = new RegExp(projectFilterRegex);

    let minutes = _(body.data)
      .map('grand_total')
      .sumBy((o: { hours: number, minutes: number }) => { return o.hours * 60 + o.minutes });

    // Week Data logged to terminal here
    console.log(' ' + chalk.green(`filter projects by regex: ${projectFilterRegex}, ` + chalk.bgRed("be aware that language times still sum over all projects!!")));
    console.log(' '); // Empty Line for formatting
    console.log(' ' + chalk.cyan(range.name + ': ') + this.formatDuration(minutes, 'm') + ' (Total)'); // Prints calculated total hours/minutes
    console.log(' '); // Empty Line for formatting

    _(body.data)
      .flatMap('languages')
      .groupBy((p: TimeInfo) => { return p.name })
      .map((list, name) => { return { name: name, sum: _.sumBy(list, 'total_seconds') } })
      .orderBy('sum', 'desc')
      .forEach((o) => {
        console.log(chalk.magenta(` ${o.name}: `) + this.formatDuration(o.sum, 's'));
      });

    console.log(' '); // Empty Line for formatting

    let projects = _(body.data)
      .flatMap('projects')
      .filter((p: TimeInfo) => { return rgx.test(p.name) })
      .groupBy((p: TimeInfo) => { return p.name })
      .map((list, name) => { return { name: name, sum: _.sumBy(list, 'total_seconds') } })
      .orderBy('sum', 'desc')
      .value();

    projects.forEach((o) => {
      console.log(chalk.blue(` ${o.name}: `) + this.formatDuration(o.sum, 's'));
    });

    console.log(' '); // Empty Line for formatting
    let projectsSum = _(projects).sumBy('sum');
    console.log(chalk.underline.blue(` filtered sum: `) + this.formatDuration(projectsSum, 's'));

    console.log(' '); // Empty Line for formatting
  }
}


cmd.version('0.0.1')

let gotCommand = false;
let w = new WakaTimeCLI();

cmd.command('today [projectRegexfilter]')
  .alias("t")
  .description('show todays data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsDay(day.today);
  });

cmd.command('yesterday [projectRegexfilter]')
  .alias("yd")
  .description('show yesterdays data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsDay(day.yesterday);
  });

cmd.command('week [projectRegexfilter]')
  .alias("w")
  .description('show weeks data')
  .action((projectRegexfilter) => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.week, projectRegexfilter);
  });

cmd.command('month [projectRegexfilter]')
  .alias("m")
  .description('show months data')
  .action((projectRegexfilter) => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.month, projectRegexfilter);
  });

cmd.command('year [projectRegexfilter]')
  .alias("y")
  .description('show years data')
  .action((projectRegexfilter) => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.year, projectRegexfilter);
  });

cmd.command('api <key>')
  .description('store the given api key')
  .action((key) => {
    gotCommand = true;
    w.setApiKey(key);
  });

cmd.parse(process.argv);

// handle today as default
if (!gotCommand) {
  process.argv.push('t')
  cmd.parse(process.argv);
}
